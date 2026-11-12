// Galat HTTP dengan kode status dan alasan yang dapat ditampilkan ke pengguna.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Silakan login terlebih dahulu.') => new HttpError(401, msg);
export const forbidden = (msg = 'Anda tidak memiliki izin untuk tindakan ini.') => new HttpError(403, msg);
export const notFound = (msg = 'Data tidak ditemukan.') => new HttpError(404, msg);
export const conflict = (msg, details) => new HttpError(409, msg, details);
