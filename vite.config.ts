import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const lab = mode === 'soloq-lab';
  const standings = mode === 'standings';
  const target = lab ? 'http://127.0.0.1:8082' : standings ? 'http://127.0.0.1:8084' : 'http://localhost:8080';
  return {
  plugins: [react()],
  server: {
    ...(lab ? { host: '127.0.0.1', port: 5174, strictPort: true } : {}),
      ...(standings ? { host: '127.0.0.1', port: 5175, strictPort: true } : {}),
    proxy: {
      '/api': target,
      '/oauth2': target,
      '/login': target,
    },
  },
  };
});
