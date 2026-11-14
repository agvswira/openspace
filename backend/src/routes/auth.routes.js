import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { badRequest, conflict, unauthorized } from '../lib/http.js';
import { createOneTimeToken, hashToken } from '../lib/tokens.js';
import { sendMail } from '../lib/mailer.js';
import { config } from '../config.js';
import { publicUser } from '../lib/serialize.js';
import { rateLimit } from '../lib/rateLimit.js';

const router = Router();
const emailKey = (req) => req.body.email;

// Batasi tebakan password per akun dan spam email reset per alamat.
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: emailKey,
  message: 'Terlalu banyak percobaan login untuk email ini. Coba lagi dalam 15 menit.',
});
const forgotLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  key: emailKey,
  message: 'Tautan reset sudah dikirim beberapa kali. Coba lagi dalam 1 jam.',
});

const AVATAR_COLORS = ['#2563EB', '#EA580C', '#16A34A', '#9333EA', '#DB2777', '#0891B2'];

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.'),
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  password: z.string().min(8, 'Password minimal 8 karakter.'),
  workspaceName: z.string().trim().min(2, 'Nama workspace minimal 2 karakter.'),
});

// FR-01: pendaftaran sekaligus membuat workspace tim.
router.post('/register', validate(registerSchema), async (req, res) => {
  const { name, email, password, workspaceName } = req.body;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw conflict('Email sudah terdaftar. Silakan login.');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { name, email, passwordHash, avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)] },
    });
    await tx.workspace.create({ data: { name: workspaceName, ownerId: u.id } });
    return u;
  });

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
});

router.post('/login', validate(loginSchema), loginLimit, async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  // Pesan sama untuk email/password salah agar tidak membocorkan email terdaftar.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Email atau password salah.');
  }
  loginLimit.reset(email);
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: req.user.id },
    orderBy: { createdAt: 'asc' },
  });
  const u = req.user;
  res.json({
    user: {
      ...publicUser(u),
      preferences: { notifyAssign: u.notifyAssign, notifyComment: u.notifyComment, notifyDeadline: u.notifyDeadline },
    },
    workspace,
  });
});

// Reset password: token sekali pakai, berlaku 30 menit, dikirim lewat email.
router.post(
  '/forgot-password',
  validate(z.object({ email: z.string().trim().toLowerCase().email('Format email tidak valid.') })),
  forgotLimit,
  async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (user) {
      const { token, tokenHash } = createOneTimeToken();
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
      });
      await sendMail({
        to: user.email,
        subject: 'Reset password Openspace',
        text: `Halo ${user.name},\n\nBuka tautan berikut untuk membuat password baru (berlaku 30 menit):\n${config.clientUrl}/reset-password/${token}`,
      });
    }
    // Respons selalu sama, baik email terdaftar maupun tidak.
    res.json({ message: 'Jika email terdaftar, tautan reset sudah dikirim.' });
  },
);

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Password minimal 8 karakter.'),
});

router.post('/reset-password', validate(resetSchema), async (req, res) => {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(req.body.token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw badRequest('Tautan reset tidak valid, sudah dipakai, atau kedaluwarsa.');
  }
  const passwordHash = await bcrypt.hash(req.body.password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  res.json({ message: 'Password berhasil diperbarui. Silakan login.' });
});

export default router;
