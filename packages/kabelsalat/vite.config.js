import { defineConfig } from 'vite';
import { resolve } from 'path';
import bundleAudioWorkletPlugin from 'vite-plugin-bundle-audioworklet';
import { dependencies } from './package.json';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [bundleAudioWorkletPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'kabelsalat.mjs'),
      formats: ['es'],
      fileName: (ext) => ({ es: 'kabelsalat.mjs' })[ext],
    },
    rollupOptions: {
      external: [...Object.keys(dependencies)],
    },
    target: 'esnext',
  },
});
