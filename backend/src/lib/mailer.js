import nodemailer from 'nodemailer';
import { config } from '../config.js';

const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

// Tanpa SMTP, email dicetak ke terminal agar tautan tetap bisa dicoba saat pengembangan.
export async function sendMail({ to, subject, text }) {
  if (!transporter) {
    console.log(`\n[email] Kepada: ${to}\n[email] Subjek: ${subject}\n${text}\n`);
    return;
  }
  await transporter.sendMail({ from: config.smtp.from, to, subject, text });
}
