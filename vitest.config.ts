import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'recycling-react-carousel': resolve(import.meta.dirname, 'src/index.ts'),
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    env: { RTL_SKIP_AUTO_CLEANUP: 'true' },
    setupFiles: ['./test-config/setupTests.ts'],
    exclude: ['e2e/**', '**/node_modules/**', 'dist/**'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/index.ts', '**/index.ts'],
    },
  },
});
