import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Pilihan tema: 'light', 'dark', atau 'system' (mengikuti pengaturan sistem operasi).
// Pilihan disimpan di localStorage; tema efektif ditulis ke <html data-theme="...">.
const STORAGE_KEY = 'openspace-theme';
const ThemeContext = createContext({ theme: 'system', resolved: 'light', setTheme: () => {} });

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)');
const resolve = (theme) => (theme === 'system' ? (media().matches ? 'dark' : 'light') : theme);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);
  const [resolved, setResolved] = useState(() => resolve(readStored()));

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
    const apply = () => {
      const r = resolve(theme);
      setResolved(r);
      document.documentElement.dataset.theme = r;
    };
    apply();
    if (theme !== 'system') return undefined;
    const mq = media();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

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

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
