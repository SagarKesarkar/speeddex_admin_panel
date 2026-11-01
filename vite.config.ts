/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const LIVE_API = 'https://speeddex-backend-8ppa-one.vercel.app';

// The console is served by the API's own Vercel deployment at /admin, so it
// talks to the API on the same origin: no CORS, and no tokens sent elsewhere.
// In development, Vite forwards /v1 to an API:
//   npm run dev        -> local API on http://localhost:8080
//   npm run dev:live   -> the deployed API
// or set the API_PROXY environment variable to any other API.
export default defineConfig(({ mode }) => {
  const target = process.env.API_PROXY ?? (mode === 'live' ? LIVE_API : 'http://localhost:8080');
  return {
    base: '/admin/',
    plugins: [react()],
    build: {
      outDir: '../Backend/public/admin',
      emptyOutDir: true,
      sourcemap: false,
    },
    server: {
      port: 5173,
      open: '/admin/',
      proxy: { '/v1': { target, changeOrigin: true, secure: true } },
    },
    test: { include: ['src/**/*.test.ts'] },
  };
});
