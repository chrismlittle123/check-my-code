import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import type { Violation } from './types.js';

// Custom error class for linter runtime errors (exit code 3)
export class LinterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinterError';
  }
}

export async function runLinters(projectRoot: string, files: string[]): Promise<Violation[]> {
  const violations: Violation[] = [];

  const pythonFiles = files.filter((f) => f.endsWith('.py') || f.endsWith('.pyi'));
  const jsFiles = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f));

  if (pythonFiles.length > 0) {
    const ruffViolations = await runRuff(projectRoot, pythonFiles);
    violations.push(...ruffViolations);
  }

  if (jsFiles.length > 0) {
    const eslintViolations = await runESLint(projectRoot, jsFiles);
    violations.push(...eslintViolations);
  }

  return violations;
}

async function runRuff(projectRoot: string, files: string[]): Promise<Violation[]> {
  const hasRuff = await commandExists('ruff');
  if (!hasRuff) {
    return [];
  }

  const absoluteFiles = files.map((f) => join(projectRoot, f));
  const args = ['check', '--output-format=json', ...absoluteFiles];

  try {
    const output = await runCommand('ruff', args, projectRoot);
    return parseRuffOutput(output, projectRoot);
  } catch (error) {
    if (error instanceof CommandError && error.stdout) {
      return parseRuffOutput(error.stdout, projectRoot);
    }
    return [];
  }
}

async function runESLint(projectRoot: string, files: string[]): Promise<Violation[]> {
  // Look for eslint in the project's node_modules or globally
  const localEslintPath = join(projectRoot, 'node_modules', '.bin', 'eslint');
  const hasLocalESLint = existsSync(localEslintPath);
  const hasGlobalESLint = await commandExists('eslint');

  if (!hasLocalESLint && !hasGlobalESLint) {
    return [];
  }

  const eslintBin = hasLocalESLint ? localEslintPath : 'eslint';
  const absoluteFiles = files.map((f) => join(projectRoot, f));

  // Use --no-ignore to check files even if they're in ignored paths
  // Use --no-warn-ignored to suppress warnings about ignored files
  const args = [
    '--format=json',
    '--no-error-on-unmatched-pattern',
    '--no-ignore',
    '--no-warn-ignored',
    ...absoluteFiles,
  ];

  try {
    const output = await runCommand(eslintBin, args, projectRoot);
    return parseESLintOutput(output, projectRoot);
  } catch (error) {
    if (error instanceof CommandError && error.stdout) {
      return parseESLintOutput(error.stdout, projectRoot);
    }
    return [];
  }
}

function parseRuffOutput(output: string, projectRoot: string): Violation[] {
  if (!output.trim()) return [];

  try {
    const results = JSON.parse(output) as {
      filename: string;
      location?: { row?: number; column?: number };
      code: string;
      message: string;
    }[];

    return results.map((r) => ({
      file: relative(projectRoot, r.filename),
      line: r.location?.row ?? null,
      column: r.location?.column ?? null,
      rule: r.code,
      message: r.message,
      linter: 'ruff' as const,
    }));
  } catch {
    return [];
  }
}

function parseESLintOutput(output: string, projectRoot: string): Violation[] {
  if (!output.trim()) return [];

  try {
    const results = JSON.parse(output) as {
      filePath: string;
      messages?: {
        line?: number;
        column?: number;
        ruleId?: string;
        message: string;
      }[];
    }[];

    const violations: Violation[] = [];
    for (const file of results) {
      for (const msg of file.messages ?? []) {
        violations.push({
          file: relative(projectRoot, file.filePath),
          line: msg.line ?? null,
          column: msg.column ?? null,
          rule: msg.ruleId ?? 'eslint',
          message: msg.message,
          linter: 'eslint' as const,
        });
      }
    }
    return violations;
  } catch {
    return [];
  }
}

async function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, ['--version'], { stdio: 'ignore' });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

class CommandError extends Error {
  stdout: string;
  constructor(message: string, stdout: string) {
    super(message);
    this.stdout = stdout;
  }
}

function runCommand(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let _stderr = '';

    const proc = spawn(cmd, args, { cwd });

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr?.on('data', (data: Buffer) => {
      _stderr += data.toString();
    });

    proc.on('error', (err) => reject(new Error(`Failed to run ${cmd}: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new CommandError(`${cmd} exited with code ${code}`, stdout));
      }
    });
  });
}
