import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.PORT) || 5747,
    proxy: {
      '/api': { target: 'http://localhost:3747', changeOrigin: true }
    }
  }
});
