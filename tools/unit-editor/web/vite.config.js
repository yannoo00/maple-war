import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// dev: `node server.cjs --no-open` 를 켜 두고 `npm run dev` — /api 는 3456 으로 넘긴다.
// build: ../dist 로 내보내면 server.cjs 가 그대로 서빙한다.
export default defineConfig({
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:3456' } },
});
