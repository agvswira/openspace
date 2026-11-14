import { HttpError } from '../lib/http.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Endpoint ${req.method} ${req.path} tidak ditemukan.` });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err?.code === 'P2002') {
    return res.status(409).json({ message: 'Data yang sama sudah ada.' });
  }
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
}
