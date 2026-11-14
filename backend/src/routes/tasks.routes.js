import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { ensureWritable, getAccess, projectAccess, requirePermission } from '../middleware/access.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { findCyclePath, isBlocked } from '../lib/taskRules.js';
import { serializeTask, taskInclude, publicUser, userSelect } from '../lib/serialize.js';
import { notify } from '../lib/notify.js';

// /api/projects/:projectId/tasks
export const projectTasksRouter = Router({ mergeParams: true });
// /api/tasks/:taskId/...
export const tasksRouter = Router();

const STATUS = ['TODO', 'IN_PROGRESS', 'DONE'];
const PRIORITY = ['LOW', 'MEDIUM', 'HIGH'];

const taskBase = z.object({
  title: z.string().trim().min(2, 'Judul tugas minimal 2 karakter.').max(140),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  startDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  milestoneId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
  position: z.number().int().optional(),
});
const dateOrder = (d) => !d.startDate || !d.dueDate || d.startDate <= d.dueDate;
const createSchema = taskBase.refine(dateOrder, { message: 'Tanggal mulai tidak boleh setelah deadline.' });
const updateSchema = taskBase.partial().refine(dateOrder, { message: 'Tanggal mulai tidak boleh setelah deadline.' });

// Penanggung jawab dan milestone harus berasal dari proyek yang sama.
async function assertProjectRefs(projectId, { assigneeIds, milestoneId }) {
  if (assigneeIds?.length) {
    const count = await prisma.projectMember.count({ where: { projectId, userId: { in: assigneeIds } } });
    if (count !== new Set(assigneeIds).size) throw badRequest('Penanggung jawab harus anggota proyek.');
  }
  if (milestoneId) {
    const ms = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } });
    if (!ms) throw badRequest('Milestone tidak ditemukan pada proyek ini.');
  }
}

async function loadTask(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  if (!task) throw notFound('Tugas tidak ditemukan.');
  return task;
}

// Memuat tugas + izin pengguna pada proyek tugas tersebut.
async function taskContext(req) {
  const task = await loadTask(req.params.taskId);
  const access = await getAccess(req.user.id, task.projectId);
  ensureWritable(access, req);
  const isAssignee = task.assignees.some((a) => a.userId === req.user.id);
  return { task, access, isAssignee };
}

// FR-06/FR-07: satu sumber data untuk Board, List, Calendar, dan Timeline.
projectTasksRouter.get('/', projectAccess(), async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.projectId },
    include: taskInclude,
    orderBy: [{ status: 'asc' }, { position: 'asc' }, { dueDate: 'asc' }],
  });
  res.json(tasks.map(serializeTask));
});

projectTasksRouter.post(
  '/',
  projectAccess(),
  requirePermission('CREATE_TASKS'),
  validate(createSchema),
  async (req, res) => {
    const { projectId } = req.params;
    const { assigneeIds = [], ...data } = req.body;
    await assertProjectRefs(projectId, { assigneeIds, milestoneId: data.milestoneId });

    const task = await prisma.$transaction(async (tx) => {
      const project = await tx.project.update({ where: { id: projectId }, data: { taskCounter: { increment: 1 } } });
      return tx.task.create({
        data: {
          ...data,
          projectId,
          number: project.taskCounter,
          createdById: req.user.id,
          completedAt: data.status === 'DONE' ? new Date() : null,
          assignees: { create: [...new Set(assigneeIds)].map((userId) => ({ userId })) },
        },
        include: taskInclude,
      });
    });

    await notify(
      assigneeIds,
      {
        type: 'assign',
        title: `Anda ditugaskan: ${task.title}`,
        body: `${req.user.name} · ${req.access.project.name}`,
        link: `/projects/${projectId}/tasks?task=${task.id}`,
      },
      req.user.id,
    );
    res.status(201).json(serializeTask(task));
  },
);

tasksRouter.get('/:taskId', async (req, res) => {
  const { task } = await taskContext(req);
  res.json(serializeTask(task));
});

