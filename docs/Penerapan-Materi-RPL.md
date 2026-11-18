# **Penerapan Materi Rekayasa Perangkat Lunak pada Openspace**

Dokumen ini memetakan pengembangan lanjutan Openspace (dark mode, tampilan mobile, menu klik kanan, penyempurnaan CRUD, serta penjadwalan dan prasyarat lewat seret di Timeline) ke materi mata kuliah Rekayasa Perangkat Lunak (RPL). Dokumen ini bisa dipakai sebagai bahan Bab IV (pengujian) dan pembahasan laporan capstone.

## **1. Model Proses: Pengembangan Inkremental**

Fitur ditambahkan dalam beberapa inkremen kecil. Setiap inkremen melewati siklus yang sama: analisis kebutuhan, perancangan, implementasi, pengujian di browser, lalu _commit_. Setiap inkremen menghasilkan perangkat lunak yang tetap bisa dijalankan.

**Tabel 1.** Inkremen pengembangan

| Inkremen | Isi                                                                   | Commit                                                         |
| :------: | :-------------------------------------------------------------------- | :------------------------------------------------------------- |
|    0     | _Baseline_: branch `develop` setelah PR #1–#23                        | `Merge pull request #23 ...`                                   |
|    1     | Dark mode (Light / Dark / System)                                     | `feat(theme): dark mode dengan pilihan Light/Dark/System`      |
|    2     | Menu klik kanan, sembunyikan, tambah cepat, aksi massal, Undo         | `feat(ux): menu klik kanan, sembunyikan, tambah cepat, ...`    |
|    3     | Seret bar Timeline untuk jadwal dan tarik garis untuk prasyarat       | `feat(timeline): seret bar untuk jadwal dan tarik garis ...`   |
|    4     | Tampilan responsif ponsel dan tablet                                  | `feat(mobile): tampilan responsif untuk ponsel dan tablet`     |
|    5     | Pengujian unit otomatis dan dokumen ini                               | `test: pengujian unit aturan tugas, izin, dan logika timeline` |
|    6     | Launcher sekali klik untuk Windows                                    | `chore: launcher sekali klik Jalankan-Openspace.bat ...`       |
|    7     | Timeline digeser dengan touchpad, rentang mengikuti tanggal tugas     | `feat(timeline): navigasi tanggal dengan geser touchpad ...`   |
|    8     | Transisi dan animasi mikro, transisi antarhalaman (View Transitions)  | `feat(ui): transisi ...`                                       |
|    9     | Perbaikan 15 temuan pengujian dan review kode (pemeliharaan korektif) | `fix: perbaikan 15 temuan dari pengujian dan review kode`      |
|    10    | Dokumen PDF penjelasan project beserta tangkapan layar fitur          | `docs: PDF penjelasan project dan fitur Openspace ...`         |

Seluruh inkremen di atas dikirim dalam satu branch `feature/fe-ux-improvements` dan satu Pull Request ke `develop`, dengan satu commit untuk setiap perubahan yang utuh (sesuai `CONTRIBUTING.md`). Riwayat inkremen bisa dilihat dengan `git log --oneline`. Pendekatan ini sejalan dengan prinsip Agile: perangkat lunak yang berjalan dikirim sedikit demi sedikit, dan setiap perubahan bisa ditelusuri atau dibatalkan.

## **2. Rekayasa Kebutuhan**

### **2.1 Kebutuhan Fungsional Tambahan**

**Tabel 2.** Kebutuhan fungsional hasil pengembangan lanjutan

| Kode  | Kebutuhan                                                                                                                                       |
| :---- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| FT-01 | Pengguna dapat memilih tema Light, Dark, atau mengikuti sistem. Pilihan diingat di perangkat.                                                   |
| FT-02 | Pengguna dapat membuka menu aksi lewat klik kanan, tekan lama (layar sentuh), atau Shift+F10 pada tugas, proyek, milestone, rapat, dan anggota. |
| FT-03 | Pengguna dapat menambah tugas cepat hanya dengan mengetik judul di kolom Board atau grup List.                                                  |
| FT-04 | Pengguna dapat menyembunyikan tugas tertentu atau semua tugas selesai dari tampilan, lalu menampilkannya lagi.                                  |
| FT-05 | Pengguna dapat menghapus tugas dan membatalkannya (Undo) dalam 6 detik.                                                                         |
| FT-06 | Pengguna dapat memilih banyak tugas di List lalu mengubah status, menyembunyikan, atau menghapus sekaligus.                                     |
| FT-07 | Pengguna dapat mengubah judul tugas langsung di List (klik dua kali) dan menduplikasi tugas.                                                    |
| FT-08 | Pengguna dapat mengatur kolom yang tampil di List.                                                                                              |
| FT-09 | Pengguna dapat menggeser jadwal tugas dengan menyeret bar Timeline dan mengubah tanggal mulai/deadline dengan menyeret tepinya.                 |
| FT-10 | Pengguna dapat membuat prasyarat dengan menarik garis dari satu bar ke bar lain, dan menghapusnya dengan mengklik garis.                        |
| FT-11 | Owner dapat mengarsipkan (menyembunyikan) proyek dari menu proyek, dengan Undo.                                                                 |
| FT-12 | Aplikasi dapat dipakai di layar ponsel (lebar ≥ 360 px) dengan navigasi bawah, laci menu, dan panel bawah.                                      |

