/**
 * E2E tests for `cmc check` command
 */

import { describe, it, expect } from 'vitest';
import { runInDocker } from './docker-runner.js';
import { dockerAvailable, images, setupImages, type JsonOutput } from './setup.js';

// Setup: Build required images
setupImages([
  'check/typescript/default',
  'check/python/default',
  'check/typescript-and-python/default',
  'check/python/no-ruff',
  'check/typescript/no-eslint',
  'check/typescript/subdirectory',
  'check/config-errors/no-config',
  'check/config-errors/invalid-toml',
  'check/config-errors/missing-name',
]);

// =============================================================================
// Check: ESLint (TypeScript/JavaScript)
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc check - ESLint', () => {
  it('detects ESLint violations and exits 1', async () => {
    const result = await runInDocker(images['check/typescript/default'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(output.violations.some((v) => v.rule === 'no-var')).toBe(true);
    expect(output.violations.every((v) => v.linter === 'eslint')).toBe(true);
  }, 30000);

  it('includes line and column in violations', async () => {
    const result = await runInDocker(images['check/typescript/default'], [
      'check',
      'violation.ts',
      '--json',
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.violations.length).toBeGreaterThan(0);
    expect(output.violations[0].line).toBeTypeOf('number');
    expect(output.violations[0].column).toBeTypeOf('number');
  }, 30000);

  it('exits 0 for clean files', async () => {
    const result = await runInDocker(images['check/typescript/default'], [
      'check',
      'clean.ts',
      '--json',
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.violations.length).toBe(0);
    expect(output.summary.files_checked).toBe(1);
  }, 30000);
});

// =============================================================================
// Check: Ruff (Python)
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc check - Ruff', () => {
  it('detects Ruff violations and exits 1', async () => {
    const result = await runInDocker(images['check/python/default'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(output.violations.some((v) => v.rule === 'F401')).toBe(true);
    expect(output.violations.every((v) => v.linter === 'ruff')).toBe(true);
  }, 30000);

  it('exits 0 for clean Python files', async () => {
    const result = await runInDocker(images['check/python/default'], [
      'check',
      'clean.py',
      '--json',
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.violations.length).toBe(0);
  }, 30000);
});

// =============================================================================
// Check: Mixed-language projects
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc check - mixed language', () => {
  it('detects violations from both ESLint and Ruff', async () => {
    const result = await runInDocker(images['check/typescript-and-python/default'], [
      'check',
      '--json',
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    const ruffViolations = output.violations.filter((v) => v.linter === 'ruff');
    const eslintViolations = output.violations.filter((v) => v.linter === 'eslint');

    expect(ruffViolations.length).toBeGreaterThan(0);
    expect(eslintViolations.length).toBeGreaterThan(0);
  }, 30000);

  it('checks all files in project', async () => {
    const result = await runInDocker(images['check/typescript-and-python/default'], [
      'check',
      '--json',
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    // 2 .ts + 2 .py files (config files are ignored)
    expect(output.summary.files_checked).toBe(4);
  }, 30000);

  it('can filter to specific file', async () => {
    const result = await runInDocker(images['check/typescript-and-python/default'], [
      'check',
      'violation.py',
      '--json',
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.summary.files_checked).toBe(1);
    expect(output.violations.every((v) => v.linter === 'ruff')).toBe(true);
  }, 30000);
});

// =============================================================================
// Check: Graceful degradation
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc check - graceful degradation', () => {
  it('skips Python files when Ruff unavailable', async () => {
    const result = await runInDocker(images['check/python/no-ruff'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.violations.length).toBe(0);
    expect(result.stderr).toContain('Ruff not found');
  }, 30000);

  it('skips TypeScript files when ESLint unavailable', async () => {
    const result = await runInDocker(images['check/typescript/no-eslint'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.violations.length).toBe(0);
    expect(result.stderr).toContain('ESLint not found');
  }, 30000);
});

// =============================================================================
// Check: Output formats
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc check - output formats', () => {
  describe('JSON output', () => {
    it('outputs valid JSON with required fields', async () => {
      const result = await runInDocker(images['check/typescript/default'], ['check', '--json']);
      const output: JsonOutput = JSON.parse(result.stdout);

      expect(output).toHaveProperty('violations');
      expect(output).toHaveProperty('summary');
      expect(output.summary).toHaveProperty('files_checked');
      expect(output.summary).toHaveProperty('violations_count');
      expect(output.violations.length).toBe(output.summary.violations_count);
    }, 30000);
  });

  describe('text output', () => {
    it('shows success message when no violations', async () => {
      const result = await runInDocker(images['check/typescript/default'], ['check', 'clean.ts']);

      expect(result.stdout).toContain('No violations found');
      expect(result.stdout).toContain('1 files checked');
    }, 30000);

    it('shows violation details with file:line [linter/rule] format', async () => {
      const result = await runInDocker(images['check/typescript/default'], [
        'check',
        'violation.ts',
      ]);

      expect(result.stdout).toMatch(/violation\.ts:\d+ \[eslint\/no-var\]/);
    }, 30000);

    it('shows violation count summary', async () => {
      const result = await runInDocker(images['check/typescript/default'], ['check']);

      expect(result.stdout).toMatch(/\d+ violations? found/);
    }, 30000);
  });
});

// =============================================================================
// Check: Error handling
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc check - error handling', () => {
  it('handles nonexistent file path gracefully', async () => {
    const result = await runInDocker(images['check/typescript/default'], [
      'check',
      'nonexistent.ts',
    ]);

    expect(result.stderr).toContain('Path not found');
    expect(result.exitCode).toBe(0); // No files to check = no violations
  }, 30000);
});

// =============================================================================
// Check: Configuration errors (exit code 2)
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc check - configuration errors', () => {
  it('exits with code 2 when cmc.toml is missing', async () => {
    const result = await runInDocker(images['check/config-errors/no-config'], ['check']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('No cmc.toml found');
  }, 30000);

  it('exits with code 2 for invalid TOML syntax', async () => {
    const result = await runInDocker(images['check/config-errors/invalid-toml'], ['check']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Invalid TOML');
  }, 30000);

  it('exits with code 2 when project name is missing', async () => {
    const result = await runInDocker(images['check/config-errors/missing-name'], ['check']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Invalid cmc.toml');
  }, 30000);
});

// =============================================================================
// Check: Path arguments
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc check - path arguments', () => {
  it('checks only files in specified subdirectory', async () => {
    const result = await runInDocker(images['check/typescript/subdirectory'], [
      'check',
      'src/',
      '--json',
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    // src/ has 2 files (violation.ts and clean.ts)
    expect(output.summary.files_checked).toBe(2);
    // Only violation.ts has violations
    expect(output.violations.length).toBe(1);
    expect(output.violations[0].file).toContain('src/');
  }, 30000);

  it('checks entire project when no path given', async () => {
    const result = await runInDocker(images['check/typescript/subdirectory'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    // All .ts files: src/violation.ts, src/clean.ts, lib/violation.ts, root.ts
    expect(output.summary.files_checked).toBe(4);
    // 2 violations from src/violation.ts and lib/violation.ts
    expect(output.violations.length).toBe(2);
  }, 30000);

  it('excludes other directories when path specified', async () => {
    const result = await runInDocker(images['check/typescript/subdirectory'], [
      'check',
      'lib/',
      '--json',
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    // Only lib/violation.ts
    expect(output.summary.files_checked).toBe(1);
    expect(output.violations.every((v) => v.file.includes('lib/'))).toBe(true);
  }, 30000);
});
