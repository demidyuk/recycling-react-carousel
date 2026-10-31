import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

const external = ['react', 'react-dom', 'react/jsx-runtime'];
const thirdPartyNotice = readFileSync(
  resolve(import.meta.dirname, 'THIRD_PARTY_NOTICES.md'),
  'utf8'
).trim();

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin({
      attributes: {
        'data-recycling-react-carousel': 'true',
      },
    }),
  ],
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  build: {
    target: 'es2018',
    sourcemap: true,
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external,
      output: {
        exports: 'named',
        postBanner: `/*!\n${thirdPartyNotice}\n*/`,
      },
    },
  },
});
