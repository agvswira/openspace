import 'dotenv/config';

// Di produksi JWT_SECRET wajib diisi; nilai cadangan hanya untuk pengembangan lokal.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET wajib diisi pada lingkungan produksi.');
}

export const config = {
  // API_PORT dari .env didahulukan karena PORT sering terisi oleh tool lain saat pengembangan.
  // Di layanan hosting seperti Render, API_PORT tidak diisi sehingga PORT dari hosting yang dipakai.
  port: Number(process.env.API_PORT || process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5180',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'Openspace <no-reply@openspace.local>',
  },
};
