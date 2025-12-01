/**
 * E2E tests for `cmc context` command
 */

import { describe, it, expect } from 'vitest';
import { runInDocker } from './docker-runner.js';
import { dockerAvailable, images, setupImages } from './setup.js';

// Setup: Build required images
setupImages([
  'context/no-language/single',
  'context/no-language/multiple',
  'context/no-language/missing',
]);

// =============================================================================
// Context: stdout output
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc context - stdout', () => {
  it('outputs template content to stdout', async () => {
    const result = await runInDocker(images['context/no-language/single'], ['context', '--stdout']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TypeScript Coding Standards');
    expect(result.stdout).toContain('NEVER use `var`');
  }, 30000);

  it('concatenates multiple templates', async () => {
    const result = await runInDocker(images['context/no-language/multiple'], [
      'context',
      '--stdout',
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TypeScript Coding Standards');
    expect(result.stdout).toContain('Python Coding Standards');
  }, 30000);
});

// =============================================================================
// Context: Template content verification (community-assets)
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc context - template content', () => {
  describe('typescript-strict template', () => {
    it('includes variable declaration rules', async () => {
      const result = await runInDocker(images['context/no-language/single'], [
        'context',
        '--stdout',
      ]);

      expect(result.stdout).toContain('### Variable Declarations');
      expect(result.stdout).toContain('NEVER use `var`');
      expect(result.stdout).toContain('Prefer `const` over `let`');
    }, 30000);

    it('includes type safety rules', async () => {
      const result = await runInDocker(images['context/no-language/single'], [
        'context',
        '--stdout',
      ]);

      expect(result.stdout).toContain('### Type Safety');
      expect(result.stdout).toContain('NEVER use `any` type');
      expect(result.stdout).toContain('explicit return types');
      expect(result.stdout).toContain('strict null checks');
    }, 30000);

    it('includes equality rules', async () => {
      const result = await runInDocker(images['context/no-language/single'], [
        'context',
        '--stdout',
      ]);

      expect(result.stdout).toContain('### Equality');
      expect(result.stdout).toContain('strict equality (`===` and `!==`)');
    }, 30000);

    it('includes error handling rules', async () => {
      const result = await runInDocker(images['context/no-language/single'], [
        'context',
        '--stdout',
      ]);

      expect(result.stdout).toContain('### Error Handling');
      expect(result.stdout).toContain('Never swallow errors silently');
    }, 30000);

    it('includes import rules', async () => {
      const result = await runInDocker(images['context/no-language/single'], [
        'context',
        '--stdout',
      ]);

      expect(result.stdout).toContain('### Imports');
      expect(result.stdout).toContain('ES module imports');
      expect(result.stdout).toContain('Sort imports');
    }, 30000);
  });

  describe('python-prod template', () => {
    it('includes import rules', async () => {
      const result = await runInDocker(images['context/no-language/multiple'], [
        'context',
        '--stdout',
      ]);

      expect(result.stdout).toContain('Remove all unused imports');
      expect(result.stdout).toContain('Sort imports in the standard order');
      expect(result.stdout).toContain('absolute imports over relative imports');
    }, 30000);

    it('includes code style rules', async () => {
      const result = await runInDocker(images['context/no-language/multiple'], [
        'context',
        '--stdout',
      ]);

      expect(result.stdout).toContain('### Code Style');
      expect(result.stdout).toContain('Maximum line length: 120 characters');
      expect(result.stdout).toContain('f-strings for string formatting');
      expect(result.stdout).toContain('modern Python syntax (3.10+)');
    }, 30000);

    it('includes type hint rules', async () => {
      const result = await runInDocker(images['context/no-language/multiple'], [
        'context',
        '--stdout',
      ]);

      expect(result.stdout).toContain('### Type Hints');
      expect(result.stdout).toContain('type hints to all function signatures');
      expect(result.stdout).toContain('from __future__ import annotations');
    }, 30000);

    it('includes Python error handling rules', async () => {
      const result = await runInDocker(images['context/no-language/multiple'], [
        'context',
        '--stdout',
      ]);

      expect(result.stdout).toContain('specific with exception types');
      expect(result.stdout).toContain('context managers');
    }, 30000);

    it('includes naming convention rules', async () => {
      const result = await runInDocker(images['context/no-language/multiple'], [
        'context',
        '--stdout',
      ]);

      expect(result.stdout).toContain('### Naming');
      expect(result.stdout).toContain('snake_case');
      expect(result.stdout).toContain('PascalCase');
      expect(result.stdout).toContain('SCREAMING_SNAKE_CASE');
    }, 30000);
  });

  describe('multiple templates concatenation', () => {
    it('includes both TypeScript and Python headers', async () => {
      const result = await runInDocker(images['context/no-language/multiple'], [
        'context',
        '--stdout',
      ]);

      expect(result.stdout).toContain('## TypeScript Coding Standards');
      expect(result.stdout).toContain('## Python Coding Standards');
    }, 30000);

    it('preserves order: TypeScript first, Python second', async () => {
      const result = await runInDocker(images['context/no-language/multiple'], [
        'context',
        '--stdout',
      ]);

      const tsIndex = result.stdout.indexOf('TypeScript Coding Standards');
      const pyIndex = result.stdout.indexOf('Python Coding Standards');

      expect(tsIndex).toBeLessThan(pyIndex);
    }, 30000);
  });
});

// =============================================================================
// Context: Target file output
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc context - target files', () => {
  it('appends to CLAUDE.md for --target claude', async () => {
    const result = await runInDocker(images['context/no-language/single'], [
      'context',
      '--target',
      'claude',
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Appended context to CLAUDE.md');
  }, 30000);

  it('appends to .cursorrules for --target cursor', async () => {
    const result = await runInDocker(images['context/no-language/single'], [
      'context',
      '--target',
      'cursor',
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Appended context to .cursorrules');
  }, 30000);

  it('appends to .github/copilot-instructions.md for --target copilot', async () => {
    const result = await runInDocker(images['context/no-language/single'], [
      'context',
      '--target',
      'copilot',
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Appended context to .github/copilot-instructions.md');
  }, 30000);
});

// =============================================================================
// Context: Error handling
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc context - error handling', () => {
  it('exits with error when no templates configured', async () => {
    const result = await runInDocker(images['context/no-language/missing'], [
      'context',
      '--stdout',
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('No ai-context templates configured');
  }, 30000);

  it('exits with error for invalid target', async () => {
    const result = await runInDocker(images['context/no-language/single'], [
      'context',
      '--target',
      'invalid',
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Invalid target');
  }, 30000);

  it('exits with error when no target or stdout specified', async () => {
    const result = await runInDocker(images['context/no-language/single'], ['context']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Either --target or --stdout must be specified');
  }, 30000);
});

// =============================================================================
// Context: Help text
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc context - help', () => {
  it('shows help with available targets', async () => {
    const result = await runInDocker(images['context/no-language/single'], ['context', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--target');
    expect(result.stdout).toContain('--stdout');
  }, 30000);
});
