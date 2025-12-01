import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Violation } from '../types.js';

export interface LinterConfig {
  linter: string;
  config?: Record<string, unknown>;
}

export class LinterRunner {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async runLinter(
    files: string[],
    linter: string,
    config?: Record<string, unknown>
  ): Promise<Violation[]> {
    switch (linter.toLowerCase()) {
      case 'ruff':
        return this.runRuff(files, config);
      case 'eslint':
        return this.runESLint(files, config);
      default:
        throw new LinterNotFoundError(`Unknown linter: ${linter}`);
    }
  }

  private async runRuff(files: string[], config?: Record<string, unknown>): Promise<Violation[]> {
    // Check if ruff is available
    const ruffAvailable = await this.checkCommand('ruff');
    if (!ruffAvailable) {
      throw new LinterNotFoundError(
        "Ruleset requires 'ruff' but it is not installed.\n" + 'Install with: pip install ruff'
      );
    }

    const pythonFiles = files.filter((f) => f.endsWith('.py') || f.endsWith('.pyi'));
    if (pythonFiles.length === 0) {
      return [];
    }

    const args = ['check', '--output-format=json'];

    // Add config options if provided
    if (config) {
      if (config.select) {
        args.push(`--select=${(config.select as string[]).join(',')}`);
      }
      if (config.ignore) {
        args.push(`--ignore=${(config.ignore as string[]).join(',')}`);
      }
      if (config['line-length']) {
        args.push(`--line-length=${config['line-length']}`);
      }
    }

    // Add files
    args.push(...pythonFiles.map((f) => join(this.projectRoot, f)));

    const result = await this.runCommand('ruff', args);
    return this.parseRuffOutput(result.stdout);
  }

  private async runESLint(
    files: string[],
    _config?: Record<string, unknown>
  ): Promise<Violation[]> {
    // Check if eslint is available
    const eslintAvailable = await this.checkCommand('eslint');
    if (!eslintAvailable) {
      throw new LinterNotFoundError(
        "Ruleset requires 'eslint' but it is not installed.\n" +
          'Install with: npm install -g eslint'
      );
    }

    const jsFiles = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.exec(f));
    if (jsFiles.length === 0) {
      return [];
    }

    const args = ['--format=json'];

    // Add files
    args.push(...jsFiles.map((f) => join(this.projectRoot, f)));

    try {
      const result = await this.runCommand('eslint', args);
      return this.parseESLintOutput(result.stdout);
    } catch (error) {
      // ESLint exits with code 1 when there are violations
      if (error instanceof CommandError && error.stdout) {
        return this.parseESLintOutput(error.stdout);
      }
      throw error;
    }
  }

  private parseRuffOutput(output: string): Violation[] {
    if (!output.trim()) {
      return [];
    }

    try {
      const results = JSON.parse(output) as {
        filename: string;
        location?: { row?: number; column?: number };
        code: string;
        message: string;
      }[];
      return results.map((r) => ({
        file: r.filename,
        line: r.location?.row ?? null,
        column: r.location?.column ?? null,
        rule: r.code,
        message: r.message,
      }));
    } catch {
      return [];
    }
  }

  private parseESLintOutput(output: string): Violation[] {
    if (!output.trim()) {
      return [];
    }

    try {
      const results = JSON.parse(output);
      const violations: Violation[] = [];

      for (const file of results) {
        for (const msg of file.messages ?? []) {
          violations.push({
            file: file.filePath,
            line: msg.line ?? null,
            column: msg.column ?? null,
            rule: msg.ruleId ?? 'eslint',
            message: msg.message,
          });
        }
      }

      return violations;
    } catch {
      return [];
    }
  }

  private async checkCommand(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(command, ['--version'], {
        shell: true,
        stdio: 'ignore',
      });

      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    });
  }

  private async runCommand(
    command: string,
    args: string[]
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn(command, args, {
        cwd: this.projectRoot,
        shell: true,
      });

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        reject(new CommandError(`Failed to run ${command}: ${error.message}`, stdout, stderr));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          // Some linters exit with non-zero when there are violations
          reject(new CommandError(`${command} exited with code ${code}`, stdout, stderr));
        }
      });
    });
  }
}

export class LinterNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinterNotFoundError';
  }
}

class CommandError extends Error {
  stdout: string;
  stderr: string;

  constructor(message: string, stdout: string, stderr: string) {
    super(message);
    this.name = 'CommandError';
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export async function detectProjectLinters(projectRoot: string): Promise<string[]> {
  const linters: string[] = [];

  // Detect Python linters
  const pythonConfigs = ['pyproject.toml', 'ruff.toml', '.ruff.toml'];

  for (const config of pythonConfigs) {
    if (existsSync(join(projectRoot, config))) {
      if (!linters.includes('ruff')) {
        linters.push('ruff');
      }
      break;
    }
  }

  // Detect JavaScript/TypeScript linters
  const jsConfigs = [
    'eslint.config.js',
    'eslint.config.mjs',
    '.eslintrc.js',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml',
    '.eslintrc',
  ];

  for (const config of jsConfigs) {
    if (existsSync(join(projectRoot, config))) {
      if (!linters.includes('eslint')) {
        linters.push('eslint');
      }
      break;
    }
  }

  // Check package.json for eslint config
  const packageJsonPath = join(projectRoot, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const { readFileSync } = await import('fs');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
        eslintConfig?: unknown;
      };
      if (pkg.eslintConfig && !linters.includes('eslint')) {
        linters.push('eslint');
      }
    } catch {
      // Ignore
    }
  }

  return linters;
}
