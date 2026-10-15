import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const backendTarget = process.env.BACKEND_URL || 'http://127.0.0.1:3000';
  const fastApiTarget = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api/audio': {
          target: fastApiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api/v1': {
          target: fastApiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
