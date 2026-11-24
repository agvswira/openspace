import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Permintaan /api diteruskan ke REST API Express agar frontend dan backend satu origin saat pengembangan.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: { '/api': 'http://localhost:4000' },
  },
});
