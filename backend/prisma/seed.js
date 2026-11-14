// Data contoh mengikuti prototipe Figma (proyek "Penyelenggaraan kegiatan").
// Tanggal dibuat relatif terhadap hari ini agar status terlambat/terhambat tetap masuk akal.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { createBuiltInRoles, ensurePermissionCatalog } from '../src/lib/permissions.js';
import { createOneTimeToken } from '../src/lib/tokens.js';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'password123';

const today = new Date();
today.setHours(0, 0, 0, 0);
const day = (offset) => new Date(today.getTime() + offset * 864e5);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

async function main() {
  // Seed menghapus seluruh data, jadi ditolak di production agar akun asli tidak hilang.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed tidak boleh dijalankan saat NODE_ENV=production karena akan menghapus semua data.');
  }

  // Bersihkan data lama (urutan memperhatikan relasi Restrict).
  await prisma.actionItem.deleteMany();
  await prisma.taskPrerequisite.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
  await ensurePermissionCatalog(prisma);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  // Foto profil diambil dari prototipe Figma (frontend/public/avatars).
  const mk = (name, email, title, avatarColor) =>
    prisma.user.create({
      data: { name, email, title, avatarColor, passwordHash, avatarUrl: `/avatars/${name.toLowerCase()}.jpg` },
    });
  const wira = await mk('Wira', 'wira@openspace.example', 'Project Manager', '#2563EB');
  const nata = await mk('Nata', 'nata@openspace.example', 'Frontend Developer', '#EA580C');
  const semaya = await mk('Semaya', 'semaya@openspace.example', 'Backend Developer', '#16A34A');
  const megadhana = await mk('Megadhana', 'megadhana@openspace.example', 'UI/UX Designer', '#9333EA');

  const ws = await prisma.workspace.create({ data: { name: 'Kelompok 3', ownerId: wira.id } });
  for (const u of [nata, semaya, megadhana])
    await prisma.workspace.create({ data: { name: `Workspace ${u.name}`, ownerId: u.id } });

  // ---------- Proyek utama ----------
  const project = await prisma.project.create({
    data: {
      workspaceId: ws.id,
      ownerId: wira.id,
      name: 'Penyelenggaraan kegiatan',
      description: 'Event planning for the Kelompok 3 programme',
      color: '#2563EB',
      dueDate: day(7),
      position: 0,
    },
  });
  const { owner, member } = await createBuiltInRoles(prisma, project.id);
  const koordinator = await prisma.role.create({
    data: {
      projectId: project.id,
      name: 'Koordinator',
      description: 'Manage tasks, milestones and meetings',
      permissions: {
        create: [
          'OWN_TASKS',
          'CREATE_TASKS',
          'EDIT_ALL_TASKS',
          'MANAGE_LINKS',
          'MANAGE_DEPENDENCIES',
          'MANAGE_MEETINGS',
          'MANAGE_MILESTONES',
        ].map((permissionKey) => ({ permissionKey })),
      },
    },
  });
  const pelaksana = await prisma.role.create({
    data: {
      projectId: project.id,
      name: 'Pelaksana',
      description: 'Update assigned tasks only',
      permissions: { create: ['OWN_TASKS'].map((permissionKey) => ({ permissionKey })) },
    },
  });

  const hoursAgo = (h) => new Date(Date.now() - h * 3600e3);
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: wira.id, roleId: owner.id, lastActiveAt: new Date() },
      { projectId: project.id, userId: nata.id, roleId: koordinator.id, lastActiveAt: hoursAgo(2) },
      { projectId: project.id, userId: semaya.id, roleId: member.id, lastActiveAt: hoursAgo(26) },
      { projectId: project.id, userId: megadhana.id, roleId: pelaksana.id, lastActiveAt: hoursAgo(72) },
    ],
  });
  const { tokenHash } = createOneTimeToken();
  await prisma.invitation.create({
    data: {
      projectId: project.id,
      email: 'darmawan@openspace.example',
      roleId: member.id,
      tokenHash,
      expiresAt: day(6),
    },
  });

  // Milestone
  const materi = await prisma.milestone.create({
    data: {
      projectId: project.id,
      name: 'Materi publikasi',
      description: 'All publication materials designed, approved, printed and posted.',
      dueDate: day(3),
      ownerId: nata.id,
    },
  });
  // Milestone kedua masih "Upcoming" (belum ada tugas), seperti pada prototipe.
  await prisma.milestone.create({
    data: {
      projectId: project.id,
      name: 'Laporan kegiatan',
      description: 'Dokumentasi dan laporan akhir kegiatan disusun dan dikirim.',
      dueDate: day(14),
      ownerId: wira.id,
    },
  });

  // Tugas: [judul, deskripsi, status, prioritas, mulai, deadline, milestone, penanggung jawab]
  const rows = [
    ['Brief kegiatan', 'Rangkum tujuan, ruang lingkup, dan pembagian tugas.', 'DONE', 'LOW', -7, -5, null, [wira]],
    ['Konsep kegiatan', 'Rumuskan konsep dan tujuan penyelenggaraan kegiatan.', 'DONE', 'MEDIUM', -6, -4, null, [nata]],
    [
      'Desain poster',
      'Siapkan desain poster untuk publikasi kegiatan.',
      'DONE',
      'MEDIUM',
      -5,
      -3,
      materi,
      [megadhana, semaya],
    ],
    [
      'Rencana anggaran',
      'Susun kebutuhan biaya dan rencana anggaran kegiatan.',
      'DONE',
      'MEDIUM',
      -4,
      -2,
      null,
      [wira],
    ],
    [
      'Persetujuan desain',
      'Periksa dan setujui desain materi publikasi.',
      'IN_PROGRESS',
      'HIGH',
      -3,
      -2,
      materi,
      [wira, nata],
    ],
    [
      'Konfirmasi lokasi',
      'Pastikan lokasi dan fasilitas kegiatan tersedia.',
      'IN_PROGRESS',
      'HIGH',
      -3,
      -1,
      null,
      [semaya],
    ],
    [
      'Koordinasi vendor',
      'Konfirmasikan kebutuhan dan kesiapan vendor.',
      'IN_PROGRESS',
      'MEDIUM',
      -2,
      1,
      null,
      [wira, semaya],
    ],
    [
      'Pencetakan materi',
      'Cetak materi publikasi sesuai desain yang telah disetujui.',
      'TODO',
      'MEDIUM',
      0,
      2,
      materi,
      [nata, megadhana],
    ],
    [
      'Publikasi media sosial',
      'Siapkan publikasi kegiatan melalui kanal media sosial.',
      'TODO',
      'HIGH',
      1,
      3,
      materi,
      [wira, semaya],
    ],
    [
      'Daftar perlengkapan',
      'Catat kebutuhan perlengkapan untuk pelaksanaan kegiatan.',
      'TODO',
      'MEDIUM',
      2,
      4,
      null,
      [semaya],
    ],
    ['Daftar peserta', 'Rapikan daftar peserta dan kebutuhan registrasi.', 'TODO', 'LOW', 3, 5, null, [wira, nata]],
    ['Dokumentasi kegiatan', 'Siapkan kebutuhan dokumentasi kegiatan.', 'TODO', 'LOW', 4, 6, null, [megadhana, semaya]],
  ];

  const t = {};
  let n = 0;
  for (const [title, description, status, priority, s, d, ms, people] of rows) {
    n += 1;
    t[title] = await prisma.task.create({
      data: {
        projectId: project.id,
        number: n,
        title,
        description,
        status,
        priority,
        startDate: day(s),
        dueDate: day(d),
        position: n,
        milestoneId: ms?.id,
        createdById: wira.id,
        completedAt: status === 'DONE' ? day(d) : null,
        assignees: { create: people.map((p) => ({ userId: p.id })) },
      },
    });
  }
  await prisma.project.update({ where: { id: project.id }, data: { taskCounter: n } });

  // Prasyarat: Pencetakan materi menunggu Persetujuan desain (terhambat).
  await prisma.taskPrerequisite.createMany({
    data: [
      { taskId: t['Persetujuan desain'].id, prerequisiteId: t['Desain poster'].id },
      { taskId: t['Pencetakan materi'].id, prerequisiteId: t['Persetujuan desain'].id },
      { taskId: t['Pencetakan materi'].id, prerequisiteId: t['Desain poster'].id },
    ],
  });

  // Komentar dan link
  await prisma.taskComment.createMany({
    data: [
      {
        taskId: t['Pencetakan materi'].id,
        authorId: nata.id,
        body: 'Detail task sudah aku cek. Kita lanjut sesuai rencana.',
        createdAt: hoursAgo(5),
      },
      {
        taskId: t['Pencetakan materi'].id,
        authorId: megadhana.id,
        body: 'Aku bantu cek kesiapan materinya sebelum final.',
        createdAt: hoursAgo(3),
      },
      {
        taskId: t['Persetujuan desain'].id,
        authorId: nata.id,
        body: 'Revisi warna judul sudah diunggah, mohon dicek.',
        createdAt: hoursAgo(20),
      },
    ],
  });
  await prisma.taskLink.createMany({
    data: [
      {
        taskId: t['Publikasi media sosial'].id,
        addedById: semaya.id,
        title: 'Draf caption Instagram',
        url: 'https://docs.google.com/document/d/contoh',
      },
      {
        taskId: t['Desain poster'].id,
        addedById: megadhana.id,
        title: 'File desain poster (Figma)',
        url: 'https://www.figma.com/file/contoh',
      },
    ],
  });

  // Rapat dan action item
  const all = [wira, nata, semaya, megadhana];
  const perencanaan = await prisma.meeting.create({
    data: {
      projectId: project.id,
      title: 'Perencanaan kegiatan',
      date: day(0),
      startTime: '09:00',
      endTime: '10:00',
      location: 'Google Meet',
      notes: `Konsep dan tujuan kegiatan sudah disepakati bersama.\nDesain materi publikasi perlu disetujui sebelum ${short(day(-2))} agar pencetakan tidak terlambat.\nVendor perlengkapan dikonfirmasi paling lambat ${short(day(1))}.`,
      participants: { create: all.map((u) => ({ userId: u.id })) },
    },
  });
  await prisma.actionItem.createMany({
    data: [
      {
        meetingId: perencanaan.id,
        title: 'Rencana anggaran',
        assigneeId: wira.id,
        dueDate: day(-2),
        taskId: t['Rencana anggaran'].id,
      },
      {
        meetingId: perencanaan.id,
        title: 'Koordinasi vendor',
        assigneeId: semaya.id,
        dueDate: day(1),
        taskId: t['Koordinasi vendor'].id,
      },
    ],
  });
  await prisma.meeting.create({
    data: {
      projectId: project.id,
      title: 'Review desain materi',
      date: day(2),
      startTime: '13:00',
      endTime: '13:30',
      location: 'Ruang rapat',
      notes: 'Tinjau hasil revisi poster dan materi media sosial.',
      participants: { create: [wira, megadhana].map((u) => ({ userId: u.id })) },
    },
  });
  await prisma.meeting.create({
    data: {
      projectId: project.id,
      title: 'Evaluasi kegiatan',
      date: day(7),
      startTime: '16:00',
      endTime: '17:00',
      location: 'Ruang rapat',
      participants: { create: [wira, nata].map((u) => ({ userId: u.id })) },
    },
  });

  // ---------- Proyek kedua (belum ada tugas) ----------
  const komunitas = await prisma.project.create({
    data: {
      workspaceId: ws.id,
      ownerId: wira.id,
      name: 'Kegiatan komunitas',
      description: 'Community outreach and volunteer activities',
      color: '#EA580C',
      icon: 'users',
      position: 1,
    },
  });
  const r2 = await createBuiltInRoles(prisma, komunitas.id);
  await prisma.projectMember.createMany({
    data: [{ projectId: komunitas.id, userId: wira.id, roleId: r2.owner.id }],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: wira.id,
        type: 'comment',
        title: 'Komentar baru di Persetujuan desain',
        body: 'Nata: Revisi warna judul sudah diunggah, mohon dicek.',
        link: `/projects/${project.id}/tasks?task=${t['Persetujuan desain'].id}`,
        createdAt: hoursAgo(20),
      },
      {
        userId: wira.id,
        type: 'assign',
        title: 'Anda ditugaskan: Publikasi media sosial',
        body: 'Nata · Penyelenggaraan kegiatan',
        link: `/projects/${project.id}/tasks?task=${t['Publikasi media sosial'].id}`,
        createdAt: hoursAgo(30),
      },
    ],
  });

  console.log(`[seed] Data contoh dibuat. Login: wira@openspace.example / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
