import { prisma } from './prisma.js';

const PREF = { assign: 'notifyAssign', comment: 'notifyComment', deadline: 'notifyDeadline' };

// Notifikasi hanya dikirim ke anggota terkait dan mengikuti preferensi pengguna.
export async function notify(userIds, { type, title, body, link }, exceptUserId) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== exceptUserId);
  if (!ids.length) return;
  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  const targets = users.filter((u) => !PREF[type] || u[PREF[type]]);
  if (!targets.length) return;
  await prisma.notification.createMany({
    data: targets.map((u) => ({ userId: u.id, type, title, body, link })),
  });
}
