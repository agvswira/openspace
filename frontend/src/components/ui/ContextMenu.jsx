import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Menu klik kanan (context menu) untuk seluruh aplikasi.
 *
 * Pemakaian:
 *   const openMenu = useContextMenu();
 *   <div {...contextMenuProps(openMenu, () => [ { label: 'Edit', icon: Pencil, onSelect: ... } ])}>
 *
 * Item: { label, icon, onSelect, danger, disabled, hint, shortcut, submenu: [...] }
 * Pemisah: { separator: true }   Judul kelompok: { heading: 'Status' }
 *
 * Mouse: klik kanan. Layar sentuh: tekan lama 500 ms. Keyboard: Shift+F10 / tombol Menu
 * pada elemen yang sedang fokus. Di dalam menu: panah atas/bawah, Enter, panah kanan untuk
 * submenu, Esc untuk menutup.
 */
const Ctx = createContext(() => {});

export function ContextMenuProvider({ children }) {
  const [menu, setMenu] = useState(null); // { x, y, items }
  const open = useCallback((x, y, items) => {
    const list = (items || []).filter(Boolean);
    if (list.length) setMenu({ x, y, items: list });
  }, []);
  const close = useCallback(() => setMenu(null), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      {menu && createPortal(<MenuSurface {...menu} onClose={close} />, document.body)}
    </Ctx.Provider>
  );
}

export const useContextMenu = () => useContext(Ctx);

// Props yang dipasang pada elemen pemicu: klik kanan, tekan lama, dan keyboard.
export function contextMenuProps(openMenu, getItems) {
  let timer = null;
  let start = null;
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  return {
    onContextMenu: (e) => {
      e.preventDefault();
      e.stopPropagation();
      cancel();
      openMenu(e.clientX, e.clientY, getItems());
    },
    onKeyDown: (e) => {
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        openMenu(r.left + 12, r.top + r.height / 2, getItems());
      }
    },
    onTouchStart: (e) => {
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
      timer = setTimeout(() => {
        timer = null;
        navigator.vibrate?.(10);
        openMenu(start.x, start.y, getItems());
      }, 500);
    },
    onTouchMove: (e) => {
      const t = e.touches[0];
      if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) cancel();
    },
    onTouchEnd: cancel,
  };
}

function MenuSurface({ x, y, items, onClose, nested = false, parentRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y, ready: false });
  const [active, setActive] = useState(nested ? 0 : -1);
  const [sub, setSub] = useState(null); // { index, x, y }
  const actionable = items.map((it, i) => (!it.separator && !it.heading && !it.disabled ? i : -1)).filter((i) => i >= 0);

  // Geser menu agar tetap di dalam layar.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    let left = x;
    let top = y;
    if (left + w > window.innerWidth - 8) left = nested && parentRef ? x - w - parentRef : window.innerWidth - w - 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
    setPos({ left: Math.max(8, left), top, ready: true });
    el.focus({ preventScroll: true });
  }, [x, y, nested, parentRef]);

  useEffect(() => {
    if (nested) return undefined;
    const onDown = (e) => !e.target.closest?.('.ctx-menu') && onClose();
    const onBlur = () => onClose();
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('touchstart', onDown, true);
    window.addEventListener('resize', onBlur);
    window.addEventListener('blur', onBlur);
    document.addEventListener('scroll', onBlur, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('touchstart', onDown, true);
      window.removeEventListener('resize', onBlur);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('scroll', onBlur, true);
    };
  }, [nested, onClose]);

  const choose = (i) => {
    const it = items[i];
    if (!it || it.disabled || it.separator || it.heading) return;
    if (it.submenu) {
      const r = ref.current.querySelectorAll('[data-idx]')[actionable.indexOf(i)]?.getBoundingClientRect();
      if (r) setSub({ index: i, x: r.right + 2, y: r.top - 4, w: r.width });
      return;
    }
    onClose();
    it.onSelect?.();
  };

  const onKeyDown = (e) => {
    if (sub) return;
    const pos = actionable.indexOf(active);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(actionable[(pos + 1) % actionable.length]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(actionable[(pos - 1 + actionable.length) % actionable.length]);
    } else if (e.key === 'Enter' || e.key === ' ' || (e.key === 'ArrowRight' && items[active]?.submenu)) {
      e.preventDefault();
      if (active >= 0) choose(active);
    } else if (e.key === 'Escape' || (nested && e.key === 'ArrowLeft')) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  };

  let n = -1;
  return (
    <div
      ref={ref}
      className="ctx-menu popover"
      role="menu"
      tabIndex={-1}
      style={{ position: 'fixed', left: pos.left, top: pos.top, visibility: pos.ready ? 'visible' : 'hidden' }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => {
        if (it.separator) return <div key={i} className="menu-sep" role="separator" />;
        if (it.heading)
          return (
            <div key={i} className="menu-label">
              {it.heading}
            </div>
          );
        n += 1;
        const Icon = it.icon;
        return (
          <button
            key={i}
            data-idx={n}
            type="button"
            role="menuitem"
            aria-haspopup={it.submenu ? 'menu' : undefined}
            className={`menu-item ${it.danger ? 'danger' : ''} ${active === i ? 'focus' : ''}`}
            disabled={it.disabled}
            title={it.disabled && it.hint ? it.hint : undefined}
            onMouseEnter={() => {
              setActive(i);
              if (it.submenu) choose(i);
              else setSub(null);
            }}
            onClick={() => choose(i)}
          >
            {Icon ? <Icon size={14} /> : <span style={{ width: 14 }} />}
            <span className="grow truncate">{it.label}</span>
            {it.checked && <span className="ctx-check">✓</span>}
            {it.shortcut && <span className="kbd">{it.shortcut}</span>}
            {it.submenu && <ChevronRight size={14} className="faint" />}
          </button>
        );
      })}
      {sub && items[sub.index]?.submenu && (
        <MenuSurface
          nested
          x={sub.x}
          y={sub.y}
          parentRef={sub.w + 4}
          items={items[sub.index].submenu.map((s) => ({
            ...s,
            onSelect: s.onSelect && (() => {
              onClose();
              s.onSelect();
            }),
          }))}
          onClose={() => {
            setSub(null);
            ref.current?.focus();
          }}
        />
      )}
    </div>
  );
}
