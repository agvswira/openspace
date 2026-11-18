// Pengujian unit role bawaan dan katalog izin (Tabel 2.5 laporan).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MEMBER_DEFAULT, PERMISSIONS, PERMISSION_KEYS, createBuiltInRoles } from '../src/lib/permissions.js';

// Pengganti transaksi Prisma: mencatat data yang akan dibuat tanpa database.
function fakeTx() {
  const created = [];
  return {
    created,
    role: {
      create: async ({ data }) => {
        created.push(data);
        return { id: `role-${created.length}`, ...data };
      },
    },
  };
}

describe('katalog izin', () => {
  test('setiap izin punya key unik, label, dan grup', () => {
    assert.equal(new Set(PERMISSION_KEYS).size, PERMISSIONS.length);
    for (const p of PERMISSIONS) {
      assert.ok(p.key && p.label && p.group, `izin ${p.key} tidak lengkap`);
    }
  });
  test('izin bawaan Member adalah bagian dari katalog', () => {
    for (const k of MEMBER_DEFAULT) assert.ok(PERMISSION_KEYS.includes(k), k);
  });
});

describe('createBuiltInRoles', () => {
  test('membuat tepat dua role: Owner lalu Member', async () => {
    const tx = fakeTx();
    await createBuiltInRoles(tx, 'project-1');
    assert.deepEqual(
      tx.created.map((r) => r.name),
      ['Owner', 'Member'],
    );
    assert.ok(tx.created.every((r) => r.projectId === 'project-1' && r.isBuiltIn));
  });
  test('Owner mendapat semua izin', async () => {
    const tx = fakeTx();
    const { owner } = await createBuiltInRoles(tx, 'p');
    assert.equal(owner.isOwner, true);
    assert.deepEqual(owner.permissions.create.map((x) => x.permissionKey).sort(), [...PERMISSION_KEYS].sort());
  });
  test('Member hanya mendapat izin bawaan (tidak bisa mengedit semua tugas)', async () => {
    const tx = fakeTx();
    const { member } = await createBuiltInRoles(tx, 'p');
    const keys = member.permissions.create.map((x) => x.permissionKey);
    assert.deepEqual(keys, MEMBER_DEFAULT);
    assert.ok(!keys.includes('EDIT_ALL_TASKS'));
    assert.ok(!member.isOwner);
  });
});
