import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'electron/**/*.{ts,cjs}',
        'src/**/*.{ts,tsx}',
        'shared/**/*.ts',
        'scripts/release-version.mjs',
      ],
      exclude: ['**/*.d.ts'],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      reportOnFailure: true,
      thresholds: {
        // Initial whole-project baseline; uncovered UI and Electron entry points stay visible.
        statements: 12,
        branches: 14,
        functions: 7,
        lines: 14,
        'electron/services/{file,session}.service.ts': {
          perFile: true,
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 85,
        },
      },
    },
  },
})
