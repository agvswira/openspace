import { prisma } from '../lib/prisma.js';
import { forbidden, notFound } from '../lib/http.js';

// Memuat keanggotaan dan izin pengguna pada satu proyek.
// Pengguna yang bukan anggota proyek mendapat 404 agar keberadaan proyek tidak bocor.
export async function getAccess(userId, projectId) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    include: { role: { include: { permissions: true } }, project: true },
  });
  if (!membership) throw notFound('Proyek tidak ditemukan atau Anda bukan anggotanya.');

  const isOwner = membership.role.isOwner;
  const permissions = new Set(membership.role.permissions.map((p) => p.permissionKey));
  return {
    membership,
    project: membership.project,
    role: membership.role,
    isOwner,
    can: (key) => isOwner || permissions.has(key),
    permissions: isOwner ? 'ALL' : [...permissions],
  };
}

// Proyek yang diarsipkan bersifat hanya-baca: semua perubahan ditolak sampai proyek dipulihkan.
export function ensureWritable(access, req) {
  if (access.project.archivedAt && req.method !== 'GET') {
    throw forbidden('Proyek ini diarsipkan sehingga hanya dapat dibaca. Pulihkan proyek terlebih dahulu.');
  }
}

// Middleware untuk rute /projects/:projectId/...
export function projectAccess(param = 'projectId', { allowArchived = false } = {}) {
  return async (req, _res, next) => {
    req.access = await getAccess(req.user.id, req.params[param]);
    if (!allowArchived) ensureWritable(req.access, req);
    next();
  };
}

export function requirePermission(...keys) {
  return (req, _res, next) => {
    const missing = keys.filter((k) => !req.access.can(k));
    if (missing.length) throw forbidden(`Role Anda tidak memiliki izin: ${missing.join(', ')}.`);
    next();
  };
}

export function requireOwner(req, _res, next) {
  if (!req.access.isOwner) throw forbidden('Hanya Owner proyek yang dapat melakukan tindakan ini.');
  next();
}
