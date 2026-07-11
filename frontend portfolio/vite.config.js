import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api to the Node backend so the frontend can call relative URLs.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
