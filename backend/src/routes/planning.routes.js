import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { ensureWritable, getAccess, projectAccess, requirePermission } from '../middleware/access.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { progressOf } from '../lib/taskRules.js';
import { publicUser, serializeTask, taskInclude, userSelect } from '../lib/serialize.js';
import { notify } from '../lib/notify.js';

// Milestone dan rapat: /api/projects/:projectId/milestones|meetings, /api/milestones/:id, /api/meetings/:id
export const projectPlanningRouter = Router({ mergeParams: true });
export const milestonesRouter = Router();
export const meetingsRouter = Router();

// ================= Milestone (FR-13) =================

const milestoneInclude = {
  owner: { select: userSelect },
  tasks: { include: taskInclude, orderBy: { dueDate: 'asc' } },
};

function serializeMilestone(m) {
  const tasks = m.tasks.map(serializeTask);
  return {
    id: m.id,
    projectId: m.projectId,
    name: m.name,
    description: m.description,
    dueDate: m.dueDate,
    owner: publicUser(m.owner),
    progress: progressOf(tasks),
    atRisk: tasks.filter((t) => t.status !== 'DONE' && (t.isOverdue || t.isBlocked)).length,
    overdue: tasks.filter((t) => t.isOverdue).length,
    blocked: tasks.filter((t) => t.isBlocked && t.status !== 'DONE').length,
    tasks,
  };
}

const milestoneSchema = z.object({
  name: z.string().trim().min(2, 'Nama milestone minimal 2 karakter.').max(100),
  description: z.string().trim().max(500).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  taskIds: z.array(z.string()).optional(),
});

async function assertOwnerMember(projectId, ownerId) {
  if (!ownerId) return;
  const m = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: ownerId } } });
  if (!m) throw badRequest('Penanggung jawab milestone harus anggota proyek.');
}

projectPlanningRouter.get('/milestones', projectAccess(), async (req, res) => {
  const list = await prisma.milestone.findMany({
    where: { projectId: req.params.projectId },
    include: milestoneInclude,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });
  res.json(list.map(serializeMilestone));
});

projectPlanningRouter.post(
  '/milestones',
  projectAccess(),
  requirePermission('MANAGE_MILESTONES'),
  validate(milestoneSchema),
  async (req, res) => {
    const { projectId } = req.params;
    const { taskIds = [], ...data } = req.body;
    await assertOwnerMember(projectId, data.ownerId);
    const ms = await prisma.$transaction(async (tx) => {
      const created = await tx.milestone.create({ data: { ...data, projectId } });
      if (taskIds.length)
        await tx.task.updateMany({ where: { id: { in: taskIds }, projectId }, data: { milestoneId: created.id } });
      return tx.milestone.findUnique({ where: { id: created.id }, include: milestoneInclude });
    });
    res.status(201).json(serializeMilestone(ms));
  },
);

async function milestoneContext(req) {
  const ms = await prisma.milestone.findUnique({ where: { id: req.params.milestoneId }, include: milestoneInclude });
  if (!ms) throw notFound('Milestone tidak ditemukan.');
  const access = await getAccess(req.user.id, ms.projectId);
  ensureWritable(access, req);
  return { ms, access };
}

milestonesRouter.get('/:milestoneId', async (req, res) => {
  const { ms } = await milestoneContext(req);
  res.json(serializeMilestone(ms));
});

milestonesRouter.patch('/:milestoneId', validate(milestoneSchema.partial()), async (req, res) => {
  const { ms, access } = await milestoneContext(req);
  if (!access.can('MANAGE_MILESTONES')) throw forbidden('Role Anda tidak memiliki izin Manage milestones.');
  const { taskIds, ...data } = req.body;
  await assertOwnerMember(ms.projectId, data.ownerId);
  const updated = await prisma.$transaction(async (tx) => {
    if (taskIds) {
      await tx.task.updateMany({ where: { milestoneId: ms.id }, data: { milestoneId: null } });
      await tx.task.updateMany({
        where: { id: { in: taskIds }, projectId: ms.projectId },
        data: { milestoneId: ms.id },
      });
    }
    return tx.milestone.update({ where: { id: ms.id }, data, include: milestoneInclude });
  });
  res.json(serializeMilestone(updated));
});

