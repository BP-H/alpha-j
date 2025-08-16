import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: { dedupe: ['three'] },      // 👈 keep exactly one three
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react';
            if (id.includes('three')) return 'three';
            return 'vendor';
          }
        },
      },
    },
  },
});
