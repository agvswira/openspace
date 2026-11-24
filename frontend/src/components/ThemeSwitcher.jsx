import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

// Kontrol tersegmentasi Light / Dark / System, dipakai di menu akun dan halaman Settings.
export function ThemeSwitcher({ compact = false }) {
  const { theme, systemTheme, setTheme } = useTheme();
  const sysLabel = systemTheme === 'dark' ? 'Dark' : 'Light';
  return (
    <div className={`segmented ${compact ? 'compact' : ''}`} role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ value, label, Icon }) => {
        const displayTitle = value === 'system' ? `System (currently ${sysLabel})` : label;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            aria-label={displayTitle}
            className={theme === value ? 'active' : ''}
            onClick={() => setTheme(value)}
            title={displayTitle}
          >
            <Icon size={14} aria-hidden="true" />
            {!compact && (value === 'system' ? `System (${sysLabel})` : label)}
          </button>
        );
      })}
    </div>
  );
}

// Tombol cepat di topbar: berganti antara terang dan gelap; bila kembali sama dengan OS, hapus override.
export function ThemeToggleButton() {
  const { resolved, systemTheme, setTheme } = useTheme();
  const dark = resolved === 'dark';
  const toggle = () => {
    const target = dark ? 'light' : 'dark';
    setTheme(target === systemTheme ? 'system' : target);
  };
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
