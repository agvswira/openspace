// Daftar izin yang disediakan aplikasi (Tabel 2.5 laporan).
export const PERMISSIONS = [
  {
    key: 'OWN_TASKS',
    label: 'Own tasks',
    group: 'Tasks',
    description: 'Memperbarui status, komentar, dan link pada tugas miliknya',
  },
  { key: 'CREATE_TASKS', label: 'Create tasks', group: 'Tasks', description: 'Membuat tugas baru' },
  {
    key: 'EDIT_ALL_TASKS',
    label: 'Edit all tasks',
    group: 'Tasks',
    description: 'Mengubah semua tugas, bukan hanya miliknya',
  },
  {
    key: 'MANAGE_LINKS',
    label: 'Manage links',
    group: 'Collaboration',
    description: 'Menambah dan menghapus link hasil kerja',
  },
  {
    key: 'MANAGE_MEETINGS',
    label: 'Manage meetings',
    group: 'Collaboration',
    description: 'Membuat rapat dan action item',
  },
  {
    key: 'MANAGE_DEPENDENCIES',
    label: 'Manage dependencies',
    group: 'Planning',
    description: 'Mengatur prasyarat tugas',
  },
  {
    key: 'MANAGE_MILESTONES',
    label: 'Manage milestones',
    group: 'Planning',
    description: 'Membuat milestone dan menghubungkan tugas',
  },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
export const MEMBER_DEFAULT = ['OWN_TASKS', 'MANAGE_LINKS'];

// Membuat role bawaan Owner dan Member ketika proyek baru dibuat.
export async function createBuiltInRoles(tx, projectId) {
  const owner = await tx.role.create({
    data: {
      projectId,
      name: 'Owner',
      description: 'Full access, billing and deletion',
      isOwner: true,
      isBuiltIn: true,
      permissions: { create: PERMISSION_KEYS.map((permissionKey) => ({ permissionKey })) },
    },
  });
  const member = await tx.role.create({
    data: {
      projectId,
      name: 'Member',
      description: 'Own tasks and work links',
      isBuiltIn: true,
      permissions: { create: MEMBER_DEFAULT.map((permissionKey) => ({ permissionKey })) },
    },
  });
  return { owner, member };
}

export async function ensurePermissionCatalog(db) {
  for (const p of PERMISSIONS) {
    await db.permission.upsert({ where: { key: p.key }, update: p, create: p });
  }
}
