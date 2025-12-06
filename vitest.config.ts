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
        // MCP server and tools require MCP client integration to test
        'src/mcp/server.ts',
        'src/mcp/tools.ts',
        // linter.ts and fetcher.ts have process-spawning code tested via E2E.
        // Excluding from unit test coverage - E2E tests provide the coverage.
        'src/linter.ts',
        'src/remote/fetcher.ts',
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
