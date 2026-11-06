import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const page = (name) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  plugins: [react()],
  cacheDir: '.vite-cache',
  build: {
    rollupOptions: {
      input: {
        main: page('./index.html'),
        haidou: page('./haidou.html'),
      },
    },
  },
});
