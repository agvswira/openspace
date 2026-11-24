// Bahasa antarmuka: English (bawaan) atau Bahasa Indonesia.
// Teks aplikasi ditulis dalam bahasa Inggris. Saat Bahasa Indonesia dipilih, penerjemah di bawah
// mengganti teks yang tampil di layar (teks, placeholder, title, aria-label) memakai kamus
// dan pola pada id.js. Isi buatan pengguna (judul tugas, nama, catatan) tidak ada di kamus
// sehingga tetap seperti aslinya. Pilihan disimpan di perangkat ini.
import { DICT, FRAGMENTS, MONTHS, PATTERNS, WEEKDAYS } from './id.js';

const KEY = 'openspace-lang';
export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Bahasa Indonesia' },
];

export function getLang() {
  try {
    return localStorage.getItem(KEY) === 'id' ? 'id' : 'en';
  } catch {
    return 'en';
  }
}

// Ganti bahasa langsung di tempat, tanpa memuat ulang halaman (seperti terjemahan Google):
// teks yang tampil diganti saat itu juga dan teks asli bahasa Inggris disimpan untuk dikembalikan.
export function setLang(lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* penyimpanan tidak tersedia: bahasa tetap berlaku sampai halaman ditutup */
  }
  applyLang(lang);
  window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: lang }));
}

export const LANG_EVENT = 'openspace-lang-change';

const DATE_TOKEN = new RegExp(`\\b(${[...Object.keys(MONTHS), ...Object.keys(WEEKDAYS)].join('|')})\\b`, 'g');
const HAS_DATE = /\d|^\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*$/;

export function translate(text) {
  const raw = text;
  const t = raw.trim();
  if (!t || !/[A-Za-z]/.test(t)) return raw;
  let out = DICT[t];
  if (out === undefined) {
    for (const [re, rep] of PATTERNS) {
      if (re.test(t)) {
        out = t.replace(re, rep);
        break;
      }
    }
  }
  if (out === undefined) {
    let fragmented = t;
    for (const [en, id] of FRAGMENTS) fragmented = fragmented.split(en).join(id);
    if (fragmented !== t) out = fragmented;
  }
  // Nama hari dan bulan diterjemahkan pada teks yang berisi tanggal.
  const base = out ?? t;
  if (HAS_DATE.test(base)) {
    const dated = base.replace(DATE_TOKEN, (m) => MONTHS[m] ?? WEEKDAYS[m] ?? m);
    if (dated !== base) out = dated;
  }
  if (out === undefined || out === t) return raw;
  // Pertahankan spasi di awal/akhir karena React sering memecah kalimat menjadi beberapa node teks.
  return raw.replace(t, out);
}

const ATTRS = ['placeholder', 'title', 'aria-label'];
const SKIP = 'script, style, textarea, code, pre, [data-i18n-skip]';

// Teks asli (bahasa Inggris) dari node/atribut yang sudah diterjemahkan.
let originals = new WeakMap(); // Text -> string
let attrOriginals = new WeakMap(); // Element -> { [attr]: string }
let touchedText = new Set();
let touchedAttrs = new Set();
let observer = null;
let titleObserver = null;
let originalTitle = null;

function translateText(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return;
  const current = node.nodeValue;
  const next = translate(current);
  if (next === current) return;
  originals.set(node, current);
  touchedText.add(node);
  node.nodeValue = next;
}

function translateAttr(el, a) {
  const v = el.getAttribute(a);
  if (!v || el.closest(SKIP)) return;
  const next = translate(v);
  if (next === v) return;
  const saved = attrOriginals.get(el) ?? {};
  saved[a] = v;
  attrOriginals.set(el, saved);
  touchedAttrs.add(el);
  el.setAttribute(a, next);
}

function translateTree(node) {
  if (node.nodeType === Node.TEXT_NODE) return translateText(node);
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  ATTRS.forEach((a) => translateAttr(node, a));
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n);
    else ATTRS.forEach((a) => translateAttr(n, a));
  }
}

function translateTitle() {
  const next = translate(document.title);
  if (next !== document.title) {
    originalTitle = document.title;
    document.title = next;
  }
}

function enable() {
  if (observer) return;
  translateTitle();
  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver = new MutationObserver(translateTitle);
    titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }
  translateTree(document.body);
  observer = new MutationObserver((mutations) => {
    // Lepaskan node yang sudah tidak tampil agar daftar tidak terus membesar.
    if (touchedText.size > 4000) touchedText.forEach((n) => n.isConnected || touchedText.delete(n));
    if (touchedAttrs.size > 2000) touchedAttrs.forEach((n) => n.isConnected || touchedAttrs.delete(n));
    for (const m of mutations) {
      if (m.type === 'characterData') translateText(m.target);
      else if (m.type === 'attributes') translateAttr(m.target, m.attributeName);
      else m.addedNodes.forEach(translateTree);
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
}

// Kembali ke bahasa Inggris: hentikan penerjemah lalu pulihkan teks asli yang masih tampil.
function disable() {
  observer?.disconnect();
  titleObserver?.disconnect();
  observer = null;
  titleObserver = null;
  for (const node of touchedText) {
    if (node.isConnected && originals.has(node)) node.nodeValue = originals.get(node);
  }
  for (const el of touchedAttrs) {
    const saved = attrOriginals.get(el);
    if (el.isConnected && saved) Object.entries(saved).forEach(([a, v]) => el.setAttribute(a, v));
  }
  if (originalTitle) document.title = originalTitle;
  originals = new WeakMap();
  attrOriginals = new WeakMap();
  touchedText = new Set();
  touchedAttrs = new Set();
  originalTitle = null;
}

function applyLang(lang) {
  document.documentElement.lang = lang;
  if (lang === 'id') enable();
  else disable();
}

// Dipanggil sekali saat aplikasi dimulai (main.jsx).
export function startTranslation() {
  applyLang(getLang());
}
