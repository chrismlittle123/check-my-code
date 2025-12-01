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
  const projectNames = ['typescript-only', 'python-only', 'mixed-language', 'no-ruff', 'no-eslint'];

  const results = await Promise.all(projectNames.map((name) => buildImage(name)));

  projectNames.forEach((name, i) => {
    images[name] = results[i];
  });
}, 300000); // 5 min timeout for all builds

afterAll(async () => {
  if (dockerAvailable) {
    await cleanupImages();
  }
}, 30000);

// =============================================================================
// TypeScript-only project tests
// =============================================================================
describe.skipIf(!dockerAvailable)('typescript-only project', () => {
  it('builds successfully', () => {
    expect(images['typescript-only']).toBe('cmc-e2e-typescript-only');
  });

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
  it('builds successfully', () => {
    expect(images['python-only']).toBe('cmc-e2e-python-only');
  });

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
  it('builds successfully', () => {
    expect(images['mixed-language']).toBe('cmc-e2e-mixed-language');
  });

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

    expect(output.summary.files_checked).toBe(5); // 2 py + 2 ts + eslint.config.js
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
    it('builds successfully', () => {
      expect(images['no-ruff']).toBe('cmc-e2e-no-ruff');
    });

    it('exits 0 when Ruff unavailable (skips Python files)', async () => {
      const result = await runInDocker(images['no-ruff'], ['check', '--json']);
      const output: JsonOutput = JSON.parse(result.stdout);

      // Should not fail, just report no violations since Ruff is skipped
      expect(result.exitCode).toBe(0);
      expect(output.violations.length).toBe(0);
    }, 30000);
  });

  describe('no ESLint installed', () => {
    it('builds successfully', () => {
      expect(images['no-eslint']).toBe('cmc-e2e-no-eslint');
    });

    it('exits 0 when ESLint unavailable (skips TS files)', async () => {
      const result = await runInDocker(images['no-eslint'], ['check', '--json']);
      const output: JsonOutput = JSON.parse(result.stdout);

      // Should not fail, just report no violations since ESLint is skipped
      expect(result.exitCode).toBe(0);
      expect(output.violations.length).toBe(0);
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
// Edge cases
// =============================================================================
describe.skipIf(!dockerAvailable)('edge cases', () => {
  it('handles nonexistent file path', async () => {
    const result = await runInDocker(images['typescript-only'], ['check', 'nonexistent.ts']);

    expect(result.stderr).toContain('Path not found');
  }, 30000);
});
