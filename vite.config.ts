import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicy } from './scripts/security-policy.mjs';

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const csp = contentSecurityPolicy(env.VITE_SUPABASE_URL || '', command === 'serve', mode === 'e2e');
  return {
    plugins: [react(), {
      name: 'security-policy',
      transformIndexHtml: { order: 'pre', handler: () => [{
        tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend',
      }] },
    }],
    // Keep fonts as same-origin files so CSP does not need data: fonts.
    build: { target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'], assetsInlineLimit: 0 },
    base: '/',
  };
});
