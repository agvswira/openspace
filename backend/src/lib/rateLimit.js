import { HttpError } from './http.js';

// Pembatas jumlah request per kunci (misalnya email) dalam satu jendela waktu, disimpan di memori.
// Kunci berbasis email dipakai karena di balik proxy hosting banyak pengguna bisa terlihat ber-IP sama.
// Cukup untuk satu instance server; hitungan hilang saat server restart.
export function rateLimit({ windowMs, max, key, message }) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of hits) if (entry.resetAt <= now) hits.delete(k);
  }, windowMs).unref();

  const middleware = (req, res, next) => {
    const k = key(req);
    if (!k) return next();
    const now = Date.now();
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new HttpError(429, message);
    }
    next();
  };
  // Mengosongkan hitungan, misalnya setelah login berhasil.
  middleware.reset = (k) => hits.delete(k);
  return middleware;
}
