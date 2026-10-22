import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Retain the Vite 5 browser baseline when upgrading the build tools.
  build: { target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'] },
  // The custom domain is the canonical root deployment.
  base: '/',
});
