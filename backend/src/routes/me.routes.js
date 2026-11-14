import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { serializeTask, taskInclude, publicUser } from '../lib/serialize.js';
import { startOfToday } from '../lib/taskRules.js';

const router = Router();

// FR-02: profil dan preferensi notifikasi.
const profileSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.').optional(),
  email: z.string().trim().toLowerCase().email('Format email tidak valid.').optional(),
  title: z.string().trim().max(60).optional().nullable(),
  // Foto profil: path gambar bawaan atau data URL hasil kompres di browser (maks. ~150 KB).
  avatarUrl: z
    .string()
    .max(200_000, 'Ukuran foto terlalu besar.')
    .refine((v) => v.startsWith('/avatars/') || v.startsWith('data:image/'), 'Format foto tidak didukung.')
    .optional()
    .nullable(),
  notifyAssign: z.boolean().optional(),
  notifyComment: z.boolean().optional(),
  notifyDeadline: z.boolean().optional(),
  // Wajib saat mengganti email, karena email dipakai untuk reset password dan menerima undangan.
  currentPassword: z.string().optional(),
});

router.patch('/me', validate(profileSchema), async (req, res) => {
  const { currentPassword, ...data } = req.body;
  if (data.email && data.email !== req.user.email) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, req.user.passwordHash))) {
      throw badRequest('Masukkan password saat ini yang benar untuk mengganti email.');
    }
    const taken = await prisma.user.findUnique({ where: { email: data.email } });
    if (taken) throw conflict('Email sudah dipakai akun lain.');
  }
  const u = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({
    ...publicUser(u),
    preferences: { notifyAssign: u.notifyAssign, notifyComment: u.notifyComment, notifyDeadline: u.notifyDeadline },
  });
});

router.patch('/workspaces/:id', validate(z.object({ name: z.string().trim().min(2).max(60) })), async (req, res) => {
  const ws = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!ws) throw notFound('Workspace tidak ditemukan.');
  if (ws.ownerId !== req.user.id) throw forbidden('Hanya pemilik workspace yang dapat mengubahnya.');
  res.json(await prisma.workspace.update({ where: { id: ws.id }, data: { name: req.body.name } }));
});

// FR-15: tugas milik pengguna dari semua proyek yang diikutinya.
router.get('/me/tasks', async (req, res) => {
  const completed = req.query.status === 'completed';
  const tasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId: req.user.id } },
      project: { archivedAt: null, members: { some: { userId: req.user.id } } },
      status: completed ? 'DONE' : { not: 'DONE' },
    },
    include: taskInclude,
    orderBy: [{ dueDate: 'asc' }],
  });
  res.json(tasks.map(serializeTask));
});

router.get('/me/summary', async (req, res) => {
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 864e5);
  const projectFilter = { archivedAt: null, members: { some: { userId: req.user.id } } };
  const [overdue, meetingsToday, openTasks] = await Promise.all([
    prisma.task.count({
      where: {
        assignees: { some: { userId: req.user.id } },
        status: { not: 'DONE' },
        dueDate: { lt: today },
        project: projectFilter,
      },
    }),
    prisma.meeting.count({ where: { project: projectFilter, date: { gte: today, lt: tomorrow } } }),
    prisma.task.count({
      where: { assignees: { some: { userId: req.user.id } }, status: { not: 'DONE' }, project: projectFilter },
    }),
  ]);
  res.json({ overdue, meetingsToday, openTasks });
});

// FR-16: pencarian tugas, milestone, dan halaman di proyek yang diikuti.
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ tasks: [], milestones: [], projects: [] });
  const project = { archivedAt: null, members: { some: { userId: req.user.id } } };
  const contains = { contains: q, mode: 'insensitive' };
  const [tasks, milestones, projects] = await Promise.all([
    prisma.task.findMany({
      where: { project, OR: [{ title: contains }, { description: contains }] },
      include: taskInclude,
      take: 8,
    }),
    prisma.milestone.findMany({
      where: { project, name: contains },
      include: { project: { select: { id: true, name: true, color: true, icon: true } } },
      take: 5,
    }),
    prisma.project.findMany({
      where: { ...project, name: contains },
      select: { id: true, name: true, color: true, icon: true },
      take: 5,
    }),
  ]);
  res.json({
    tasks: tasks.map(serializeTask),
    milestones: milestones.map((m) => ({ id: m.id, name: m.name, dueDate: m.dueDate, project: m.project })),
    projects,
  });
});

// FR-17: notifikasi. Pengingat deadline H-1 dibuat saat daftar notifikasi dibuka (idempoten per hari).
async function createDeadlineReminders(user) {
  if (!user.notifyDeadline) return;
  const today = startOfToday();
  const dayAfter = new Date(today.getTime() + 2 * 864e5);
  const dueSoon = await prisma.task.findMany({
    where: {
      assignees: { some: { userId: user.id } },
      status: { not: 'DONE' },
      dueDate: { gte: today, lt: dayAfter },
      project: { archivedAt: null },
    },
    select: { id: true, title: true, projectId: true, dueDate: true },
  });
  for (const t of dueSoon) {
    const link = `/projects/${t.projectId}/tasks?task=${t.id}`;
    const exists = await prisma.notification.findFirst({
      where: { userId: user.id, type: 'deadline', link, createdAt: { gte: today } },
    });
    if (!exists) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'deadline',
          title: `Deadline mendekat: ${t.title}`,
          body: 'Tugas ini jatuh tempo dalam 1 hari.',
          link,
        },
      });
    }
  }
}

router.get('/notifications', async (req, res) => {
  await createDeadlineReminders(req.user);
  const list = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json({ items: list, unread: list.filter((n) => !n.readAt).length });
});

router.post('/notifications/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ ok: true });
});

router.post('/notifications/:id/read', async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

export default router;
