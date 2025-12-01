import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';

const CLI_PATH = join(process.cwd(), 'dist', 'cli', 'index.js');

interface Result {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runCLI(args: string[], cwd: string): Promise<Result> {
  return new Promise((resolve) => {
    const proc = spawn('node', [CLI_PATH, ...args], { cwd });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => (stdout += data.toString()));
    proc.stderr.on('data', (data) => (stderr += data.toString()));
    proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
  });
}

describe('cmc check', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cmc-test-'));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('no config', () => {
    it('exits with error when no cmc.toml exists', async () => {
      const noConfigDir = join(tempDir, 'no-config');
      await mkdir(noConfigDir, { recursive: true });

      const result = await runCLI(['check'], noConfigDir);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Config not found');
    });
  });

  describe('clean projects', () => {
    it('exits 0 for clean TypeScript project', async () => {
      const projectDir = join(tempDir, 'clean-ts');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'cmc.toml'), '[project]\nname = "test"');
      await writeFile(join(projectDir, 'index.ts'), 'export const x = 1;');

      const result = await runCLI(['check'], projectDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No violations');
    });

    it('exits 0 for clean Python project', async () => {
      const projectDir = join(tempDir, 'clean-py');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'cmc.toml'), '[project]\nname = "test"');
      await writeFile(join(projectDir, 'main.py'), 'x = 1');

      const result = await runCLI(['check'], projectDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No violations');
    });
  });

  describe('--json output', () => {
    it('outputs valid JSON', async () => {
      const projectDir = join(tempDir, 'json-test');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'cmc.toml'), '[project]\nname = "test"');
      await writeFile(join(projectDir, 'index.ts'), 'export const x = 1;');

      const result = await runCLI(['check', '--json'], projectDir);

      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it('includes violations array and summary', async () => {
      const projectDir = join(tempDir, 'json-summary');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'cmc.toml'), '[project]\nname = "test"');
      await writeFile(join(projectDir, 'index.ts'), 'export const x = 1;');

      const result = await runCLI(['check', '--json'], projectDir);
      const output = JSON.parse(result.stdout);

      expect(output.violations).toBeDefined();
      expect(output.summary).toBeDefined();
      expect(output.summary.files_checked).toBeTypeOf('number');
      expect(output.summary.violations_count).toBeTypeOf('number');
    });
  });

  describe('path argument', () => {
    it('checks specific file', async () => {
      const projectDir = join(tempDir, 'path-arg');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'cmc.toml'), '[project]\nname = "test"');
      await writeFile(join(projectDir, 'a.ts'), 'export const a = 1;');
      await writeFile(join(projectDir, 'b.ts'), 'export const b = 2;');

      const result = await runCLI(['check', 'a.ts'], projectDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('1 files checked');
    });

    it('handles nonexistent path gracefully', async () => {
      const projectDir = join(tempDir, 'path-missing');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'cmc.toml'), '[project]\nname = "test"');

      const result = await runCLI(['check', 'nonexistent.ts'], projectDir);

      expect(result.stderr).toContain('Path not found');
    });
  });

  describe('no files to check', () => {
    it('exits 0 when no source files found', async () => {
      const projectDir = join(tempDir, 'empty');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'cmc.toml'), '[project]\nname = "test"');
      await writeFile(join(projectDir, 'readme.md'), '# README');

      const result = await runCLI(['check'], projectDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('0 files checked');
    });
  });
});
