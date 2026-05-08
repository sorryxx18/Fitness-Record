import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Fitness-Record/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
