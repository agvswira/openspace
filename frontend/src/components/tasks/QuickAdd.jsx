import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';

// Tambah tugas cepat: ketik judul lalu Enter. Input tetap terbuka untuk tugas berikutnya,
// Esc atau klik di luar untuk menutup. Judul divalidasi sama seperti formulir lengkap.
export default function QuickAdd({ onSubmit, label = 'Add task', className = '' }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const submit = async () => {
    const t = title.trim();
    if (t.length < 2) return setError('Judul minimal 2 karakter.');
    setBusy(true);
    try {
      await onSubmit(t);
      setTitle('');
      setError('');
    } catch {
      /* pesan penolakan ditampilkan oleh pemanggil */
    } finally {
      setBusy(false);
      // Input sempat dinonaktifkan saat menyimpan; fokus dikembalikan untuk tugas berikutnya.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    return undefined;
  };

  if (!open)
    return (
      <button type="button" className={`quick-add-btn ${className}`} onClick={() => setOpen(true)}>
        <Plus size={14} />
        {label}
      </button>
    );

  return (
    <form
      className={`quick-add ${className}`}
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget) && !title.trim()) setOpen(false);
      }}
    >
      <div className="quick-add-row">
        <input
          ref={inputRef}
          className="input grow"
          name="quick-task-title"
          autoFocus
          enterKeyHint="done"
          placeholder="Task title, then Enter"
          value={title}
          disabled={busy}
          aria-label="Judul tugas baru"
          aria-invalid={!!error}
          onChange={(e) => {
            setTitle(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              submit();
            }
            if (e.key === 'Escape') {
              setOpen(false);
              setTitle('');
              setError('');
            }
          }}
        />
        <button type="submit" className="btn btn-sm btn-primary" disabled={busy || !title.trim()}>
          Add
        </button>
      </div>
      {error && (
        <div className="xs st-OVERDUE" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
