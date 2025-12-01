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

afterAll(async () => {
  if (dockerAvailable) {
    await cleanupImages();
  }
}, 30000);

// =============================================================================
// TypeScript-only project tests
// =============================================================================
describe.skipIf(!dockerAvailable)('typescript-only project', () => {
  let imageName: string;

  beforeAll(async () => {
    imageName = await buildImage('typescript-only');
  }, 120000); // 2 min timeout for build

  it('builds successfully', () => {
    expect(imageName).toBe('cmc-e2e-typescript-only');
  });

  it('exits 1 when violations found', async () => {
    const result = await runInDocker(imageName, ['check']);

    expect(result.exitCode).toBe(1);
  }, 30000);

  it('detects no-var violations', async () => {
    const result = await runInDocker(imageName, ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    const noVarViolations = output.violations.filter((v) => v.rule === 'no-var');
    expect(noVarViolations.length).toBeGreaterThan(0);
    expect(noVarViolations[0].linter).toBe('eslint');
  }, 30000);

  it('checks specific file', async () => {
    const result = await runInDocker(imageName, ['check', 'clean.ts', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.summary.files_checked).toBe(1);
    expect(output.violations.length).toBe(0);
  }, 30000);

  it('includes line and column in violations', async () => {
    const result = await runInDocker(imageName, ['check', 'violation.ts', '--json']);
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
  let imageName: string;

  beforeAll(async () => {
    imageName = await buildImage('python-only');
  }, 120000);

  it('builds successfully', () => {
    expect(imageName).toBe('cmc-e2e-python-only');
  });

  it('exits 1 when violations found', async () => {
    const result = await runInDocker(imageName, ['check']);

    expect(result.exitCode).toBe(1);
  }, 30000);

  it('detects unused imports (F401)', async () => {
    const result = await runInDocker(imageName, ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    const f401Violations = output.violations.filter((v) => v.rule === 'F401');
    expect(f401Violations.length).toBeGreaterThan(0);
    expect(f401Violations[0].linter).toBe('ruff');
  }, 30000);

  it('checks specific clean file', async () => {
    const result = await runInDocker(imageName, ['check', 'clean.py', '--json']);
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
  let imageName: string;

  beforeAll(async () => {
    imageName = await buildImage('mixed-language');
  }, 120000);

  it('builds successfully', () => {
    expect(imageName).toBe('cmc-e2e-mixed-language');
  });

  it('detects violations from both linters', async () => {
    const result = await runInDocker(imageName, ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    const ruffViolations = output.violations.filter((v) => v.linter === 'ruff');
    const eslintViolations = output.violations.filter((v) => v.linter === 'eslint');

    expect(ruffViolations.length).toBeGreaterThan(0);
    expect(eslintViolations.length).toBeGreaterThan(0);
  }, 30000);

  it('checks all files', async () => {
    const result = await runInDocker(imageName, ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.summary.files_checked).toBe(5); // 2 py + 2 ts + eslint.config.js
  }, 30000);

  it('can check only Python files', async () => {
    const result = await runInDocker(imageName, ['check', 'violation.py', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.summary.files_checked).toBe(1);
    expect(output.violations.every((v) => v.linter === 'ruff')).toBe(true);
  }, 30000);

  it('can check only TypeScript files', async () => {
    const result = await runInDocker(imageName, ['check', 'violation.ts', '--json']);
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
    let imageName: string;

    beforeAll(async () => {
      imageName = await buildImage('no-ruff');
    }, 120000);

    it('exits 0 when Ruff unavailable (skips Python files)', async () => {
      const result = await runInDocker(imageName, ['check', '--json']);
      const output: JsonOutput = JSON.parse(result.stdout);

      // Should not fail, just report no violations since Ruff is skipped
      expect(result.exitCode).toBe(0);
      expect(output.violations.length).toBe(0);
    }, 30000);
  });

  describe('no ESLint installed', () => {
    let imageName: string;

    beforeAll(async () => {
      imageName = await buildImage('no-eslint');
    }, 120000);

    it('exits 0 when ESLint unavailable (skips TS files)', async () => {
      const result = await runInDocker(imageName, ['check', '--json']);
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
  let imageName: string;

  beforeAll(async () => {
    imageName = await buildImage('typescript-only');
  }, 120000);

  it('outputs valid JSON', async () => {
    const result = await runInDocker(imageName, ['check', '--json']);

    expect(() => JSON.parse(result.stdout)).not.toThrow();
  }, 30000);

  it('includes required fields', async () => {
    const result = await runInDocker(imageName, ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output).toHaveProperty('violations');
    expect(output).toHaveProperty('summary');
    expect(output.summary).toHaveProperty('files_checked');
    expect(output.summary).toHaveProperty('violations_count');
  }, 30000);

  it('violations count matches array length', async () => {
    const result = await runInDocker(imageName, ['check', '--json']);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.violations.length).toBe(output.summary.violations_count);
  }, 30000);
});

// =============================================================================
// Edge cases
// =============================================================================
describe.skipIf(!dockerAvailable)('edge cases', () => {
  let imageName: string;

  beforeAll(async () => {
    imageName = await buildImage('typescript-only');
  }, 120000);

  it('handles nonexistent file path', async () => {
    const result = await runInDocker(imageName, ['check', 'nonexistent.ts']);

    expect(result.stderr).toContain('Path not found');
  }, 30000);
});
