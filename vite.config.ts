import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicy } from './scripts/security-policy.mjs';

// https://vitejs.dev/config/
export default defineConfig(({ mode, command, isPreview }) => {
  const isRyuseigaiDev = mode === 'ryuseigai-dev';
  if (isRyuseigaiDev && (command !== 'serve' || isPreview)) {
    throw new Error('Use npm run dev:ryuseigai to start the local development server.');
  }

  const supabaseUrl = isRyuseigaiDev ? '' : loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL;
  const csp = contentSecurityPolicy(supabaseUrl || '', command === 'serve', mode === 'e2e');
  return {
    ...(isRyuseigaiDev && {
      envDir: false as const,
      envPrefix: [],
      define: { 'import.meta.env.VITE_ADMIN_PASSWORD': JSON.stringify('ryuseigai-local-only') },
      server: { host: '127.0.0.1', port: 5190, strictPort: true },
    }),
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
