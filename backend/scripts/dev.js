// Menjalankan backend untuk pengembangan dengan satu perintah:
// 1) menyalakan PostgreSQL bawaan (embedded-postgres) bila USE_EMBEDDED_DB=true,
// 2) menerapkan migrasi Prisma, 3) mengisi data contoh bila database kosong,
// 4) menjalankan REST API.
import { execSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Clone baru belum punya .env: salin dari .env.example dengan JWT_SECRET acak.
const envFile = path.join(root, '.env');
if (!fs.existsSync(envFile)) {
  const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  fs.writeFileSync(
    envFile,
    example.replace('ganti-dengan-string-acak-yang-panjang', crypto.randomBytes(32).toString('hex')),
  );
  console.log('[dev] File .env dibuat dari .env.example');
}
const dotenv = await import('dotenv');
dotenv.config({ path: envFile });
const args = new Set(process.argv.slice(2));
const useEmbedded = (process.env.USE_EMBEDDED_DB ?? 'true') === 'true';
const port = Number(process.env.EMBEDDED_DB_PORT || 5433);

let pg = null;

const isListening = (p) =>
  new Promise((resolve) => {
    const socket = net.connect(p, '127.0.0.1');
    socket.once('connect', () => resolve(socket.end() || true));
    socket.once('error', () => resolve(false));
  });

async function startEmbeddedDb() {
  process.env.DATABASE_URL = `postgresql://postgres:postgres@localhost:${port}/openspace?schema=public`;
  // Database sudah menyala (misalnya dinyalakan oleh npm run db:studio): pakai yang ada.
  if (!args.has('--reset') && (await isListening(port))) {
    console.log(`[db] Memakai PostgreSQL yang sudah aktif di port ${port}`);
    return;
  }
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dataDir = path.join(root, '.pgdata');
  if (args.has('--reset') && fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
  const fresh = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));

  pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: true,
    onLog: () => {},
  });
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase('openspace');
  process.env.DATABASE_URL = `postgresql://postgres:postgres@localhost:${port}/openspace?schema=public`;
  console.log(`[db] PostgreSQL bawaan aktif di port ${port}${fresh ? ' (database baru dibuat)' : ''}`);
}

async function stop() {
  if (pg) {
    console.log('\n[db] Menghentikan PostgreSQL...');
    await pg.stop().catch(() => {});
  }
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit', env: process.env });

try {
  if (useEmbedded) await startEmbeddedDb();
  run('npx prisma generate');
  run('npx prisma migrate deploy');

  const { prisma } = await import('../src/lib/prisma.js');
  const users = await prisma.user.count();
  if (users === 0 || args.has('--reset')) run('node prisma/seed.js');

  if (args.has('--no-server')) {
    await prisma.$disconnect();
    await stop();
  } else {
    const { startServer } = await import('../src/server.js');
    await startServer();
  }
} catch (err) {
  console.error('[dev] Gagal menjalankan backend:', err.message);
  await stop();
}
