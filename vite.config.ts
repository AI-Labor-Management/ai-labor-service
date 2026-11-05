/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: false },
  // rules.json(69KB)과 전체 화면이 한 번들에 들어가 600KB대. 라우트별 코드 분할은 후속 과제(HANDOFF.md).
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