### **2.2 Kebutuhan Non-Fungsional**

**Tabel 3.** Kebutuhan non-fungsional dan cara pemenuhannya

| Atribut (ISO/IEC 25010)       | Kebutuhan                                                 | Cara pemenuhan                                                                                          |
| :---------------------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| Usability – operability       | Aksi yang sering dipakai bisa dicapai dengan satu gerakan | Menu klik kanan, tambah cepat, aksi massal, seret di Timeline                                           |
| Usability – error protection  | Kesalahan pengguna bisa dicegah atau dibatalkan           | Undo hapus/sembunyikan/prasyarat, item menu nonaktif disertai alasan, validasi judul minimal 2 karakter |
| Usability – accessibility     | Bisa dipakai dengan keyboard dan pembaca layar            | Menu memakai `role="menu"`, navigasi panah, Esc, Shift+F10; status tetap memakai ikon + teks            |
| Portability – adaptability    | Berjalan di desktop, tablet, dan ponsel                   | CSS responsif (breakpoint 1024 px dan 768 px), target sentuh minimal 40 px                              |
| Security                      | Izin role tetap berlaku untuk interaksi baru              | Semua aksi tetap lewat REST API yang memeriksa RBAC; antarmuka hanya menonaktifkan aksi                 |
| Maintainability – testability | Aturan bisnis bisa diuji tanpa browser dan database       | Logika murni dipisah ke `taskRules.js`, `serialize.js`, `permissions.js`, `taskGuards.js`               |

## **3. Perancangan**

### **3.1 Arsitektur Berlapis Tetap Dipertahankan**

Fitur baru tidak menambah jalur akses data baru. Semua perubahan tetap melewati lapisan yang sama: komponen antarmuka → hook aksi (`useTaskActions`) → lapisan API (`api/client.js`) → REST API → middleware RBAC dan validasi → Prisma → PostgreSQL. Dengan begitu aturan bisnis yang sudah diuji (misalnya deteksi siklus prasyarat) otomatis berlaku juga untuk interaksi seret di Timeline.

### **3.2 Prinsip Desain yang Diterapkan**

- **_Separation of concerns_.** Logika murni (aturan hapus, perhitungan geser jadwal) ada di `frontend/src/lib/taskGuards.js`, terpisah dari komponen React. Logika ini bisa diuji unit.
- **_Don't Repeat Yourself_ (DRY).** Satu hook `useTaskActions` menyediakan aksi tugas untuk menu klik kanan, tombol "...", aksi massal, tombol Delete, dan Timeline. Satu komponen `ContextMenu` dipakai di semua halaman.
- **_Single source of truth_.** Keempat tampilan tugas tetap membaca cache React Query yang sama. Setelah sebuah aksi berhasil, cache di-_invalidate_ sehingga semua tampilan ikut diperbarui.
- **Pola Provider (Context).** `ThemeProvider` dan `ContextMenuProvider` dipasang sekali di akar aplikasi, lalu dipakai lewat hook `useTheme()` dan `useContextMenu()`.
- **_Design token_.** Semua warna adalah variabel CSS. Tema gelap cukup mengganti nilai token di `:root[data-theme='dark']`, jadi komponen tidak perlu diubah satu per satu.

### **3.3 Perancangan Antarmuka: Delapan Aturan Emas Shneiderman**

**Tabel 4.** Penerapan aturan emas desain antarmuka

