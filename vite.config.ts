
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Fix for: [commonjs--resolver] Missing "./v4/core" specifier in "zod" package
      // This maps the deep import used by @hookform/resolvers to the main zod entry point
      'zod/v4/core': 'zod',
    },
  },
  build: {
    // These options help Vite/Rollup handle CommonJS dependencies like @hookform/resolvers
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  // Force optimization of these dependencies to ensure compatibility
  optimizeDeps: {
    include: ['zod', 'react-hook-form', '@hookform/resolvers/zod'],
  },
});
