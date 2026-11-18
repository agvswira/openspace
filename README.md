# Openspace

Sistem Manajemen Proyek dan Alur Kerja Terintegrasi. Capstone Project Rekayasa Perangkat Lunak, Kelompok 3, Informatika Universitas Udayana.

| Bagian     | Teknologi                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| Frontend   | React 19, Vite 7, React Router 7, TanStack React Query 5, Axios, Lucide icons                              |
| Backend    | Node.js, Express 5, JSON Web Token, bcryptjs, Zod, Nodemailer                                              |
| Basis data | PostgreSQL (Prisma ORM 6). Untuk pengembangan, PostgreSQL 18 dijalankan otomatis lewat `embedded-postgres` |

## Menjalankan (Windows/macOS/Linux)

Prasyarat: **Node.js 20 atau lebih baru**. PostgreSQL **tidak perlu** diinstal.

```bash
npm run setup
```

```bash
npm run dev
```

Lalu buka **http://localhost:5180**.

`npm run dev` menjalankan dua proses sekaligus:

- `api` (port 4000): menyalakan PostgreSQL bawaan di port 5433, menerapkan migrasi Prisma, mengisi data contoh bila database masih kosong, lalu menjalankan REST API.
- `web` (port 5180): Vite dev server. Permintaan `/api` diteruskan ke port 4000.

### Akun demo

Semua akun memakai password `password123`.

| Email                       | Role di proyek "Penyelenggaraan kegiatan" |
| --------------------------- | ----------------------------------------- |
| wira@openspace.example      | Owner                                     |
| nata@openspace.example      | Koordinator (custom role)                 |
| semaya@openspace.example    | Member                                    |
| megadhana@openspace.example | Pelaksana (custom role)                   |

Login sebagai akun berbeda untuk mencoba pembatasan akses (misalnya Member tidak bisa membuat tugas).

### Perintah lain

| Perintah           | Fungsi                                                 |
| ------------------ | ------------------------------------------------------ |
| `npm run db:reset` | Menghapus database lokal dan mengisi ulang data contoh |
| `npm run build`    | Build frontend untuk produksi (`frontend/dist`)        |
| `npm test`         | Menjalankan 38 uji unit (backend dan frontend)         |
| `npm run lint`     | Memeriksa kode dengan ESLint                           |
| `npm run format`   | Merapikan format seluruh kode dengan Prettier          |

### Memakai PostgreSQL sendiri

Ubah `backend/.env`:

```
USE_EMBEDDED_DB=false
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/openspace?schema=public
```

### Email

Tanpa `SMTP_HOST`, email undangan dan reset password dicetak di terminal `api` sehingga tautannya bisa langsung disalin ke browser.

## Fitur antarmuka tambahan

- **Dark mode**: ikon matahari/bulan di topbar, atau menu akun / Settings → Light, Dark, System.
- **Menu klik kanan** pada tugas, proyek, milestone, rapat, dan anggota (tekan lama di layar sentuh, Shift+F10 di keyboard).
- **Tambah cepat, sembunyikan, hapus dengan Undo, aksi massal, atur kolom, ganti judul langsung** di Board dan List.
- **Timeline**: seret bar untuk menggeser jadwal, seret tepinya untuk mengubah tanggal, tarik titik di ujung bar ke bar lain untuk membuat prasyarat.
- **Tampilan mobile**: navigasi bawah, laci menu, tombol + mengambang, dan panel dari bawah layar.

Pemetaan fitur ke materi RPL dan hasil pengujian ada di `docs/Penerapan-Materi-RPL.md`.

## Struktur

```
openspace/
├── backend/   REST API Express + Prisma
└── frontend/  Aplikasi React (Vite)
```

Penjelasan lengkap ada di `docs/BAB-III-Implementasi.md`.
