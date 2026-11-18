import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter, createPath } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { ContextMenuProvider } from './components/ui/ContextMenu';
import App from './App';
import './styles.css';

// React Query menyimpan data server di cache client dan memuat ulang setelah mutasi.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
});

// Data router: dibutuhkan agar perpindahan halaman bisa memakai View Transitions API.
// Seluruh rute tetap didefinisikan di App.jsx (<Routes>), router ini hanya pembungkusnya.
const router = createBrowserRouter([{ path: '*', element: <App /> }]);

// Setiap perpindahan halaman (path berubah) atau ganti tampilan tugas (?view=) memakai transisi
// halus. Perubahan kecil seperti membuka panel detail (?task=) tidak, karena panel punya animasi
// sendiri. Dilewati bila browser tidak mendukung atau pengguna memilih "kurangi animasi".
const baseNavigate = router.navigate.bind(router);
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Pengaman: bila browser tidak sempat menggambar frame (mis. tab/panel tersembunyi), transisi
// dilewati setelah 1 detik agar navigasi tidak pernah tertahan.
if (document.startViewTransition) {
  const start = document.startViewTransition.bind(document);
  document.startViewTransition = (arg) => {
    const t = start(arg);
    const guard = setTimeout(() => t.skipTransition(), 1000);
    t.finished.finally(() => clearTimeout(guard)).catch(() => {});
    return t;
  };
}
router.navigate = (to, opts) => {
  if (typeof to === 'number' || !document.startViewTransition || reduceMotion()) return baseNavigate(to, opts);
  const next = new URL(typeof to === 'string' ? to : createPath(to ?? {}), window.location.href);
  const cur = new URL(window.location.href);
  const bigChange = next.pathname !== cur.pathname || next.searchParams.get('view') !== cur.searchParams.get('view');
  return baseNavigate(to, bigChange ? { viewTransition: true, ...opts } : opts);
};

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
);
