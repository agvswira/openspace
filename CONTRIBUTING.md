# Panduan Kontribusi Openspace

Repo ini monorepo: `backend/` (Express + Prisma) dan `frontend/` (React + Vite) ada dalam satu repositori.

## Pembagian tugas

| Anggota | Peran                     | Area kode                                                                                                                                                                            |
| ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Orang 1 | Backend dan ketua repo    | `backend/` (prisma, middleware, lib, routes, scripts) dan file konfigurasi di root                                                                                                   |
| Orang 2 | Frontend core dan auth    | `frontend/package.json`, `main.jsx`, `App.jsx`, `styles.css`, `api/`, `context/`, `lib/`, `components/ui/`, `components/layout/`, `pages/AuthPages.jsx`, `Home.jsx`, `Settings.jsx` |
| Orang 3 | Frontend tugas            | `pages/Tasks.jsx`, `pages/MyTasks.jsx`, `components/tasks/`                                                                                                                          |
| Orang 4 | Frontend manajemen proyek | `pages/Overview.jsx`, `Milestones.jsx`, `Meetings.jsx`, `Members.jsx`, `Roles.jsx`, `components/InviteModal.jsx`                                                                     |

Kalau perlu mengubah file milik anggota lain, kabari pemiliknya dulu dan minta dia me-review PR-nya.

## Branch

```
main      versi stabil, hanya diisi lewat merge dari develop
develop   tempat menggabungkan semua fitur
feature/* satu branch per fitur, dibuat dari develop
```

Contoh nama branch: `feature/be-database`, `feature/be-auth`, `feature/be-api`, `feature/fe-core`, `feature/fe-auth`, `feature/fe-tasks`, `feature/fe-project`.

`main` dan `develop` diproteksi. Perubahan hanya masuk lewat Pull Request.

## Persiapan pertama kali

```bash
git clone https://github.com/<org>/openspace.git
cd openspace
git config user.name "Nama Lengkap"
git config user.email "email-yang-terdaftar-di-github@example.com"
npm run setup
```

Email harus sama dengan email akun GitHub supaya commit tercatat di profil kontributor.

## Alur kerja

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nama-fitur
# ... kerjakan, commit bertahap ...
git push -u origin feature/nama-fitur
```

Lalu buka Pull Request ke `develop` di GitHub. Minimal satu anggota lain me-review sebelum di-merge.

Sebelum membuka PR, pastikan:

```bash
git pull origin develop   # ambil perubahan terbaru, selesaikan konflik bila ada
npm run lint
npm run format:check
```

## Pesan commit

Format: `tipe(area): deskripsi singkat`

| Tipe       | Dipakai untuk                         |
| ---------- | ------------------------------------- |
| `feat`     | fitur baru                            |
| `fix`      | perbaikan bug                         |
| `refactor` | ubah struktur tanpa ubah perilaku     |
| `style`    | tampilan/CSS atau format kode         |
| `docs`     | dokumentasi                           |
| `chore`    | konfigurasi, dependensi               |

Contoh: `feat(tasks): tambah tampilan kalender`, `fix(auth): token reset kedaluwarsa tidak ditolak`.

Satu commit untuk satu perubahan yang utuh. Hindari satu commit besar berisi seluruh fitur.

## Urutan merge awal

1. Backend: `be-database`, lalu `be-auth`, lalu `be-api`
2. `fe-core` (komponen UI, API client, layout dipakai halaman lain)
3. `fe-auth`, `fe-tasks`, `fe-project`

Setelah semua masuk ke `develop` dan `npm run dev` berjalan normal, `develop` di-merge ke `main`.

## Yang tidak boleh di-commit

- `backend/.env` (pakai `backend/.env.example` sebagai contoh)
- `node_modules/`, `frontend/dist/`, `backend/.pgdata/`
