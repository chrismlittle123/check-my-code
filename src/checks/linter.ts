import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import type { Violation } from '../types.js';
import { getLanguageByExtension } from '../config/compatibility.js';

interface LinterOptions {
  select?: string[];
  ignore?: string[];
  lineLength?: number;
  configFile?: string;
  extraArgs?: string[];
}

export class LinterRunner {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async runLinter(files: string[], linter: string, options?: LinterOptions): Promise<Violation[]> {
    switch (linter.toLowerCase()) {
      case 'ruff':
        return this.runRuff(files, options);
      case 'eslint':
        return this.runESLint(files, options);
      default:
        throw new LinterNotFoundError(`Unsupported linter: ${linter}. Supported: ruff, eslint`);
    }
  }

  private async runRuff(files: string[], options?: LinterOptions): Promise<Violation[]> {
    const isAvailable = await this.checkCommand('ruff');
    if (!isAvailable) {
      throw new LinterNotFoundError('Ruff is not installed. Install with: pip install ruff');
    }

    const pythonFiles = files.filter((f) => {
      const ext = `.${f.split('.').pop()}`;
      const lang = getLanguageByExtension(ext);
      return lang?.name === 'Python';
    });

    if (pythonFiles.length === 0) return [];

    const args = ['check', '--output-format=json'];
    if (options?.select?.length) args.push(`--select=${options.select.join(',')}`);
    if (options?.ignore?.length) args.push(`--ignore=${options.ignore.join(',')}`);
    if (options?.lineLength) args.push(`--line-length=${options.lineLength}`);
    if (options?.configFile) args.push(`--config=${options.configFile}`);
    if (options?.extraArgs?.length) args.push(...options.extraArgs);
    args.push(...pythonFiles);

    try {
      const result = await this.runCommand('ruff', args);
      return this.parseRuffOutput(result.stdout);
    } catch (error) {
      if (error instanceof CommandError && error.stdout) {
        return this.parseRuffOutput(error.stdout);
      }
      throw error;
    }
  }

  private async runESLint(files: string[], options?: LinterOptions): Promise<Violation[]> {
    const eslintCmd = await this.findEslintCommand();
    if (!eslintCmd) {
      throw new LinterNotFoundError('ESLint is not installed. Install with: npm install eslint');
    }

    const jsFiles = files.filter((f) => {
      const ext = `.${f.split('.').pop()}`;
      const lang = getLanguageByExtension(ext);
      return lang?.name === 'TypeScript' || lang?.name === 'JavaScript';
    });

    if (jsFiles.length === 0) return [];

    const args = ['--format=json'];
    if (options?.configFile) args.push(`--config=${options.configFile}`);
    if (options?.extraArgs?.length) args.push(...options.extraArgs);
    args.push(...jsFiles.map((f) => join(this.projectRoot, f)));

    try {
      const result = await this.runCommand(eslintCmd.command, [...eslintCmd.prefix, ...args]);
      return this.parseESLintOutput(result.stdout);
    } catch (error) {
      if (error instanceof CommandError && error.stdout) {
        return this.parseESLintOutput(error.stdout);
      }
      throw error;
    }
  }

  private parseRuffOutput(output: string): Violation[] {
    if (!output.trim()) return [];

    try {
      const results = JSON.parse(output) as RuffDiagnostic[];
      return results.map((r) => ({
        file: relative(this.projectRoot, r.filename),
        line: r.location?.row ?? null,
        column: r.location?.column ?? null,
        rule: r.code,
        message: r.message,
        ruleset: 'ruff',
      }));
    } catch {
      return [];
    }
  }

  private parseESLintOutput(output: string): Violation[] {
    if (!output.trim()) return [];

    try {
      const results = JSON.parse(output) as ESLintResult[];
      const violations: Violation[] = [];

      for (const file of results) {
        for (const msg of file.messages ?? []) {
          violations.push({
            file: relative(this.projectRoot, file.filePath),
            line: msg.line ?? null,
            column: msg.column ?? null,
            rule: msg.ruleId ?? 'eslint',
            message: msg.message,
            ruleset: 'eslint',
          });
        }
      }

      return violations;
    } catch {
      return [];
    }
  }

  private async findEslintCommand(): Promise<{ command: string; prefix: string[] } | null> {
    const hasLocalEslint = existsSync(join(this.projectRoot, 'node_modules', '.bin', 'eslint'));
    if (hasLocalEslint) {
      return { command: 'npx', prefix: ['eslint'] };
    }

    const hasGlobalEslint = await this.checkCommand('eslint');
    if (hasGlobalEslint) {
      return { command: 'eslint', prefix: [] };
    }

    return null;
  }

  private async checkCommand(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(command, ['--version'], {
        shell: true,
        stdio: 'ignore',
        cwd: this.projectRoot,
      });

      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    });
  }

  private runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn(command, args, {
        cwd: this.projectRoot,
        shell: true,
      });

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        reject(new CommandError(`Failed to run ${command}: ${error.message}`, stdout, stderr));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new CommandError(`${command} exited with code ${code}`, stdout, stderr));
        }
      });
    });
  }
}

interface RuffDiagnostic {
  filename: string;
  location?: { row?: number; column?: number };
  code: string;
  message: string;
}

interface ESLintResult {
  filePath: string;
  messages?: {
    line?: number;
    column?: number;
    ruleId?: string;
    message: string;
  }[];
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