milestonesRouter.delete('/:milestoneId', async (req, res) => {
  const { ms, access } = await milestoneContext(req);
  if (!access.can('MANAGE_MILESTONES')) throw forbidden('Role Anda tidak memiliki izin Manage milestones.');
  await prisma.milestone.delete({ where: { id: ms.id } }); // tugas tetap ada, milestoneId menjadi null
  res.status(204).end();
});

// ================= Rapat dan action item (FR-11, FR-12) =================

const meetingInclude = {
  participants: { include: { user: { select: userSelect } } },
  actionItems: {
    include: { assignee: { select: userSelect }, task: { select: { id: true, status: true, number: true } } },
    orderBy: { createdAt: 'asc' },
  },
};

function serializeMeeting(m) {
  return {
    id: m.id,
    projectId: m.projectId,
    title: m.title,
    date: m.date,
    startTime: m.startTime,
    endTime: m.endTime,
    location: m.location,
    notes: m.notes,
    participants: m.participants.map((p) => publicUser(p.user)),
    actionItems: m.actionItems.map((a) => ({
      id: a.id,
      title: a.title,
      dueDate: a.dueDate,
      assignee: publicUser(a.assignee),
      task: a.task,
    })),
  };
}

const time = z.string().regex(/^\d{2}:\d{2}$/, 'Format waktu HH:MM.');
const meetingSchema = z
  .object({
    title: z.string().trim().min(2, 'Judul rapat minimal 2 karakter.').max(120),
    date: z.coerce.date({ errorMap: () => ({ message: 'Tanggal rapat wajib diisi.' }) }),
    startTime: time,
    endTime: time,
    location: z.string().trim().max(120).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    participantIds: z.array(z.string()).default([]),
  })
  .refine((d) => d.startTime < d.endTime, { message: 'Waktu selesai harus setelah waktu mulai.' });

async function assertMembers(projectId, userIds) {
  if (!userIds?.length) return;
  const count = await prisma.projectMember.count({ where: { projectId, userId: { in: userIds } } });
  if (count !== new Set(userIds).size) throw badRequest('Peserta dan penanggung jawab harus anggota proyek.');
}

