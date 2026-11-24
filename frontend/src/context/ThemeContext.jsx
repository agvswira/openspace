import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Pilihan tema: 'light', 'dark', atau 'system' (mengikuti pengaturan sistem operasi).
// Pilihan disimpan di localStorage; tema efektif ditulis ke <html data-theme="..."> dan <meta name="color-scheme">.
const STORAGE_KEY = 'openspace-theme';
const ThemeContext = createContext({
  theme: 'system',
  resolved: 'light',
  systemTheme: 'light',
  setTheme: () => {},
});

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)');
const getSystemTheme = () => (media().matches ? 'dark' : 'light');
const resolve = (theme, sys = getSystemTheme()) => (theme === 'system' ? sys : theme);

function syncDocumentTheme(theme, resolved) {
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.content = theme === 'system' ? 'light dark' : theme;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const resolved = resolve(theme, systemTheme);

  useEffect(() => {
    syncDocumentTheme(theme, resolved);
  }, [theme, resolved]);

  // Tema diganti di jendela lain dengan origin sama (tab lain, atau demo di landing page):
  // ikuti pilihan itu di sini juga.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY || e.key === null) setThemeState(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const mq = media();
    const onMediaChange = () => setSystemTheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onMediaChange);
    // Tema diganti di tab lain atau demo di landing page (origin sama): ikuti pilihan itu juga.
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY || e.key === null) setThemeState(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', onMediaChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setTheme = useCallback((next) => {
    // Transisi warna hanya saat pengguna mengganti tema, bukan saat halaman dimuat.
    const root = document.documentElement;
    root.classList.add('theme-anim');
    clearTimeout(window.__themeAnimTimer);
    window.__themeAnimTimer = setTimeout(() => root.classList.remove('theme-anim'), 350);
    setThemeState(next);
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* penyimpanan tidak tersedia: tema tetap berlaku selama sesi */
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, resolved, systemTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
