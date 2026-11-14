// Mengisi katalog izin di database. Dijalankan saat build di Vercel, karena di sana
// startServer() tidak dipanggil sehingga katalog tidak terisi otomatis.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { ensurePermissionCatalog } from '../src/lib/permissions.js';

try {
  await ensurePermissionCatalog(prisma);
  console.log('[permissions] Katalog izin sudah sinkron.');
} finally {
  await prisma.$disconnect();
}