| Aturan                                 | Penerapan pada fitur baru                                                                                           |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| Konsistensi                            | Isi menu klik kanan sama dengan tombol "..."; gaya menu sama di semua halaman                                       |
| Pintasan untuk pengguna berpengalaman  | Klik kanan, Shift+F10, Enter untuk membuka, Delete untuk menghapus, klik dua kali untuk ganti judul                 |
| Umpan balik yang informatif            | Toast setelah setiap aksi; tooltip tanggal saat menyeret bar; garis biru saat menarik prasyarat                     |
| Dialog yang memberi penutupan          | Aksi massal menampilkan jumlah tugas yang berhasil dan alasan tugas yang gagal                                      |
| Pencegahan kesalahan                   | Item menu yang tidak diizinkan dinonaktifkan dengan alasan; tanggal mulai tidak bisa melewati deadline saat diseret |
| Pembalikan aksi yang mudah             | Undo untuk hapus, sembunyikan, arsip proyek, dan prasyarat baru                                                     |
| Pengguna memegang kendali              | Esc membatalkan seretan dan menutup menu; tugas tersembunyi bisa ditampilkan lagi kapan saja                        |
| Mengurangi beban ingatan jangka pendek | Tooltip menjelaskan hasil seretan ("BAB 2 will wait for MATERI BAB 1"); petunjuk singkat di bawah Timeline          |

Fitur seret di Timeline adalah contoh **manipulasi langsung** (_direct manipulation_): objek (bar tugas) terlihat, aksinya fisik (menyeret), dan hasilnya langsung tampak serta bisa dibatalkan.

## **4. Implementasi dan Manajemen Konfigurasi**

- Setiap inkremen menjadi satu _commit_ dengan pesan berformat _Conventional Commits_ (`feat(...)`, `test`, `chore`).
- Kode dirapikan dengan Prettier dan diperiksa dengan ESLint. Keduanya lolos tanpa galat (`npm run lint`, `npx prettier --check .`).
- Build produksi berhasil (`npm run build`).

## **5. Pengujian**

### **5.1 Pengujian Unit (White-Box)**

Pengujian unit memakai _test runner_ bawaan Node.js (`node:test`), jadi tidak perlu dependensi tambahan. Jalankan dengan:

```bash
npm test
```

**Tabel 5.** Rangkuman pengujian unit

| Berkas uji                         | Unit yang diuji                                                                               | Teknik                                                                                                                            | Jumlah kasus |
| :--------------------------------- | :-------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :----------: |
| `backend/test/taskRules.test.js`   | `isOverdue`, `startOfToday`, `waitingFor`, `isBlocked`, `progressOf`, `findCyclePath`         | Nilai batas (deadline hari ini vs kemarin), partisi ekuivalen (Done/belum), jalur graf (linear, bercabang, siklus 2 dan 3 simpul) |      15      |
| `backend/test/permissions.test.js` | Katalog izin, `createBuiltInRoles`                                                            | _Test double_ (transaksi palsu tanpa database)                                                                                    |      5       |
| `backend/test/serialize.test.js`   | `publicUser`, `serializeTask`                                                                 | Pemeriksaan keluaran, termasuk kebocoran `passwordHash`                                                                           |      7       |
| `frontend/test/taskGuards.test.js` | `deleteBlocker`, `spanOf`, `shiftSpan`, `scheduleBody`, `orderForStatus`, `bulkDeleteBlocker` | Nilai batas (seret melewati deadline/tanggal mulai), partisi mode seret, urutan topologis rantai prasyarat                        |      16      |
| **Total**                          |                                                                                               |                                                                                                                                   |    **43**    |

Hasil terakhir: **43 lulus, 0 gagal**.

### **5.2 Pengujian Black-Box**

Pengujian dijalankan di browser terhadap aplikasi yang berjalan (`npm run dev`) dengan akun demo `nata@openspace.example` (role Koordinator). Data uji dibuat lalu dihapus kembali sehingga data contoh tidak berubah.

**Tabel 6.** Skenario dan hasil pengujian black-box

