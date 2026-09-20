import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const openCvVersion=require('@techstark/opencv-js/package.json').version;

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (command === 'build' && (url || key)) {
    let validUrl = false;
    try {
      validUrl = ['http:', 'https:'].includes(new URL(url).protocol);
    } catch { /* Reject missing, masked or malformed build configuration. */ }
    if (!validUrl || !key || /redacted|masked|^\*+$/i.test(key)) {
      throw new Error('Invalid public Supabase build configuration. Set VITE_SUPABASE_URL and a public key; masked values cannot be deployed.');
    }
  }
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {output: {assetFileNames: asset =>
        asset.names?.includes('opencv.js') || asset.name==='opencv.js'
          ? `vendor/opencv-${openCvVersion}.js` : 'assets/[name]-[hash][extname]'}}
    }
  };
});
