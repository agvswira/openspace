import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter, createPath } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { ContextMenuProvider } from './components/ui/ContextMenu';
import App from './App';
import { api } from './api/client';
import { DEMO_BASE, IS_DEMO, installDemo } from './demo/demoMode';
import './styles.css';

// React Query menyimpan data server di cache client dan memuat ulang setelah mutasi.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
});

// Data router: dibutuhkan agar perpindahan halaman bisa memakai View Transitions API.
// Seluruh rute tetap didefinisikan di App.jsx (<Routes>), router ini hanya pembungkusnya.
// Mode demo berjalan di bawah /demo agar semua tautan aplikasi tetap berada di dalam iframe demo.
const router = createBrowserRouter([{ path: '*', element: <App /> }], IS_DEMO ? { basename: DEMO_BASE } : undefined);
const withBase = (path) => (IS_DEMO && path.startsWith('/') ? DEMO_BASE + path : path);

// Perpindahan halaman (path berubah) memakai crossfade singkat. Ganti tampilan tugas (?view=)
// dan perubahan kecil seperti membuka panel detail (?task=) tidak, karena cukup area tampilannya
// saja yang memudar (lihat .view-swap). Dilewati bila browser tidak mendukung atau pengguna
// memilih "kurangi animasi".
const baseNavigate = router.navigate.bind(router);
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Pengaman: bila browser tidak sempat menggambar frame (mis. tab/panel tersembunyi), transisi
// dilewati setelah 1 detik agar navigasi tidak pernah tertahan.
if (document.startViewTransition) {
  const start = document.startViewTransition.bind(document);
  document.startViewTransition = (arg) => {
    const t = start(arg);
    const guard = setTimeout(() => t.skipTransition(), 1000);
    // Transisi yang dilewati menolak promise ready/finished (AbortError): itu wajar, abaikan.
    t.ready.catch(() => {});
    t.finished.catch(() => {}).finally(() => clearTimeout(guard));
    return t;
  };
}
router.navigate = (to, opts) => {
  if (typeof to === 'number' || !document.startViewTransition || reduceMotion()) return baseNavigate(to, opts);
  const next = new URL(withBase(typeof to === 'string' ? to : createPath(to ?? {})), window.location.href);
  const cur = new URL(window.location.href);
  const bigChange = next.pathname !== cur.pathname;
  return baseNavigate(to, bigChange ? { viewTransition: true, ...opts } : opts);
};

// Mode demo memasang adapter data contoh dulu (fixture dimuat terpisah, hanya untuk /demo).
(IS_DEMO ? installDemo(api) : Promise.resolve()).then(() =>
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ContextMenuProvider>
                <RouterProvider router={router} />
              </ContextMenuProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  ),
);
