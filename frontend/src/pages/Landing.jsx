import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  ChartGantt,
  ChevronDown,
  CircleCheck,
  Diamond,
  FolderPlus,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Lock,
  LogIn,
  Moon,
  MousePointerClick,
  ShieldCheck,
  Smartphone,
  Sun,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import '../landing.css';

const VIEWS = [
  { icon: Kanban, label: 'Board' },
  { icon: ListTodo, label: 'List' },
  { icon: CalendarDays, label: 'Calendar' },
  { icon: ChartGantt, label: 'Timeline' },
];

const ROLES = [
  { name: 'Owner', note: 'Semua akses, atur peran dan anggota' },
  { name: 'Koordinator', note: 'Kelola tugas, milestone, dan rapat' },
  { name: 'Member', note: 'Melihat dan mengikuti progres' },
  { name: 'Pelaksana', note: 'Memperbarui tugas miliknya' },
];

const STEPS = [
  {
    n: '01',
    icon: FolderPlus,
    tag: 'Proyek',
    title: 'Buat proyek',
    text: 'Beri nama, warna, dan tenggat. Pembuat proyek otomatis menjadi Owner.',
  },
  {
    n: '02',
    icon: UserPlus,
    tag: 'Tim',
    title: 'Undang tim',
    text: 'Kirim undangan lewat email dan pilih peran setiap anggota.',
  },
  {
    n: '03',
    icon: ChartGantt,
    tag: 'Rencana',
    title: 'Susun tugas',
    text: 'Atur tanggal, penanggung jawab, dan prasyarat langsung di Timeline.',
  },
  {
    n: '04',
    icon: LayoutDashboard,
    tag: 'Pantau',
    title: 'Pantau progres',
    text: 'Overview menunjukkan tugas terlambat, terhambat, dan beban kerja.',
  },
];

const FAQ = [
  {
    q: 'Apa itu Openspace?',
    a: 'Aplikasi manajemen proyek untuk tim kecil seperti kepanitiaan atau kerja kelompok. Tugas, milestone, rapat, dan anggota ada dalam satu ruang kerja.',
  },
  {
    q: 'Apa yang terjadi kalau sebuah tugas harus menunggu tugas lain?',
    a: 'Hubungkan keduanya sebagai prasyarat dengan menarik garis di Timeline. Selama prasyaratnya belum selesai, tugas itu berstatus Blocked dan tidak bisa dimulai. Prasyarat yang melingkar ditolak otomatis.',
  },
  {
    q: 'Bagaimana hak akses diatur?',
    a: 'Setiap proyek punya peran Owner, Koordinator, Member, dan Pelaksana, atau peran buatan sendiri. Izin diperiksa di server, jadi aksi yang tidak diizinkan tetap ditolak walau tombolnya dipaksa dari browser.',
  },
  {
    q: 'Apakah bisa dipakai di ponsel?',
    a: 'Bisa. Tampilan menyesuaikan layar ponsel dengan navigasi bawah, dan menu aksi muncul dengan tekan lama pada kartu tugas.',
  },
  {
    q: 'Apakah ada tema gelap?',
    a: 'Ada. Pilih Terang, Gelap, atau ikuti pengaturan sistem. Pilihan disimpan di perangkat.',
  },
  {
    q: 'Siapa yang membuat Openspace?',
    a: 'Kelompok 3 sebagai proyek capstone mata kuliah Rekayasa Perangkat Lunak, dikembangkan dengan model Agile Prototyping.',
  },
];

// Demo interaktif: aplikasi asli berjalan dalam mode demo (data contoh, baca-saja) di dalam iframe.
// Di layar lebar dirender selebar desktop lalu diperkecil agar tampilannya sama dengan aplikasi;
// di layar sempit memakai tampilan ponsel aplikasi.
const DEMO_W = 1280;
const DEMO_H = 800;
const DEMO_START = '/demo/projects/cmwm7vjjj0001vmawq71scs7a/tasks?view=timeline';

function DemoWindow() {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const compact = width > 0 && width < 720;
  const scale = compact ? 1 : width / DEMO_W;

  return (
    <figure className="lp-window">
      <div className="lp-window-bar">
        <i aria-hidden />
        <i aria-hidden />
        <i aria-hidden />
        <span className="lp-window-title">Demo interaktif · hanya untuk dilihat</span>
      </div>
      <div
        className={`lp-demo ${compact ? 'compact' : ''}`}
        ref={boxRef}
        style={width ? { height: compact ? 640 : DEMO_H * scale } : undefined}
      >
        {width > 0 && (
          <iframe
            title="Demo interaktif Openspace"
            src={DEMO_START}
            style={compact ? undefined : { width: DEMO_W, height: DEMO_H, transform: `scale(${scale})` }}
          />
        )}
      </div>
      <figcaption className="lp-demo-note">
        <MousePointerClick size={15} />
        Coba langsung: klik menu, tab, dan tugas. Ini demo, jadi perubahan tidak disimpan.
      </figcaption>
    </figure>
  );
}

