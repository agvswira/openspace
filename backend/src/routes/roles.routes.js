import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { projectAccess, requireOwner } from '../middleware/access.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { PERMISSIONS, PERMISSION_KEYS } from '../lib/permissions.js';
import { publicUser, userSelect } from '../lib/serialize.js';

const router = Router({ mergeParams: true });

function serializeRole(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    isOwner: r.isOwner,
    isBuiltIn: r.isBuiltIn,
    permissions: r.isOwner ? PERMISSION_KEYS : r.permissions.map((p) => p.permissionKey),
    members: (r.members || []).map((m) => publicUser(m.user)),
  };
}

const roleInclude = { permissions: true, members: { include: { user: { select: userSelect } } } };

router.get('/permissions', (_req, res) => res.json(PERMISSIONS));

router.get('/roles', projectAccess(), async (req, res) => {
  const roles = await prisma.role.findMany({
    where: { projectId: req.params.projectId },
    include: roleInclude,
    orderBy: [{ isOwner: 'desc' }, { name: 'asc' }],
  });
  res.json(roles.map(serializeRole));
});

const roleSchema = z.object({
  name: z.string().trim().min(2, 'Nama role minimal 2 karakter.').max(40),
  description: z.string().trim().max(160).optional().nullable(),
  permissions: z.array(z.enum(PERMISSION_KEYS)).default([]),
});

// FR-05: pembuatan custom role dari daftar izin aplikasi (khusus Owner).
router.post('/roles', projectAccess(), requireOwner, validate(roleSchema), async (req, res) => {
  const { name, description, permissions } = req.body;
  const role = await prisma.role.create({
    data: {
      projectId: req.params.projectId,
      name,
      description,
      permissions: { create: [...new Set(permissions)].map((permissionKey) => ({ permissionKey })) },
    },
    include: roleInclude,
  });
  res.status(201).json(serializeRole(role));
});

async function findRole(projectId, roleId) {
  const role = await prisma.role.findFirst({ where: { id: roleId, projectId }, include: roleInclude });
  if (!role) throw notFound('Role tidak ditemukan.');
  return role;
}

router.patch('/roles/:roleId', projectAccess(), requireOwner, validate(roleSchema.partial()), async (req, res) => {
  const role = await findRole(req.params.projectId, req.params.roleId);
  if (role.isOwner) throw forbidden('Izin Owner tidak dapat diubah.');
  if (role.isBuiltIn && req.body.name && req.body.name !== role.name)
    throw badRequest('Nama role bawaan tidak dapat diubah.');

  const { permissions, ...rest } = req.body;
  // Perubahan izin langsung berlaku pada tindakan berikutnya karena izin dibaca ulang per request.
  const updated = await prisma.$transaction(async (tx) => {
    if (permissions) {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: [...new Set(permissions)].map((permissionKey) => ({ roleId: role.id, permissionKey })),
      });
    }
    return tx.role.update({ where: { id: role.id }, data: rest, include: roleInclude });
  });
  res.json(serializeRole(updated));
});

router.post('/roles/:roleId/duplicate', projectAccess(), requireOwner, async (req, res) => {
  const role = await findRole(req.params.projectId, req.params.roleId);
  const keys = role.isOwner ? PERMISSION_KEYS : role.permissions.map((p) => p.permissionKey);
  let name = `${role.name} (copy)`;
  for (let i = 2; await prisma.role.findFirst({ where: { projectId: role.projectId, name } }); i++)
    name = `${role.name} (copy ${i})`;

  const copy = await prisma.role.create({
    data: {
      projectId: role.projectId,
      name,
      description: role.description,
      permissions: { create: keys.map((permissionKey) => ({ permissionKey })) },
    },
    include: roleInclude,
  });
  res.status(201).json(serializeRole(copy));
});

router.delete('/roles/:roleId', projectAccess(), requireOwner, async (req, res) => {
  const role = await findRole(req.params.projectId, req.params.roleId);
  if (role.isBuiltIn) throw forbidden('Role bawaan tidak dapat dihapus.');
  const pendingInvites = await prisma.invitation.count({ where: { roleId: role.id, status: 'PENDING' } });
  if (role.members.length || pendingInvites) {
    throw conflict(
      `Role "${role.name}" masih dipakai oleh ${role.members.length} anggota${pendingInvites ? ` dan ${pendingInvites} undangan` : ''}. Pindahkan ke role lain sebelum menghapus.`,
      { members: role.members.map((m) => publicUser(m.user)) },
    );
  }
  await prisma.$transaction([
    prisma.invitation.deleteMany({ where: { roleId: role.id } }),
    prisma.role.delete({ where: { id: role.id } }),
  ]);
  res.status(204).end();
});

export default router;
