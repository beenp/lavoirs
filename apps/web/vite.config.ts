import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: 'apps/web',
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT ?? env.API_PORT ?? '3002'}` },
    },
    build: { outDir: '../../dist', emptyOutDir: true },
  };
});
