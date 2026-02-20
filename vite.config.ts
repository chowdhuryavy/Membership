
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Removed specific zod alias that causes 'instanceof' errors in browser bundling
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    include: ['zod', 'react-hook-form', '@hookform/resolvers/zod', 'date-fns'],
  },
});