tasksRouter.patch('/:taskId', validate(updateSchema), async (req, res) => {
  const { task, access, isAssignee } = await taskContext(req);
  const changes = req.body;
  const onlyStatus = Object.keys(changes).every((k) => k === 'status' || k === 'position');

  // Member hanya boleh mengubah status tugas miliknya; perubahan lain butuh Edit all tasks.
  const canEditAll = access.can('EDIT_ALL_TASKS');
  const canOwn = isAssignee && access.can('OWN_TASKS');
  if (!(canEditAll || (onlyStatus && canOwn))) {
    throw forbidden(
      onlyStatus
        ? 'Anda hanya dapat mengubah status tugas milik Anda.'
        : 'Role Anda tidak memiliki izin Edit all tasks.',
    );
  }

  if (changes.status && changes.status !== task.status) {
    // Tugas terhambat tidak dapat dimulai atau diselesaikan.
    if (changes.status !== 'TODO' && isBlocked(task)) {
      const waits = task.prerequisites.filter((p) => p.prerequisite.status !== 'DONE').map((p) => p.prerequisite.title);
      throw conflict(`Tugas ini masih menunggu: ${waits.join(', ')}. Selesaikan prasyarat terlebih dahulu.`, {
        waitingFor: waits,
      });
    }
    // Tugas Done tidak dibuka kembali bila tugas lanjutannya sudah berjalan.
    if (task.status === 'DONE') {
      const started = task.dependents.filter((d) => d.task.status !== 'TODO').map((d) => d.task.title);
      if (started.length) {
        throw conflict(
          `Tidak dapat membuka kembali tugas ini karena tugas lanjutan sudah berjalan: ${started.join(', ')}.`,
        );
      }
    }
  }

  await assertProjectRefs(task.projectId, changes);
  const { assigneeIds, ...data } = changes;
  if (data.status) data.completedAt = data.status === 'DONE' ? (task.completedAt ?? new Date()) : null;

  const updated = await prisma.$transaction(async (tx) => {
    if (assigneeIds) {
      await tx.taskAssignee.deleteMany({ where: { taskId: task.id } });
      await tx.taskAssignee.createMany({
        data: [...new Set(assigneeIds)].map((userId) => ({ taskId: task.id, userId })),
      });
    }
    return tx.task.update({ where: { id: task.id }, data, include: taskInclude });
  });

  if (assigneeIds) {
    const before = new Set(task.assignees.map((a) => a.userId));
    await notify(
      assigneeIds.filter((id) => !before.has(id)),
      {
        type: 'assign',
        title: `Anda ditugaskan: ${updated.title}`,
        body: `${req.user.name} · ${access.project.name}`,
        link: `/projects/${task.projectId}/tasks?task=${task.id}`,
      },
      req.user.id,
    );
  }
  res.json(serializeTask(updated));
});

tasksRouter.delete('/:taskId', async (req, res) => {
  const { task, access } = await taskContext(req);
  if (!access.can('EDIT_ALL_TASKS')) throw forbidden('Role Anda tidak memiliki izin Edit all tasks.');
  // Tugas yang menjadi prasyarat atau berasal dari rapat tidak dapat dihapus langsung.
  if (task.dependents.length) {
    throw conflict(
      `Tugas ini menjadi prasyarat bagi: ${task.dependents.map((d) => d.task.title).join(', ')}. Hapus hubungan prasyarat terlebih dahulu.`,
    );
  }
  if (task.actionItem) {
    throw conflict(
      `Tugas ini berasal dari action item rapat "${task.actionItem.meeting.title}" dan tidak dapat dihapus langsung.`,
    );
  }
  await prisma.task.delete({ where: { id: task.id } });
  res.status(204).end();
});

// ---------- Prasyarat (FR-08) ----------

tasksRouter.post('/:taskId/prerequisites', validate(z.object({ prerequisiteId: z.string() })), async (req, res) => {
  const { task, access } = await taskContext(req);
  if (!access.can('MANAGE_DEPENDENCIES')) throw forbidden('Role Anda tidak memiliki izin Manage dependencies.');
  const { prerequisiteId } = req.body;

  if (prerequisiteId === task.id) throw badRequest('Tugas tidak dapat menjadi prasyarat bagi dirinya sendiri.');
  const pre = await prisma.task.findUnique({ where: { id: prerequisiteId } });
  if (!pre) throw notFound('Tugas prasyarat tidak ditemukan.');
  if (pre.projectId !== task.projectId) throw badRequest('Prasyarat harus berasal dari proyek yang sama.');
  if (task.prerequisites.some((p) => p.prerequisiteId === prerequisiteId))
    throw conflict('Hubungan prasyarat ini sudah ada.');
  if (task.status !== 'TODO' && pre.status !== 'DONE') {
    throw conflict('Prasyarat yang belum selesai tidak dapat ditambahkan pada tugas yang sudah In progress atau Done.');
  }

  // Deteksi siklus dengan DFS pada graf prasyarat proyek.
  const edges = await prisma.taskPrerequisite.findMany({ where: { task: { projectId: task.projectId } } });
  const cycle = findCyclePath(edges, task.id, prerequisiteId);
  if (cycle) {
    const titles = await prisma.task.findMany({ where: { id: { in: cycle } }, select: { id: true, title: true } });
    const names = cycle.map((id) => titles.find((t) => t.id === id)?.title);
    throw conflict(`Hubungan ini membentuk siklus: ${names.join(' → ')}.`, { cycle: names });
  }

  await prisma.taskPrerequisite.create({ data: { taskId: task.id, prerequisiteId } });
  res.status(201).json(serializeTask(await loadTask(task.id)));
});

