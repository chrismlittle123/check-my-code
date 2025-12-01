/**
 * E2E tests for cmc CLI
 *
 * Uses Docker containers to test in isolated environments.
 * Tests are organized by feature, not by project type.
 *
 * Projects:
 * - typescript: Node + ESLint (TypeScript linting, config generation, CLI tests)
 * - python: Python + Ruff (Python linting)
 * - full: Both linters (mixed-language projects)
 * - degraded-ruff: Python files without Ruff installed
 * - degraded-eslint: TypeScript files without ESLint installed
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isDockerAvailable, cleanupImages, buildImage, runInDocker } from './docker-runner.js';

interface JsonOutput {
  violations: {
    file: string;
    line: number | null;
    column: number | null;
    rule: string;
    message: string;
    linter: 'eslint' | 'ruff';
  }[];
  summary: {
    files_checked: number;
    violations_count: number;
  };
}

// Check Docker availability at module load
const dockerAvailable = await isDockerAvailable();

if (!dockerAvailable) {
  console.warn('Docker not available - skipping Docker-based e2e tests');
}

// =============================================================================
// Setup: Build all images once
// =============================================================================
const images: Record<string, string> = {};

beforeAll(async () => {
  if (!dockerAvailable) return;

  const projectNames = ['typescript', 'python', 'full', 'degraded-ruff', 'degraded-eslint'];
  const results = await Promise.all(projectNames.map((name) => buildImage(name)));

  projectNames.forEach((name, i) => {
    images[name] = results[i];
  });
}, 300000);

afterAll(async () => {
  if (dockerAvailable) {
    await cleanupImages(Object.values(images));
  }
}, 30000);

// =============================================================================
// CLI: Basic flags and help
// =============================================================================
describe.skipIf(!dockerAvailable)('CLI basics', () => {
  it('--version outputs version number', async () => {
    const result = await runInDocker(images['typescript'], ['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  }, 30000);

  it('--help outputs usage information', async () => {
    const result = await runInDocker(images['typescript'], ['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('check');
    expect(result.stdout).toContain('generate');
  }, 30000);
});

// =============================================================================
// Check: ESLint (TypeScript/JavaScript)
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc check - ESLint', () => {
  it('detects ESLint violations and exits 1', async () => {
    const result = await runInDocker(images['typescript'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(output.violations.some((v) => v.rule === 'no-var')).toBe(true);
    expect(output.violations.every((v) => v.linter === 'eslint')).toBe(true);
  }, 30000);

  it('includes line and column in violations', async () => {
    const result = await runInDocker(images['typescript'], ['check', 'violation.ts', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.violations.length).toBeGreaterThan(0);
    expect(output.violations[0].line).toBeTypeOf('number');
    expect(output.violations[0].column).toBeTypeOf('number');
  }, 30000);

  it('exits 0 for clean files', async () => {
    const result = await runInDocker(images['typescript'], ['check', 'clean.ts', '--json']);
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
    const result = await runInDocker(images['python'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(output.violations.some((v) => v.rule === 'F401')).toBe(true);
    expect(output.violations.every((v) => v.linter === 'ruff')).toBe(true);
  }, 30000);

  it('exits 0 for clean Python files', async () => {
    const result = await runInDocker(images['python'], ['check', 'clean.py', '--json']);
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
    const result = await runInDocker(images['full'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    const ruffViolations = output.violations.filter((v) => v.linter === 'ruff');
    const eslintViolations = output.violations.filter((v) => v.linter === 'eslint');

    expect(ruffViolations.length).toBeGreaterThan(0);
    expect(eslintViolations.length).toBeGreaterThan(0);
  }, 30000);

  it('checks all files in project', async () => {
    const result = await runInDocker(images['full'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    // 2 .ts + 2 .py files (config files are ignored)
    expect(output.summary.files_checked).toBe(4);
  }, 30000);

  it('can filter to specific file', async () => {
    const result = await runInDocker(images['full'], ['check', 'violation.py', '--json']);
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
    const result = await runInDocker(images['degraded-ruff'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.violations.length).toBe(0);
    expect(result.stderr).toContain('Ruff not found');
  }, 30000);

  it('skips TypeScript files when ESLint unavailable', async () => {
    const result = await runInDocker(images['degraded-eslint'], ['check', '--json']);
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
      const result = await runInDocker(images['typescript'], ['check', '--json']);
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
      const result = await runInDocker(images['typescript'], ['check', 'clean.ts']);

      expect(result.stdout).toContain('No violations found');
      expect(result.stdout).toContain('1 files checked');
    }, 30000);

    it('shows violation details with file:line [linter/rule] format', async () => {
      const result = await runInDocker(images['typescript'], ['check', 'violation.ts']);

      expect(result.stdout).toMatch(/violation\.ts:\d+ \[eslint\/no-var\]/);
    }, 30000);

    it('shows violation count summary', async () => {
      const result = await runInDocker(images['typescript'], ['check']);

      expect(result.stdout).toMatch(/\d+ violations? found/);
    }, 30000);
  });
});

// =============================================================================
// Check: Error handling
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc check - error handling', () => {
  it('handles nonexistent file path gracefully', async () => {
    const result = await runInDocker(images['typescript'], ['check', 'nonexistent.ts']);

    expect(result.stderr).toContain('Path not found');
    expect(result.exitCode).toBe(0); // No files to check = no violations
  }, 30000);
});

// =============================================================================
// Generate: ESLint config
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc generate eslint', () => {
  it('generates valid ESLint config with --stdout', async () => {
    const result = await runInDocker(images['typescript'], ['generate', 'eslint', '--stdout']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('// Generated by cmc (check-my-code)');
    expect(result.stdout).toContain("import js from '@eslint/js'");
    expect(result.stdout).toContain('tseslint.config(');
  }, 30000);

  it('includes rules from cmc.toml', async () => {
    const result = await runInDocker(images['typescript'], ['generate', 'eslint', '--stdout']);

    expect(result.stdout).toContain('"no-var": "error"');
    expect(result.stdout).toContain('"prefer-const": "error"');
    expect(result.stdout).toContain('"eqeqeq"');
  }, 30000);

  it('writes file and reports success', async () => {
    // Note: This modifies the container filesystem (ephemeral)
    const result = await runInDocker(images['typescript'], ['generate', 'eslint', '--force']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Generated eslint.config.js');
  }, 30000);
});

// =============================================================================
// Generate: Ruff config
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc generate ruff', () => {
  it('generates valid Ruff config with --stdout', async () => {
    const result = await runInDocker(images['typescript'], ['generate', 'ruff', '--stdout']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('# Generated by cmc (check-my-code)');
    expect(result.stdout).toContain('line-length = 100');
    expect(result.stdout).toContain('[lint]');
  }, 30000);

  it('includes lint rules from cmc.toml', async () => {
    const result = await runInDocker(images['typescript'], ['generate', 'ruff', '--stdout']);

    expect(result.stdout).toContain('select = ["E","F","I"]');
    expect(result.stdout).toContain('ignore = ["E501"]');
  }, 30000);
});

// =============================================================================
// Generate: Error handling
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc generate - error handling', () => {
  it('fails with exit code 3 for unknown linter', async () => {
    const result = await runInDocker(images['typescript'], ['generate', 'unknown']);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('Unknown linter');
  }, 30000);

  it('is case insensitive for linter name', async () => {
    const result = await runInDocker(images['typescript'], ['generate', 'ESLINT', '--stdout']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('// Generated by cmc');
  }, 30000);
});
