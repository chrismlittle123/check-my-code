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

// Check Docker availability synchronously at module load
const dockerAvailable = await isDockerAvailable();

if (!dockerAvailable) {
  console.warn('Docker not available - skipping Docker-based e2e tests');
}

// =============================================================================
// Build all images once upfront for performance
// =============================================================================
const images: Record<string, string> = {};

beforeAll(async () => {
  if (!dockerAvailable) return;

  // Build all images in parallel for faster setup
  const projectNames = [
    'typescript-only',
    'python-only',
    'mixed-language',
    'no-ruff',
    'no-eslint',
    'invalid-config',
    'no-config',
  ];

  const results = await Promise.all(projectNames.map((name) => buildImage(name)));

  projectNames.forEach((name, i) => {
    images[name] = results[i];
  });
}, 300000); // 5 min timeout for all builds

afterAll(async () => {
  if (dockerAvailable) {
    await cleanupImages(Object.values(images));
  }
}, 30000);

// =============================================================================
// TypeScript-only project tests
// =============================================================================
describe.skipIf(!dockerAvailable)('typescript-only project', () => {
  it('exits 1 when violations found', async () => {
    const result = await runInDocker(images['typescript-only'], ['check']);

    expect(result.exitCode).toBe(1);
  }, 30000);

  it('detects no-var violations', async () => {
    const result = await runInDocker(images['typescript-only'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    const noVarViolations = output.violations.filter((v) => v.rule === 'no-var');
    expect(noVarViolations.length).toBeGreaterThan(0);
    expect(noVarViolations[0].linter).toBe('eslint');
  }, 30000);

  it('checks specific file', async () => {
    const result = await runInDocker(images['typescript-only'], ['check', 'clean.ts', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.summary.files_checked).toBe(1);
    expect(output.violations.length).toBe(0);
  }, 30000);

  it('includes line and column in violations', async () => {
    const result = await runInDocker(images['typescript-only'], [
      'check',
      'violation.ts',
      '--json',
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.violations.length).toBeGreaterThan(0);
    expect(output.violations[0].line).toBeTypeOf('number');
    expect(output.violations[0].column).toBeTypeOf('number');
  }, 30000);
});

// =============================================================================
// Python-only project tests
// =============================================================================
describe.skipIf(!dockerAvailable)('python-only project', () => {
  it('exits 1 when violations found', async () => {
    const result = await runInDocker(images['python-only'], ['check']);

    expect(result.exitCode).toBe(1);
  }, 30000);

  it('detects unused imports (F401)', async () => {
    const result = await runInDocker(images['python-only'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    const f401Violations = output.violations.filter((v) => v.rule === 'F401');
    expect(f401Violations.length).toBeGreaterThan(0);
    expect(f401Violations[0].linter).toBe('ruff');
  }, 30000);

  it('checks specific clean file', async () => {
    const result = await runInDocker(images['python-only'], ['check', 'clean.py', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.summary.files_checked).toBe(1);
    expect(output.violations.length).toBe(0);
  }, 30000);
});

// =============================================================================
// Mixed-language project tests
// =============================================================================
describe.skipIf(!dockerAvailable)('mixed-language project', () => {
  it('detects violations from both linters', async () => {
    const result = await runInDocker(images['mixed-language'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    const ruffViolations = output.violations.filter((v) => v.linter === 'ruff');
    const eslintViolations = output.violations.filter((v) => v.linter === 'eslint');

    expect(ruffViolations.length).toBeGreaterThan(0);
    expect(eslintViolations.length).toBeGreaterThan(0);
  }, 30000);

  it('checks all files', async () => {
    const result = await runInDocker(images['mixed-language'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.summary.files_checked).toBe(4); // 2 py + 2 ts (config files are ignored)
  }, 30000);

  it('can check only Python files', async () => {
    const result = await runInDocker(images['mixed-language'], ['check', 'violation.py', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.summary.files_checked).toBe(1);
    expect(output.violations.every((v) => v.linter === 'ruff')).toBe(true);
  }, 30000);

  it('can check only TypeScript files', async () => {
    const result = await runInDocker(images['mixed-language'], ['check', 'violation.ts', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.summary.files_checked).toBe(1);
    expect(output.violations.every((v) => v.linter === 'eslint')).toBe(true);
  }, 30000);
});

// =============================================================================
// Graceful degradation tests
// =============================================================================
describe.skipIf(!dockerAvailable)('graceful degradation', () => {
  describe('no Ruff installed', () => {
    it('exits 0 when Ruff unavailable (skips Python files)', async () => {
      const result = await runInDocker(images['no-ruff'], ['check', '--json']);
      const output: JsonOutput = JSON.parse(result.stdout);

      // Should not fail, just report no violations since Ruff is skipped
      expect(result.exitCode).toBe(0);
      expect(output.violations.length).toBe(0);
    }, 30000);

    it('shows warning when Ruff is unavailable', async () => {
      const result = await runInDocker(images['no-ruff'], ['check']);

      expect(result.stderr).toContain('Ruff not found');
      expect(result.stderr).toContain('skipping Python');
    }, 30000);
  });

  describe('no ESLint installed', () => {
    it('exits 0 when ESLint unavailable (skips TS files)', async () => {
      const result = await runInDocker(images['no-eslint'], ['check', '--json']);
      const output: JsonOutput = JSON.parse(result.stdout);

      // Should not fail, just report no violations since ESLint is skipped
      expect(result.exitCode).toBe(0);
      expect(output.violations.length).toBe(0);
    }, 30000);

    it('shows warning when ESLint is unavailable', async () => {
      const result = await runInDocker(images['no-eslint'], ['check']);

      expect(result.stderr).toContain('ESLint not found');
      expect(result.stderr).toContain('skipping JavaScript/TypeScript');
    }, 30000);
  });
});

// =============================================================================
// JSON output format tests
// =============================================================================
describe.skipIf(!dockerAvailable)('JSON output format', () => {
  it('outputs valid JSON', async () => {
    const result = await runInDocker(images['typescript-only'], ['check', '--json']);

    expect(() => JSON.parse(result.stdout)).not.toThrow();
  }, 30000);

  it('includes required fields', async () => {
    const result = await runInDocker(images['typescript-only'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output).toHaveProperty('violations');
    expect(output).toHaveProperty('summary');
    expect(output.summary).toHaveProperty('files_checked');
    expect(output.summary).toHaveProperty('violations_count');
  }, 30000);

  it('violations count matches array length', async () => {
    const result = await runInDocker(images['typescript-only'], ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.violations.length).toBe(output.summary.violations_count);
  }, 30000);
});

// =============================================================================
// Text output format tests
// =============================================================================
describe.skipIf(!dockerAvailable)('text output format', () => {
  it('shows success message when no violations', async () => {
    const result = await runInDocker(images['typescript-only'], ['check', 'clean.ts']);

    expect(result.stdout).toContain('No violations found');
    expect(result.stdout).toContain('1 files checked');
  }, 30000);

  it('shows violation details in text format', async () => {
    const result = await runInDocker(images['typescript-only'], ['check', 'violation.ts']);

    // Should show file:line [linter/rule] message format
    expect(result.stdout).toMatch(/violation\.ts:\d+ \[eslint\/no-var\]/);
    expect(result.stdout).toContain('violation');
  }, 30000);

  it('shows violation count summary', async () => {
    const result = await runInDocker(images['typescript-only'], ['check']);

    expect(result.stdout).toMatch(/\d+ violations? found/);
  }, 30000);
});

// =============================================================================
// Config error handling tests
// =============================================================================
describe.skipIf(!dockerAvailable)('config error handling', () => {
  describe('invalid config', () => {
    it('exits with config error for missing project.name', async () => {
      const result = await runInDocker(images['invalid-config'], ['check']);

      // Exit code 2 is CONFIG_ERROR
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Invalid cmc.toml');
    }, 30000);
  });

  describe('no config', () => {
    it('exits with config error when cmc.toml missing', async () => {
      const result = await runInDocker(images['no-config'], ['check']);

      // Exit code 2 is CONFIG_ERROR
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('No cmc.toml found');
    }, 30000);
  });
});

// =============================================================================
// Edge cases
// =============================================================================
describe.skipIf(!dockerAvailable)('edge cases', () => {
  it('handles nonexistent file path gracefully', async () => {
    const result = await runInDocker(images['typescript-only'], ['check', 'nonexistent.ts']);

    // Nonexistent paths are warned about but don't cause failure
    expect(result.stderr).toContain('Path not found');
    expect(result.exitCode).toBe(0); // No files to check = no violations
  }, 30000);
});

// =============================================================================
// CLI flags
// =============================================================================
describe.skipIf(!dockerAvailable)('CLI flags', () => {
  it('--version outputs version number', async () => {
    const result = await runInDocker(images['typescript-only'], ['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  }, 30000);

  it('--help outputs usage information', async () => {
    const result = await runInDocker(images['typescript-only'], ['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('check');
  }, 30000);
});
