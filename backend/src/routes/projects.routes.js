import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { projectAccess, requireOwner } from '../middleware/access.js';
import { badRequest, notFound } from '../lib/http.js';
import { createBuiltInRoles } from '../lib/permissions.js';
import { progressOf, startOfToday } from '../lib/taskRules.js';
import { publicUser, serializeTask, taskInclude, userSelect } from '../lib/serialize.js';

const router = Router();

// Ikon penanda proyek yang tersedia di antarmuka (nama ikon Lucide).
export const PROJECT_ICONS = ['asterisk', 'users', 'calendar', 'rocket', 'book', 'megaphone'];

function projectStatus(progress) {
  if (progress.total === 0) return 'TODO';
  if (progress.done === progress.total) return 'DONE';
  return progress.done > 0 ? 'IN_PROGRESS' : 'TODO';
}

// Daftar proyek yang diikuti pengguna (FR-03).
router.get('/', async (req, res) => {
  const archived = req.query.archived === 'true';
  const memberships = await prisma.projectMember.findMany({
    where: { userId: req.user.id, project: { archivedAt: archived ? { not: null } : null } },
    include: {
      role: true,
      project: {
        include: {
          tasks: { select: { status: true } },
          members: { include: { user: { select: userSelect } } },
        },
      },
    },
    orderBy: { project: { position: 'asc' } },
  });

  res.json(
    memberships.map(({ project: p, role }) => {
      const progress = progressOf(p.tasks);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        color: p.color,
        icon: p.icon,
        dueDate: p.dueDate,
        archivedAt: p.archivedAt,
        position: p.position,
        role: { id: role.id, name: role.name, isOwner: role.isOwner },
        members: p.members.map((m) => publicUser(m.user)),
        progress,
        status: projectStatus(progress),
      };
    }),
  );
});

const projectSchema = z.object({
  name: z.string().trim().min(2, 'Nama proyek minimal 2 karakter.').max(80),
  description: z.string().trim().max(500).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Warna tidak valid.')
    .optional(),
  icon: z.enum(PROJECT_ICONS).optional(),
  dueDate: z.coerce.date().optional().nullable(),
});

// Membuat proyek beserta role bawaan Owner/Member, pembuat otomatis menjadi Owner.
router.post('/', validate(projectSchema), async (req, res) => {
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: req.user.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!workspace) throw badRequest('Workspace tidak ditemukan.');
  const count = await prisma.projectMember.count({ where: { userId: req.user.id } });

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: { ...req.body, workspaceId: workspace.id, ownerId: req.user.id, position: count },
    });
    const { owner } = await createBuiltInRoles(tx, p.id);
    await tx.projectMember.create({ data: { projectId: p.id, userId: req.user.id, roleId: owner.id } });
    return p;
  });
  res.status(201).json(project);
});

router.patch('/reorder', validate(z.object({ ids: z.array(z.string()).min(1) })), async (req, res) => {
  await prisma.$transaction(
    req.body.ids.map((id, index) =>
      prisma.project.updateMany({
        where: { id, members: { some: { userId: req.user.id } } },
        data: { position: index },
      }),
    ),
  );
  res.json({ ok: true });
});

router.get('/:projectId', projectAccess(), async (req, res) => {
  const p = await prisma.project.findUnique({
    where: { id: req.params.projectId },
    include: {
      owner: { select: userSelect },
      members: { include: { user: { select: userSelect }, role: true } },
      _count: { select: { tasks: true, milestones: true, meetings: true } },
    },
  });
  await prisma.projectMember.update({ where: { id: req.access.membership.id }, data: { lastActiveAt: new Date() } });
  res.json({
    ...p,
    members: p.members.map((m) => ({
      ...publicUser(m.user),
      role: { id: m.role.id, name: m.role.name, isOwner: m.role.isOwner },
    })),
    access: {
      role: { id: req.access.role.id, name: req.access.role.name },
      isOwner: req.access.isOwner,
      permissions: req.access.permissions,
    },
  });
});

router.patch('/:projectId', projectAccess(), requireOwner, validate(projectSchema.partial()), async (req, res) => {
  const p = await prisma.project.update({ where: { id: req.params.projectId }, data: req.body });
  res.json(p);
});

