/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app deploys to GitHub Pages at https://ricschuster.github.io/SCP_tutorial/,
// so built assets are served from that sub-path. Local dev uses '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/SCP_tutorial/' : '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    // The exact solver imports the default `glpk.js` (browser worker) build.
    // Under Vitest there is no browser worker, so use the synchronous Node build
    // instead; both expose the same factory and model shape.
    alias: { 'glpk.js': 'glpk.js/node' },
    coverage: {
      provider: 'v8',
      // The pure prioritization engine is where correctness lives; hold it to a
      // bar. UI is covered by lighter smoke tests.
      include: ['src/engine/**/*.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
}));
