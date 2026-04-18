
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './index.html',
    },
  },
  optimizeDeps: {
    include: ['zod', 'react-hook-form', '@hookform/resolvers/zod', 'date-fns', 'lucide-react', 'jspdf', 'jspdf-autotable'],
  },
});
