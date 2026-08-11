import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages project site: /ari-no-ana-neo/
  // ローカル開発・E2E はルート (./) で動作
  base: process.env.GITHUB_ACTIONS ? '/ari-no-ana-neo/' : './',
});