function ThemeButton() {
  const { resolved, setTheme } = useTheme();
  const dark = resolved === 'dark';
  return (
    <button
      type="button"
      className="lp-icon-btn"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Gunakan tema terang' : 'Gunakan tema gelap'}
      title={dark ? 'Tema terang' : 'Tema gelap'}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

// Ilustrasi kecil Timeline: tiga bar berurutan dengan garis prasyarat putus-putus berpanah.
function MiniTimeline() {
  return (
    <svg className="lp-mini-tl" viewBox="0 0 320 132" role="img" aria-label="Contoh rantai prasyarat di Timeline">
      <defs>
        <marker id="lp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M1 1 L9 5 L1 9 z" className="lp-mini-arrow" />
        </marker>
      </defs>
      <path d="M118 24 H140 V64 H152" className="lp-mini-link" markerEnd="url(#lp-arrow)" />
      <path d="M232 64 H252 V104 H264" className="lp-mini-link" markerEnd="url(#lp-arrow)" />
      <rect x="8" y="12" width="118" height="24" rx="7" className="lp-bar bar-done" />
      <text x="20" y="28" className="lp-bar-text">
        Desain poster
      </text>
      <rect x="152" y="52" width="88" height="24" rx="7" className="lp-bar bar-progress" />
      <text x="164" y="68" className="lp-bar-text">
        Persetujuan
      </text>
      <rect x="264" y="92" width="52" height="24" rx="7" className="lp-bar bar-blocked" />
      <text x="276" y="108" className="lp-bar-text">
        Cetak
      </text>
    </svg>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const primary = user ? { to: '/', label: 'Buka Openspace' } : { to: '/signup', label: 'Mulai sekarang' };

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <Link to="/welcome" className="lp-brand" aria-label="Openspace, beranda">
            <img src="/logo.png" alt="" height="28" />
            Openspace
          </Link>
          <nav className="lp-links" aria-label="Bagian halaman">
            <a href="#fitur">Fitur</a>
            <a href="#cara-kerja">Cara kerja</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="lp-nav-actions">
            <ThemeButton />
            {user ? (
              <Link to="/" className="lp-btn lp-btn-light">
                Buka aplikasi
                <ArrowRight size={16} />
              </Link>
            ) : (
              <Link to="/signin" className="lp-btn lp-btn-light">
                <LogIn size={16} />
                Masuk
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero lp-wrap">
          <h1 className="lp-title">
            Kenalan dengan
            <span className="lp-title-logo" aria-hidden>
              <img src="/logo.png" alt="" />
            </span>
            Openspace
          </h1>
          <p className="lp-lead">
            Tugas, milestone, rapat, dan anggota tim dalam satu ruang kerja. Atur siapa mengerjakan apa, tugas mana yang
            harus menunggu, dan pantau semuanya sampai selesai.
          </p>
          <div className="lp-cta">
            <Link to={primary.to} className="lp-btn lp-btn-light lp-btn-lg">
              {primary.label}
              <ArrowRight size={17} />
            </Link>
            {!user && (
              <Link to="/signin" className="lp-btn lp-btn-dark lp-btn-lg">
                <LogIn size={17} />
                Masuk
              </Link>
            )}
          </div>

          <DemoWindow />
        </section>

        <section id="fitur" className="lp-section lp-wrap">
          <h2 className="lp-h2">Apa yang Openspace lakukan</h2>
          <p className="lp-sub">Satu aplikasi untuk merencanakan, membagi, dan memantau pekerjaan tim.</p>

          <div className="lp-bento">
            <article className="lp-card lp-span-2">
              <div className="lp-views">
                {VIEWS.map(({ icon: Icon, label }) => (
                  <span key={label} className="lp-chip">
                    <Icon size={14} />
                    {label}
                  </span>
                ))}
              </div>
              <div className="lp-kanban" aria-hidden>
                {[
                  ['To do', 'k-todo', ['Konfirmasi lokasi', 'Daftar peserta']],
                  ['In progress', 'k-progress', ['Persetujuan desain']],
                  ['Done', 'k-done', ['Brief kegiatan', 'Desain poster']],
                ].map(([name, tone, cards]) => (
                  <div key={name} className="lp-kcol">
                    <span className={`lp-khead ${tone}`}>{name}</span>
                    {cards.map((c) => (
                      <span key={c} className="lp-kcard">
                        {c}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <h3>Satu data, empat tampilan</h3>
              <p>
                Board untuk alur harian, List untuk mengubah banyak tugas sekaligus, Calendar per hari, dan Timeline
                untuk jadwal.
              </p>
            </article>

            <article className="lp-card lp-card-accent">
              <MiniTimeline />
              <h3>Prasyarat yang dijaga otomatis</h3>
              <p>
                Tarik garis antartugas di Timeline. Tugas yang prasyaratnya belum selesai otomatis{' '}
                <span className="lp-inline-lock">
                  <Lock size={12} /> Blocked
                </span>
                .
              </p>
            </article>

            <article className="lp-card">
              <ul className="lp-roles">
                {ROLES.map((r) => (
                  <li key={r.name}>
                    <ShieldCheck size={15} />
                    <b>{r.name}</b>
                    <span>{r.note}</span>
                  </li>
                ))}
              </ul>
              <h3>Hak akses per peran</h3>
              <p>Setiap orang hanya bisa melakukan apa yang diizinkan perannya. Izin diperiksa di server.</p>
            </article>

            <article className="lp-card">
              <div className="lp-ms" aria-hidden>
                <div className="lp-ms-row">
                  <Diamond size={14} className="lp-purple" />
                  <b>Materi publikasi</b>
                  <span className="lp-ms-n">3/4</span>
                </div>
                <span className="lp-progress">
                  <span style={{ width: '75%' }} />
                </span>
                <div className="lp-ms-row lp-ms-item">
                  <CircleCheck size={14} className="lp-green" />
                  Hasil rapat: cetak 200 brosur
                  <ArrowRight size={13} />
                  <span className="lp-chip lp-chip-sm">Tugas</span>
                </div>
              </div>
              <h3>Milestone dan rapat</h3>
              <p>Kelompokkan tugas ke milestone, lalu jadikan action item rapat sebagai tugas terjadwal.</p>
            </article>

            <article className="lp-card">
              <div className="lp-stats" aria-hidden>
                <span>
                  <b className="lp-red">Terlambat</b>
                  <em>Tugas lewat tenggat</em>
                </span>
                <span>
                  <b className="lp-amber">Blocked</b>
                  <em>Menunggu prasyarat</em>
                </span>
                <span>
                  <b className="lp-green">Selesai</b>
                  <em>Progres per milestone</em>
                </span>
              </div>
              <h3>Overview untuk koordinator</h3>
              <p>Lihat risiko jadwal dan beban kerja tiap anggota tanpa bertanya satu per satu.</p>
            </article>

            <article className="lp-card lp-span-3 lp-card-split">
              <div>
                <h3>Di laptop maupun ponsel</h3>
                <p>
                  Tampilan menyesuaikan layar: navigasi bawah dan menu tekan lama di ponsel, menu klik kanan di laptop.
                  Pilih tema terang atau gelap kapan saja.
                </p>
                <div className="lp-views">
                  <span className="lp-chip">
                    <Smartphone size={14} />
                    Ponsel
                  </span>
                  <span className="lp-chip">
                    <Sun size={14} />
                    Terang
                  </span>
                  <span className="lp-chip">
                    <Moon size={14} />
                    Gelap
                  </span>
                  <span className="lp-chip">
                    <Users size={14} />
                    Kolaborasi tim
                  </span>
                </div>
              </div>
              <div className="lp-phone" aria-hidden>
                <span className="lp-phone-notch" />
                <span className="lp-phone-line w60" />
                <span className="lp-phone-card" />
                <span className="lp-phone-card short" />
                <span className="lp-phone-card" />
                <span className="lp-phone-nav">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </article>
          </div>
        </section>

        <section id="cara-kerja" className="lp-section lp-wrap">
          <h2 className="lp-h2">Mulai dalam empat langkah</h2>
          <p className="lp-sub">Dari proyek kosong sampai tim bekerja dengan jadwal yang jelas.</p>
          <ol className="lp-steps">
            {STEPS.map(({ icon: Icon, ...s }) => (
              <li key={s.n} className="lp-card lp-step">
                <span className="lp-step-head">
                  <span>{s.tag}</span>
                  <span className="lp-step-n">{s.n} / 04</span>
                </span>
                <span className="lp-step-icon" aria-hidden>
                  <Icon size={22} />
                </span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" className="lp-section lp-wrap lp-faq-wrap">
          <div>
            <h2 className="lp-h2">Pertanyaan</h2>
            <p className="lp-sub">Jawaban singkat tentang cara kerja Openspace.</p>
          </div>
          <div className="lp-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <ChevronDown size={18} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-section lp-wrap">
          <div className="lp-final">
            <img src="/logo.png" alt="" height="56" />
            <h2 className="lp-h2">Susun proyek pertamamu</h2>
            <p className="lp-sub">Buat proyek, undang tim, dan lihat semua pekerjaan dalam satu tempat.</p>
            <div className="lp-cta">
              <Link to={primary.to} className="lp-btn lp-btn-light lp-btn-lg">
                {primary.label}
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer lp-wrap">
        <span>© 2026 Openspace · Kelompok 3, Capstone Rekayasa Perangkat Lunak</span>
        <span className="lp-footer-links">
          <Link to="/signin">Masuk</Link>
          <Link to="/signup">Daftar</Link>
        </span>
      </footer>
    </div>
  );
}
