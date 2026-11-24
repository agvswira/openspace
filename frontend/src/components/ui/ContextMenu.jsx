import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

// Di layar ponsel (<= 768 px, sama dengan breakpoint CSS), menu tampil sebagai panel dari bawah
// layar (bottom sheet, Figma M Proto). Tablet yang lebih lebar memakai menu melayang biasa.
const isSheet = () => window.matchMedia('(max-width: 768px)').matches;

// Status tekan lama disimpan per elemen (bukan di variabel render) agar tidak hilang saat
// komponen di-render ulang di tengah sentuhan, mis. saat timeline digeser.
const press = new WeakMap();
const LONG_PRESS_MS = 500;

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
  const returnFocus = useRef(null);
  const open = useCallback((x, y, items) => {
    const list = (items || []).filter(Boolean);
    if (!list.length) return;
    returnFocus.current = document.activeElement;
    setMenu({ x, y, items: list });
  }, []);
  const close = useCallback(() => {
    setMenu(null);
    // Fokus kembali ke elemen pemicu (keyboard tetap di tempat yang sama setelah menu ditutup).
    const el = returnFocus.current;
    const active = document.activeElement;
    if (el?.focus && document.contains(el) && (active === document.body || active?.closest?.('.ctx-menu')))
      el.focus({ preventScroll: true });
  }, []);
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
  const cancel = (el) => {
    const st = press.get(el);
    if (st) clearTimeout(st.timer);
  };
  return {
    onContextMenu: (e) => {
      e.preventDefault();
      e.stopPropagation();
      cancel(e.currentTarget);
      // Tekan lama sudah membuka menu (beberapa browser juga mengirim contextmenu): jangan dobel.
      if (press.get(e.currentTarget)?.fired) return;
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
      // Pemicu terdalam (mis. kartu tugas) mengklaim sentuhan; pemicu luar (kolom) mengabaikannya.
      if (e.nativeEvent.__ctxClaimed) return;
      e.nativeEvent.__ctxClaimed = true;
      const el = e.currentTarget;
      cancel(el);
      const t = e.touches[0];
      const st = { x: t.clientX, y: t.clientY, fired: false, timer: null };
      st.timer = setTimeout(() => {
        st.fired = true;
        navigator.vibrate?.(10);
        openMenu(st.x, st.y, getItems());
      }, LONG_PRESS_MS);
      press.set(el, st);
    },
    onTouchMove: (e) => {
      const st = press.get(e.currentTarget);
      const t = e.touches[0];
      if (st && !st.fired && Math.hypot(t.clientX - st.x, t.clientY - st.y) > 10) clearTimeout(st.timer);
    },
    onTouchEnd: (e) => {
      const st = press.get(e.currentTarget);
      if (!st) return;
      clearTimeout(st.timer);
      if (st.fired) e.preventDefault(); // tekan lama: klik setelahnya diabaikan
      press.delete(e.currentTarget);
    },
    onTouchCancel: (e) => {
      cancel(e.currentTarget);
      press.delete(e.currentTarget);
    },
  };
}

// Hook praktis: bind(getItems) menghasilkan props pemicu; tanpa getItems tidak ada menu.
export function useMenuBinder() {
  const openMenu = useContextMenu();
  return (getItems) => (getItems ? contextMenuProps(openMenu, getItems) : {});
}

// Tombol "..." yang membuka menu yang sama dengan klik kanan, tepat di bawah tombol.
export function MoreButton({ getItems, label = 'Menu', size = 16, className = 'icon-btn' }) {
  const openMenu = useContextMenu();
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-haspopup="menu"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        openMenu(r.right - 210, r.bottom + 4, getItems());
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
    >
      <MoreHorizontal size={size} />
    </button>
  );
}

const supportsPopover = typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'popover');

function MenuSurface({ x, y, items: rawItems, onClose, nested = false, parentRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y, ready: false });
  const [active, setActive] = useState(nested ? 0 : -1);
  const [sub, setSub] = useState(null); // { index, x, y }
  const [sheet] = useState(isSheet);
  // Submenu di mode sheet tampil menimpa panel induk, dengan tombol Back di atasnya.
  const items = sheet && nested ? [{ label: 'Back', icon: ChevronLeft }, { separator: true }, ...rawItems] : rawItems;
  const actionable = items
    .map((it, i) => (!it.separator && !it.heading && !it.disabled ? i : -1))
    .filter((i) => i >= 0);

  // Geser menu agar tetap di dalam layar, lalu promosikan ke Top Layer bila didukung.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (supportsPopover) {
      try {
        if (!el.matches(':popover-open')) el.showPopover();
      } catch {
        /* abaikan bila sudah terbuka */
      }
    }
    if (sheet) {
      el.focus({ preventScroll: true });
      return () => {
        if (supportsPopover && el.matches?.(':popover-open')) {
          try {
            el.hidePopover();
          } catch {
            /* abaikan */
          }
        }
      };
    }
    const { offsetWidth: w, offsetHeight: h } = el;
    let left = x;
    let top = y;
    if (left + w > window.innerWidth - 8) left = nested && parentRef ? x - w - parentRef : window.innerWidth - w - 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
    setPos({ left: Math.max(8, left), top, ready: true });
    el.focus({ preventScroll: true });
    return () => {
      if (supportsPopover && el.matches?.(':popover-open')) {
        try {
          el.hidePopover();
        } catch {
          /* abaikan */
        }
      }
    };
  }, [x, y, nested, parentRef, sheet]);

  useEffect(() => {
    if (nested) return undefined;
    const onDown = (e) => !e.target.closest?.('.ctx-menu') && onClose();
    const onBlur = () => onClose();
    // Scroll di luar menu menutup menu melayang; panel bawah (sheet) tetap terbuka saat
    // isinya di-scroll atau keyboard ponsel mengubah ukuran layar.
    const onScroll = (e) => !sheet && !e.target.closest?.('.ctx-menu') && onClose();
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('touchstart', onDown, true);
    if (!sheet) window.addEventListener('resize', onBlur);
    window.addEventListener('blur', onBlur);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('touchstart', onDown, true);
      window.removeEventListener('resize', onBlur);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [nested, onClose, sheet]);

  const choose = (i) => {
    const it = items[i];
    if (!it || it.disabled || it.separator || it.heading) return;
    if (it.submenu) {
      const r = ref.current.querySelector(`[data-i="${i}"]`)?.getBoundingClientRect();
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
      setActive(
        pos < 0 ? actionable[actionable.length - 1] : actionable[(pos - 1 + actionable.length) % actionable.length],
      );
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

  return (
    <>
      {sheet && !nested && <div className="ctx-backdrop" />}
      <div
        ref={ref}
        className={`ctx-menu popover ${sheet ? 'sheet' : ''}`}
        role="menu"
        tabIndex={-1}
        {...(supportsPopover ? { popover: 'manual' } : {})}
        style={
          sheet
            ? undefined
            : { position: 'fixed', left: pos.left, top: pos.top, visibility: pos.ready ? 'visible' : 'hidden' }
        }
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
          const Icon = it.icon;
          return (
            <button
              key={i}
              data-i={i}
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
              onSelect:
                s.onSelect &&
                (() => {
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
    </>
  );
}
