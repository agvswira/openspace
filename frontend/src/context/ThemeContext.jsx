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