projectPlanningRouter.get('/meetings', projectAccess(), async (req, res) => {
  const list = await prisma.meeting.findMany({
    where: { projectId: req.params.projectId },
    include: meetingInclude,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  res.json(list.map(serializeMeeting));
});

projectPlanningRouter.post(
  '/meetings',
  projectAccess(),
  requirePermission('MANAGE_MEETINGS'),
  validate(meetingSchema),
  async (req, res) => {
    const { projectId } = req.params;
    const { participantIds, ...data } = req.body;
    await assertMembers(projectId, participantIds);
    const m = await prisma.meeting.create({
      data: {
        ...data,
        projectId,
        participants: { create: [...new Set(participantIds)].map((userId) => ({ userId })) },
      },
      include: meetingInclude,
    });
    res.status(201).json(serializeMeeting(m));
  },
);

async function meetingContext(req, id = req.params.meetingId) {
  const m = await prisma.meeting.findUnique({ where: { id }, include: meetingInclude });
  if (!m) throw notFound('Rapat tidak ditemukan.');
  const access = await getAccess(req.user.id, m.projectId);
  ensureWritable(access, req);
  return { m, access };
}

meetingsRouter.patch('/:meetingId', validate(meetingSchema.innerType().partial()), async (req, res) => {
  const { m, access } = await meetingContext(req);
  if (!access.can('MANAGE_MEETINGS')) throw forbidden('Role Anda tidak memiliki izin Manage meetings.');
  const { participantIds, ...data } = req.body;
  const start = data.startTime ?? m.startTime;
  const end = data.endTime ?? m.endTime;
  if (start >= end) throw badRequest('Waktu selesai harus setelah waktu mulai.');
  await assertMembers(m.projectId, participantIds);
  const updated = await prisma.$transaction(async (tx) => {
    if (participantIds) {
      await tx.meetingParticipant.deleteMany({ where: { meetingId: m.id } });
      await tx.meetingParticipant.createMany({
        data: [...new Set(participantIds)].map((userId) => ({ meetingId: m.id, userId })),
      });
    }
    return tx.meeting.update({ where: { id: m.id }, data, include: meetingInclude });
  });
  res.json(serializeMeeting(updated));
});

meetingsRouter.delete('/:meetingId', async (req, res) => {
  const { m, access } = await meetingContext(req);
  if (!access.can('MANAGE_MEETINGS')) throw forbidden('Role Anda tidak memiliki izin Manage meetings.');
  if (m.actionItems.some((a) => a.task)) {
    throw conflict('Rapat ini memiliki action item yang sudah menjadi tugas sehingga tidak dapat dihapus.');
  }
  await prisma.meeting.delete({ where: { id: m.id } });
  res.status(204).end();
});

const actionItemSchema = z.object({
  title: z.string().trim().min(2, 'Action item minimal 2 karakter.').max(140),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

meetingsRouter.post('/:meetingId/action-items', validate(actionItemSchema), async (req, res) => {
  const { m, access } = await meetingContext(req);
  if (!access.can('MANAGE_MEETINGS')) throw forbidden('Role Anda tidak memiliki izin Manage meetings.');
  if (req.body.assigneeId) await assertMembers(m.projectId, [req.body.assigneeId]);
  await prisma.actionItem.create({ data: { ...req.body, meetingId: m.id } });
  const updated = await meetingContext(req);
  res.status(201).json(serializeMeeting(updated.m));
});

meetingsRouter.delete('/:meetingId/action-items/:itemId', async (req, res) => {
  const { m, access } = await meetingContext(req);
  if (!access.can('MANAGE_MEETINGS')) throw forbidden('Role Anda tidak memiliki izin Manage meetings.');
  const item = m.actionItems.find((a) => a.id === req.params.itemId);
  if (!item) throw notFound('Action item tidak ditemukan.');
  if (item.task) throw conflict('Action item yang sudah menjadi tugas tidak dapat dihapus.');
  await prisma.actionItem.delete({ where: { id: item.id } });
  res.json(serializeMeeting((await meetingContext(req)).m));
});

// FR-12: membuat tugas dari action item; satu action item paling banyak menghasilkan satu tugas.
meetingsRouter.post('/:meetingId/action-items/:itemId/convert', async (req, res) => {
  const { m, access } = await meetingContext(req);
  if (!access.can('CREATE_TASKS') || !access.can('MANAGE_MEETINGS')) {
    throw forbidden('Membuat tugas dari rapat memerlukan izin Create tasks dan Manage meetings.');
  }
  const item = m.actionItems.find((a) => a.id === req.params.itemId);
  if (!item) throw notFound('Action item tidak ditemukan.');

  // Penanggung jawab action item hanya dipakai bila orangnya masih anggota proyek.
  const assigneeId = item.assignee
    ? (
        await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: m.projectId, userId: item.assignee.id } },
        })
      )?.userId
    : null;

  const task = await prisma.$transaction(async (tx) => {
    // Kunci baris action item: hanya lolos bila taskId masih null (mencegah tugas ganda).
    const fresh = await tx.actionItem.findUnique({ where: { id: item.id } });
    if (fresh.taskId) throw conflict('Action item ini sudah dijadikan tugas.');
    const project = await tx.project.update({ where: { id: m.projectId }, data: { taskCounter: { increment: 1 } } });
    const created = await tx.task.create({
      data: {
        projectId: m.projectId,
        number: project.taskCounter,
        title: item.title,
        description: `Tindak lanjut rapat "${m.title}".`,
        dueDate: item.dueDate,
        createdById: req.user.id,
        assignees: assigneeId ? { create: [{ userId: assigneeId }] } : undefined,
      },
    });
    const { count } = await tx.actionItem.updateMany({
      where: { id: item.id, taskId: null },
      data: { taskId: created.id },
    });
    if (!count) throw conflict('Action item ini sudah dijadikan tugas.');
    return tx.task.findUnique({ where: { id: created.id }, include: taskInclude });
  });

  if (assigneeId) {
    await notify(
      [assigneeId],
      {
        type: 'assign',
        title: `Anda ditugaskan: ${task.title}`,
        body: `Dari rapat ${m.title}`,
        link: `/projects/${m.projectId}/tasks?task=${task.id}`,
      },
      req.user.id,
    );
  }
  res.status(201).json(serializeTask(task));
});
