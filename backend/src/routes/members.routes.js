import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { projectAccess, requireOwner } from '../middleware/access.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { createOneTimeToken, hashToken } from '../lib/tokens.js';
import { sendMail } from '../lib/mailer.js';
import { notify } from '../lib/notify.js';
import { config } from '../config.js';
import { publicUser, userSelect } from '../lib/serialize.js';

// Rute di bawah /api/projects/:projectId
export const projectMembersRouter = Router({ mergeParams: true });
// Rute publik/umum untuk undangan: /api/invitations
export const invitationsRouter = Router();

const INVITE_TTL_DAYS = 7;
const ONLINE_WINDOW_MS = 15 * 60 * 1000;

projectMembersRouter.get('/members', projectAccess(), async (req, res) => {
  const projectId = req.params.projectId;
  const [members, invitations] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: userSelect }, role: true },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.invitation.findMany({
      where: { projectId, status: 'PENDING' },
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const openCounts = await prisma.taskAssignee.groupBy({
    by: ['userId'],
    where: { task: { projectId, status: { not: 'DONE' } } },
    _count: { _all: true },
  });
  const countOf = (userId) => openCounts.find((c) => c.userId === userId)?._count._all ?? 0;

  res.json({
    members: members.map((m) => ({
      id: m.id,
      user: publicUser(m.user),
      role: { id: m.role.id, name: m.role.name, isOwner: m.role.isOwner, isBuiltIn: m.role.isBuiltIn },
      openTasks: countOf(m.userId),
      lastActiveAt: m.lastActiveAt,
      // Dianggap online bila membuka proyek dalam 15 menit terakhir.
      isOnline: Date.now() - m.lastActiveAt.getTime() < ONLINE_WINDOW_MS,
      joinedAt: m.joinedAt,
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: { id: i.role.id, name: i.role.name },
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
    })),
  });
});

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  roleId: z.string().min(1, 'Pilih role untuk anggota baru.'),
});

async function sendInvitationEmail(invitation, token, project, inviter) {
  await sendMail({
    to: invitation.email,
    subject: `${inviter.name} mengundang Anda ke proyek ${project.name}`,
    text: `Anda diundang bergabung ke proyek "${project.name}" di Openspace.\n\nTerima undangan (berlaku ${INVITE_TTL_DAYS} hari):\n${config.clientUrl}/invite/${token}`,
  });
}

// FR-04: undangan lewat email beserta role tujuan.
projectMembersRouter.post('/invitations', projectAccess(), requireOwner, validate(inviteSchema), async (req, res) => {
  const { projectId } = req.params;
  const { email, roleId } = req.body;

  const role = await prisma.role.findFirst({ where: { id: roleId, projectId } });
  if (!role) throw badRequest('Role tidak ditemukan pada proyek ini.');
  if (role.isOwner) throw badRequest('Role Owner hanya dapat diberikan melalui pengalihan kepemilikan.');

  const alreadyMember = await prisma.projectMember.findFirst({ where: { projectId, user: { email } } });
  if (alreadyMember) throw conflict(`${email} sudah menjadi anggota proyek ini.`);
  const pending = await prisma.invitation.findFirst({ where: { projectId, email, status: 'PENDING' } });
  if (pending) throw conflict(`Undangan untuk ${email} masih tertunda. Gunakan "Resend" bila perlu.`);

  const { token, tokenHash } = createOneTimeToken();
  const invitation = await prisma.invitation.create({
    data: { projectId, email, roleId, tokenHash, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 864e5) },
  });
  await sendInvitationEmail(invitation, token, req.access.project, req.user);

  const invitedUser = await prisma.user.findUnique({ where: { email } });
  if (invitedUser) {
    // Token tidak dicantumkan di notifikasi: email akun belum diverifikasi, jadi tautan undangan
    // hanya dikirim ke kotak masuk alamat yang diundang.
    await notify([invitedUser.id], {
      type: 'invite',
      title: `Undangan ke ${req.access.project.name}`,
      body: `${req.user.name} mengundang Anda sebagai ${role.name}. Buka tautan di email ${email} untuk bergabung.`,
    });
  }
  res
    .status(201)
    .json({ id: invitation.id, email, role: { id: role.id, name: role.name }, expiresAt: invitation.expiresAt });
});

projectMembersRouter.post('/invitations/:invitationId/resend', projectAccess(), requireOwner, async (req, res) => {
  const inv = await prisma.invitation.findFirst({
    where: { id: req.params.invitationId, projectId: req.params.projectId, status: 'PENDING' },
  });
  if (!inv) throw notFound('Undangan tidak ditemukan.');
  const { token, tokenHash } = createOneTimeToken();
  const updated = await prisma.invitation.update({
    where: { id: inv.id },
    data: { tokenHash, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 864e5) },
  });
  await sendInvitationEmail(updated, token, req.access.project, req.user);
  res.json({ ok: true, expiresAt: updated.expiresAt });
});

