// Membuka Prisma Studio untuk melihat isi database.
// Bila PostgreSQL bawaan belum menyala (npm run dev tidak sedang berjalan),
// database dinyalakan dulu agar Prisma Studio tidak menampilkan tabel kosong.
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const useEmbedded = (process.env.USE_EMBEDDED_DB ?? 'true') === 'true';
const port = Number(process.env.EMBEDDED_DB_PORT || 5433);

const isListening = (p) =>
  new Promise((resolve) => {
    const socket = net.connect(p, '127.0.0.1');
    socket.once('connect', () => resolve(socket.end() || true));
    socket.once('error', () => resolve(false));
  });

let pg = null;
if (useEmbedded && !(await isListening(port))) {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  pg = new EmbeddedPostgres({
    databaseDir: path.join(root, '.pgdata'),
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: true,
    onLog: () => {},
  });
  await pg.start();
  console.log(`[db] PostgreSQL dinyalakan di port ${port} untuk Prisma Studio`);
}
if (useEmbedded) process.env.DATABASE_URL = `postgresql://postgres:postgres@localhost:${port}/openspace?schema=public`;

const studioPort = process.env.STUDIO_PORT || '5555';
const studio = spawn('npx', ['prisma', 'studio', '--port', studioPort, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

async function stop() {
  studio.kill();
  if (pg) await pg.stop().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
studio.on('exit', stop);