| No  | Skenario                                                                | Hasil yang diharapkan                                                                           | Hasil  |
| :-: | :---------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- | :----: |
|  1  | Klik ikon matahari/bulan di topbar                                      | Tema berganti terang/gelap dan pilihan tetap setelah halaman dimuat ulang                       | Sesuai |
|  2  | Pilih Light/Dark/System di menu akun dan di Settings                    | Tema mengikuti pilihan; System mengikuti pengaturan sistem operasi                              | Sesuai |
|  3  | Buka menu akun di dasar sidebar                                         | Menu terbuka ke atas dan tidak terpotong                                                        | Sesuai |
|  4  | Klik kanan kartu tugas di Board                                         | Muncul 9 aksi; menu digeser agar tidak keluar layar                                             | Sesuai |
|  5  | Arahkan ke "Status" di menu klik kanan dekat tepi kanan layar           | Submenu tampil di sisi kiri, status saat ini bertanda centang                                   | Sesuai |
|  6  | Klik kanan area kosong kolom Board                                      | Muncul aksi "New task in In progress…"                                                          | Sesuai |
|  7  | Ketik judul di "Add task" kolom To do lalu Enter                        | Tugas dibuat di To do, input tetap terbuka untuk tugas berikutnya                               | Sesuai |
|  8  | Hapus tugas dari menu klik kanan lalu klik Undo                         | Tugas hilang, toast Undo muncul; setelah Undo tugas kembali dan tidak terhapus                  | Sesuai |
|  9  | Fokus kartu tugas lalu tekan Delete, tunggu 6 detik                     | Tugas benar-benar terhapus dari database                                                        | Sesuai |
| 10  | Pilih 2 tugas di List lalu klik Hide                                    | 2 tugas tersembunyi, muncul bilah "2 tasks hidden · Show hidden"                                | Sesuai |
| 11  | Klik "Show hidden"                                                      | Semua tugas tampil lagi                                                                         | Sesuai |
| 12  | Klik dua kali judul tugas di List, ubah, Enter                          | Judul tersimpan dan toast "Judul diperbarui" tampil                                             | Sesuai |
| 13  | Matikan kolom Milestone lewat menu Columns                              | Kolom Milestone hilang dari tabel, bisa ditampilkan lagi                                        | Sesuai |
| 14  | Klik kanan proyek di sidebar sebagai non-Owner                          | Menu tampil; "Archive (hide)" nonaktif karena bukan Owner                                       | Sesuai |
| 15  | Seret bar tugas di Timeline 1 hari ke kanan                             | Mulai dan deadline bergeser 1 hari; toast "Jadwal diperbarui"                                   | Sesuai |
| 16  | Tarik titik di ujung bar "Daftar peserta" ke bar "Dokumentasi kegiatan" | Prasyarat dibuat, garis putus-putus muncul, toast dengan Undo                                   | Sesuai |
| 17  | Klik garis prasyarat lalu "Remove dependency"                           | Hubungan dihapus dan garis hilang                                                               | Sesuai |
| 18  | Tarik prasyarat yang membentuk siklus (BAB 2 → MATERI BAB 1)            | Ditolak dengan pesan "Hubungan ini membentuk siklus: MATERI BAB 1 → BAB 2 → MATERI BAB 1."      | Sesuai |
| 19  | Buka semua halaman pada lebar 375 px                                    | Tidak ada konten yang melebar keluar layar (12 halaman diperiksa)                               | Sesuai |
| 20  | Buka menu, laci navigasi, detail tugas, dan form New task di 375 px     | Laci tertutup otomatis saat pindah halaman; detail layar penuh; form tampil sebagai panel bawah | Sesuai |
| 21  | Tekan lama / klik kanan kartu tugas di 375 px                           | Menu tampil sebagai panel dari bawah layar dengan latar gelap                                   | Sesuai |

## **6. Pemeliharaan Perangkat Lunak**

**Tabel 7.** Jenis pemeliharaan pada pengembangan lanjutan

| Jenis     | Contoh                                                                                                                            |
| :-------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| Korektif  | Menu akun di dasar sidebar sebelumnya terbuka ke bawah dan terpotong; sekarang dibalik ke atas otomatis.                          |
| Adaptif   | Tampilan disesuaikan untuk ponsel dan tablet; tema mengikuti pengaturan gelap/terang sistem operasi.                              |
| Perfektif | Menu klik kanan, tambah cepat, aksi massal, Undo, dan seret di Timeline mempercepat pekerjaan pengguna.                           |
| Preventif | Logika dipisah ke modul murni dan diberi 43 uji unit sehingga perubahan berikutnya bisa langsung diuji ulang (_regression test_). |

## **7. Cara Mencoba**

1. `npm run dev`, lalu buka http://localhost:5180 dan login dengan akun demo (password `password123`).
2. Dark mode: ikon matahari/bulan di topbar, atau menu akun → Theme.
3. Menu klik kanan: klik kanan kartu tugas, baris List, bar Timeline, proyek di sidebar, kartu milestone, rapat, atau baris anggota.
4. Timeline: buka Tasks → Timeline, seret bar, seret tepinya, atau tarik titik bulat di ujung bar ke bar lain.
5. Mobile: perkecil jendela browser (≤ 768 px) atau buka DevTools → _Toggle device toolbar_.
6. Pengujian unit: `npm test`.
