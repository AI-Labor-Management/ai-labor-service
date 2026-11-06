/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  define: mode === 'api' ? { 'import.meta.env.VITE_STORAGE_ADAPTER': JSON.stringify('api') } : {},
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:8787' } } },
  // Routes share domain/UI modules; individual screens load only when needed.
  build: { chunkSizeWarningLimit: 500 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
