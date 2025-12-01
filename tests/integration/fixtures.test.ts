import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { readdir } from 'fs/promises';

const CLI_PATH = join(process.cwd(), 'dist', 'cli', 'index.js');
const FIXTURES_PATH = join(process.cwd(), 'tests', 'fixtures');

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runInFixture(fixtureName: string, args: string[] = ['check']): Promise<ExecResult> {
  const cwd = join(FIXTURES_PATH, fixtureName);

  return new Promise((resolve) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });
  });
}

describe('Fixture Projects (integration)', () => {
  describe('typescript-strict', () => {
    it('should have valid config', async () => {
      const result = await runInFixture('typescript-strict');

      // Should not fail with config validation error
      expect(result.exitCode).not.toBe(2);
    });

    it('should find TypeScript files', async () => {
      // Use --all to bypass cache
      const result = await runInFixture('typescript-strict', ['check', '--all', '--verbose']);

      expect(result.stderr).toMatch(/Found \d+ files to check/);
    });

    it('should pass with clean code', async () => {
      const result = await runInFixture('typescript-strict');

      // Clean code should have no violations
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No violations');
    });
  });

  describe('python-fastapi', () => {
    it('should have valid config', async () => {
      const result = await runInFixture('python-fastapi');

      expect(result.exitCode).not.toBe(2);
    });

    it('should find Python files', async () => {
      // Use --all to bypass cache
      const result = await runInFixture('python-fastapi', ['check', '--all', '--verbose']);

      expect(result.stderr).toMatch(/Found \d+ files to check/);
    });

    it('should pass with clean code (docstrings present)', async () => {
      const result = await runInFixture('python-fastapi');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No violations');
    });
  });

  describe('multi-language', () => {
    it('should have valid config', async () => {
      const result = await runInFixture('multi-language');

      expect(result.exitCode).not.toBe(2);
    });

    it('should find files from both languages', async () => {
      // Use --all to bypass cache
      const result = await runInFixture('multi-language', ['check', '--all', '--verbose']);

      expect(result.stderr).toMatch(/Found \d+ files to check/);
    });

    it('should handle language-specific rulesets', async () => {
      const result = await runInFixture('multi-language');

      // Should not fail - clean code
      expect(result.exitCode).toBe(0);
    });

    it('should check specific language paths', async () => {
      const resultBackend = await runInFixture('multi-language', [
        'check',
        'backend/',
        '--verbose',
      ]);
      const resultFrontend = await runInFixture('multi-language', [
        'check',
        'frontend/',
        '--verbose',
      ]);

      // Both should work without config errors
      expect(resultBackend.exitCode).not.toBe(2);
      expect(resultFrontend.exitCode).not.toBe(2);
    });
  });

  describe('with-violations', () => {
    it('should have valid config', async () => {
      const result = await runInFixture('with-violations');

      // Config is valid, but code has violations (exit 1)
      expect(result.exitCode).not.toBe(2);
    });

    it('should detect console.log violations', async () => {
      const result = await runInFixture('with-violations', ['check', 'src/console-violation.ts']);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('no-console');
    });

    it('should detect print statement violations', async () => {
      const result = await runInFixture('with-violations', ['check', 'src/print-violation.py']);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('no-print');
    });

    it('should detect missing docstring violations', async () => {
      const result = await runInFixture('with-violations', ['check', 'src/no-docstring.py']);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('require-docstrings');
    });

    it('should count all violations', async () => {
      const result = await runInFixture('with-violations', ['check', '--json']);

      const output = JSON.parse(result.stdout);
      expect(output.summary.violations_total).toBeGreaterThan(0);
    });
  });

  describe('minimal', () => {
    it('should have valid config', async () => {
      const result = await runInFixture('minimal');

      expect(result.exitCode).not.toBe(2);
    });

    it('should warn about empty rulesets', async () => {
      const result = await runInFixture('minimal');

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('No rulesets configured');
    });
  });

  describe('all fixtures have valid configs', () => {
    it('should validate all fixture cmc.toml files', async () => {
      const fixtures = await readdir(FIXTURES_PATH);

      for (const fixture of fixtures) {
        const result = await runInFixture(fixture);

        // Should not fail with config validation error
        expect(result.exitCode, `Fixture "${fixture}" should have valid config`).not.toBe(2);
      }
    });
  });
});
