import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000, // Integration tests may take longer
    // Run e2e test files sequentially to avoid Docker image conflicts
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        // CLI entry point and command files are tested via E2E tests
        // They contain Commander action handlers that call process.exit()
        'src/cli/index.ts',
        'src/cli/commands/**',
        // MCP module is tested via E2E tests (requires MCP client integration)
        'src/mcp/**',
        // Linter execution code is tested via E2E tests (process-spawning)
        'src/linter/command.ts',
        'src/linter/fix.ts',
        'src/linter/runners.ts',
        // Remote fetcher has process-spawning code tested via E2E
        'src/remote/fetcher.ts',
        // Utility functions used by E2E-tested code
        'src/utils/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
