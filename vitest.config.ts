import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['**/?(*.)+(spec|test).ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage'
    },
    testTimeout: 2000,
    setupFiles: ['./vitest-setup.ts']
  }
});
