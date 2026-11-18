import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

// Kontrol tersegmentasi Light / Dark / System, dipakai di menu akun dan halaman Settings.
export function ThemeSwitcher({ compact = false }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={`segmented ${compact ? 'compact' : ''}`} role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          className={theme === value ? 'active' : ''}
          onClick={() => setTheme(value)}
          title={label}
        >
          <Icon size={14} />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}

// Tombol cepat di topbar: berganti antara terang dan gelap.
export function ThemeToggleButton() {
  const { resolved, setTheme } = useTheme();
  const dark = resolved === 'dark';
  return (
    <button
      className="icon-btn"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