projectMembersRouter.delete('/invitations/:invitationId', projectAccess(), requireOwner, async (req, res) => {
  const { count } = await prisma.invitation.updateMany({
    where: { id: req.params.invitationId, projectId: req.params.projectId, status: 'PENDING' },
    data: { status: 'REVOKED' },
  });
  if (!count) throw notFound('Undangan tidak ditemukan.');
  res.status(204).end();
});

// Mengubah role anggota.
projectMembersRouter.patch(
  '/members/:memberId',
  projectAccess(),
  requireOwner,
  validate(z.object({ roleId: z.string() })),
  async (req, res) => {
    const { projectId, memberId } = req.params;
    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      include: { role: true },
    });
    if (!member) throw notFound('Anggota tidak ditemukan.');
    if (member.role.isOwner) throw forbidden('Role Owner tidak dapat diubah. Gunakan pengalihan kepemilikan.');
    const role = await prisma.role.findFirst({ where: { id: req.body.roleId, projectId } });
    if (!role) throw badRequest('Role tidak ditemukan pada proyek ini.');
    if (role.isOwner) throw badRequest('Role Owner hanya dapat diberikan melalui pengalihan kepemilikan.');

    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { roleId: role.id },
      include: { role: true },
    });
    res.json({ id: updated.id, role: { id: role.id, name: role.name } });
  },
);

// Mengeluarkan anggota: tugas terbuka wajib dialihkan terlebih dahulu (Tabel 2.6).
projectMembersRouter.delete('/members/:memberId', projectAccess(), requireOwner, async (req, res) => {
  const { projectId, memberId } = req.params;
  const reassignTo = req.body?.reassignToUserId || req.query.reassignToUserId;

  const member = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
    include: { role: true, user: true },
  });
  if (!member) throw notFound('Anggota tidak ditemukan.');
  if (member.role.isOwner) throw forbidden('Owner tidak dapat dikeluarkan. Alihkan kepemilikan terlebih dahulu.');

  const openTasks = await prisma.task.findMany({
    where: { projectId, status: { not: 'DONE' }, assignees: { some: { userId: member.userId } } },
    select: { id: true, title: true },
  });

  if (openTasks.length && !reassignTo) {
    throw conflict(
      `${member.user.name} masih menangani ${openTasks.length} tugas terbuka. Alihkan tugasnya ke anggota lain terlebih dahulu.`,
      { openTasks },
    );
  }
  if (reassignTo) {
    const target = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: reassignTo } },
    });
    if (!target || reassignTo === member.userId) throw badRequest('Anggota tujuan pengalihan tidak valid.');
  }

  await prisma.$transaction(async (tx) => {
    for (const t of openTasks) {
      await tx.taskAssignee.delete({ where: { taskId_userId: { taskId: t.id, userId: member.userId } } });
      await tx.taskAssignee.upsert({
        where: { taskId_userId: { taskId: t.id, userId: reassignTo } },
        update: {},
        create: { taskId: t.id, userId: reassignTo },
      });
    }
    await tx.projectMember.delete({ where: { id: memberId } });
  });
  res.status(204).end();
});

// ----- Undangan dari sisi penerima -----

export async function getInvitationInfo(req, res) {
  const inv = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(req.params.token) },
    include: {
      project: { select: { id: true, name: true, color: true, icon: true } },
      role: { select: { name: true } },
    },
  });
  if (!inv) throw notFound('Undangan tidak ditemukan.');
  res.json({ email: inv.email, status: inv.status, expiresAt: inv.expiresAt, project: inv.project, role: inv.role });
}

invitationsRouter.post('/:token/accept', requireAuth, async (req, res) => {
  const inv = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(req.params.token) },
    include: { project: true },
  });
  if (!inv || inv.status !== 'PENDING') throw badRequest('Undangan tidak berlaku atau sudah digunakan.');
  if (inv.expiresAt < new Date()) throw badRequest('Undangan sudah kedaluwarsa. Minta Owner mengirim ulang.');
  if (inv.email !== req.user.email)
    throw forbidden(`Undangan ini ditujukan untuk ${inv.email}. Login dengan email tersebut.`);

  await prisma.$transaction(async (tx) => {
    await tx.projectMember.upsert({
      where: { projectId_userId: { projectId: inv.projectId, userId: req.user.id } },
      update: {},
      create: { projectId: inv.projectId, userId: req.user.id, roleId: inv.roleId },
    });
    await tx.invitation.update({ where: { id: inv.id }, data: { status: 'ACCEPTED' } });
  });
  await notify([inv.project.ownerId], {
    type: 'invite',
    title: `${req.user.name} bergabung ke ${inv.project.name}`,
    link: `/projects/${inv.projectId}/members`,
  });
  res.json({ projectId: inv.projectId });
});