router.post(
  '/:projectId/archive',
  projectAccess('projectId', { allowArchived: true }),
  requireOwner,
  async (req, res) => {
    const archive = req.body?.archive !== false;
    const p = await prisma.project.update({
      where: { id: req.params.projectId },
      data: { archivedAt: archive ? new Date() : null },
    });
    res.json(p);
  },
);

router.delete('/:projectId', projectAccess('projectId', { allowArchived: true }), requireOwner, async (req, res) => {
  const id = req.params.projectId;
  // Hapus urutan yang bergantung (Restrict) terlebih dahulu.
  await prisma.$transaction([
    prisma.actionItem.deleteMany({ where: { meeting: { projectId: id } } }),
    prisma.taskPrerequisite.deleteMany({ where: { task: { projectId: id } } }),
    prisma.project.delete({ where: { id } }),
  ]);
  res.status(204).end();
});

// Pengalihan kepemilikan: Owner baru harus anggota proyek, Owner lama menjadi Member.
router.post(
  '/:projectId/transfer',
  projectAccess(),
  requireOwner,
  validate(z.object({ userId: z.string() })),
  async (req, res) => {
    const projectId = req.params.projectId;
    const target = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.body.userId } },
    });
    if (!target) throw notFound('Pengguna tujuan bukan anggota proyek.');
    if (target.userId === req.user.id) throw badRequest('Anda sudah menjadi Owner proyek ini.');

    const roles = await prisma.role.findMany({ where: { projectId, isBuiltIn: true } });
    const ownerRole = roles.find((r) => r.isOwner);
    const memberRole = roles.find((r) => !r.isOwner);
    await prisma.$transaction([
      prisma.projectMember.update({ where: { id: target.id }, data: { roleId: ownerRole.id } }),
      prisma.projectMember.update({ where: { id: req.access.membership.id }, data: { roleId: memberRole.id } }),
      prisma.project.update({ where: { id: projectId }, data: { ownerId: target.userId } }),
    ]);
    res.json({ ok: true });
  },
);

// FR-14: ringkasan dashboard Overview.
router.get('/:projectId/overview', projectAccess(), async (req, res) => {
  const projectId = req.params.projectId;
  const [rawTasks, milestones, members] = await Promise.all([
    prisma.task.findMany({ where: { projectId }, include: taskInclude, orderBy: { dueDate: 'asc' } }),
    prisma.milestone.findMany({
      where: { projectId },
      include: { tasks: { include: taskInclude, orderBy: { dueDate: 'asc' } }, owner: { select: userSelect } },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.projectMember.findMany({ where: { projectId }, include: { user: { select: userSelect }, role: true } }),
  ]);
  const tasks = rawTasks.map(serializeTask);
  const today = startOfToday();
  const weekAgo = new Date(today.getTime() - 7 * 864e5);
  const tomorrowEnd = new Date(today.getTime() + 2 * 864e5);

  const byStatus = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
  tasks.forEach((t) => byStatus[t.status]++);

  const nextMilestone = milestones
    .map((m) => ({ ...m, progress: progressOf(m.tasks) }))
    .find((m) => m.progress.total === 0 || m.progress.done < m.progress.total);

  res.json({
    total: tasks.length,
    byStatus,
    progress: progressOf(tasks),
    completedThisWeek: tasks.filter((t) => t.completedAt && new Date(t.completedAt) >= weekAgo).length,
    dueSoonInProgress: tasks.filter(
      (t) => t.status === 'IN_PROGRESS' && t.dueDate && new Date(t.dueDate) < tomorrowEnd && !t.isOverdue,
    ).length,
    overdue: tasks.filter((t) => t.isOverdue).length,
    blocked: tasks.filter((t) => t.isBlocked && t.status !== 'DONE').length,
    nextMilestone: nextMilestone
      ? {
          id: nextMilestone.id,
          name: nextMilestone.name,
          dueDate: nextMilestone.dueDate,
          progress: nextMilestone.progress,
          tasks: nextMilestone.tasks.map(serializeTask),
        }
      : null,
    needsAttention: tasks.filter((t) => t.status !== 'DONE' && (t.isOverdue || t.isBlocked)),
    workload: members
      .map((m) => ({
        user: publicUser(m.user),
        role: m.role.name,
        openTasks: tasks.filter((t) => t.status !== 'DONE' && t.assignees.some((a) => a.id === m.userId)).length,
      }))
      .sort((a, b) => b.openTasks - a.openTasks),
  });
});

export default router;
