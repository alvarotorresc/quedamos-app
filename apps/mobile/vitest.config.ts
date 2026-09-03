import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [...coverageConfigDefaults.exclude, 'src/test/**'],
      reporter: ['text-summary'],
      // The session store and the API client sit under every screen. Thresholds are the
      // measured coverage minus two points; raise them as the tests grow.
      thresholds: {
        'src/stores/auth.ts': { lines: 86, branches: 73 },
        'src/lib/api.ts': { lines: 91, branches: 64 },
      },
    },
  },
});