tasksRouter.delete('/:taskId/prerequisites/:prerequisiteId', async (req, res) => {
  const { task, access } = await taskContext(req);
  if (!access.can('MANAGE_DEPENDENCIES')) throw forbidden('Role Anda tidak memiliki izin Manage dependencies.');
  await prisma.taskPrerequisite.deleteMany({ where: { taskId: task.id, prerequisiteId: req.params.prerequisiteId } });
  res.json(serializeTask(await loadTask(task.id)));
});

// ---------- Komentar (FR-09) ----------

tasksRouter.get('/:taskId/comments', async (req, res) => {
  await taskContext(req);
  const comments = await prisma.taskComment.findMany({
    where: { taskId: req.params.taskId },
    include: { author: { select: userSelect } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(comments.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt, author: publicUser(c.author) })));
});

tasksRouter.post(
  '/:taskId/comments',
  validate(z.object({ body: z.string().trim().min(1, 'Komentar tidak boleh kosong.').max(2000) })),
  async (req, res) => {
    const { task } = await taskContext(req);
    const c = await prisma.taskComment.create({
      data: { taskId: task.id, authorId: req.user.id, body: req.body.body },
      include: { author: { select: userSelect } },
    });
    await notify(
      task.assignees.map((a) => a.userId),
      {
        type: 'comment',
        title: `Komentar baru di ${task.title}`,
        body: `${req.user.name}: ${req.body.body.slice(0, 80)}`,
        link: `/projects/${task.projectId}/tasks?task=${task.id}`,
      },
      req.user.id,
    );
    res.status(201).json({ id: c.id, body: c.body, createdAt: c.createdAt, author: publicUser(c.author) });
  },
);

// ---------- Link hasil kerja (FR-10) ----------

function canManageLinks(access, isAssignee) {
  return (isAssignee && access.can('OWN_TASKS')) || (access.can('MANAGE_LINKS') && access.can('EDIT_ALL_TASKS'));
}

tasksRouter.get('/:taskId/links', async (req, res) => {
  await taskContext(req);
  const links = await prisma.taskLink.findMany({
    where: { taskId: req.params.taskId },
    include: { addedBy: { select: userSelect } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(links.map((l) => ({ ...l, addedBy: publicUser(l.addedBy) })));
});

const linkSchema = z.object({
  title: z.string().trim().min(1, 'Judul link wajib diisi.').max(120),
  url: z
    .string()
    .trim()
    .url('URL tidak valid. Gunakan format https://...')
    .refine((u) => /^https?:\/\//i.test(u), 'URL harus diawali http:// atau https://'),
});

tasksRouter.post('/:taskId/links', validate(linkSchema), async (req, res) => {
  const { task, access, isAssignee } = await taskContext(req);
  if (!canManageLinks(access, isAssignee)) throw forbidden('Anda hanya dapat mengelola link pada tugas milik Anda.');
  const link = await prisma.taskLink.create({
    data: { taskId: task.id, addedById: req.user.id, ...req.body },
    include: { addedBy: { select: userSelect } },
  });
  res.status(201).json({ ...link, addedBy: publicUser(link.addedBy) });
});

tasksRouter.delete('/:taskId/links/:linkId', async (req, res) => {
  const { task, access, isAssignee } = await taskContext(req);
  if (!canManageLinks(access, isAssignee)) throw forbidden('Anda hanya dapat mengelola link pada tugas milik Anda.');
  await prisma.taskLink.deleteMany({ where: { id: req.params.linkId, taskId: task.id } });
  res.status(204).end();
});
