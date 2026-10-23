import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward any request starting with /socket.io to the Node server.
      // This means the browser only ever talks to port 5173 in development.
      // In production both live on the same URL so the proxy isn't needed.
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,          // also proxy WebSocket upgrades, not just HTTP
        changeOrigin: true,
      },
    },
  },
});
