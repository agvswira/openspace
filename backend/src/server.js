import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';

export async function startServer() {
  await prisma.$connect();
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(config.port, () => {
      console.log(`[api] Openspace API berjalan di http://localhost:${config.port}`);
      resolve(server);
    });
  });
}

// Dijalankan langsung dengan `npm start` (memakai PostgreSQL dari DATABASE_URL).
const entry = (process.argv[1] || '').replaceAll(String.fromCharCode(92), '/');
if (entry.endsWith('src/server.js')) {
  startServer();
}
