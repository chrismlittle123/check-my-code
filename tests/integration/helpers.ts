import { spawn } from 'child_process';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const CLI_PATH = join(process.cwd(), 'dist', 'cli', 'index.js');

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCLI(args: string[], cwd: string): Promise<ExecResult> {
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

export class TestProject {
  public readonly path: string;

  constructor() {
    // Use system temp directory to avoid finding parent project's cmc.toml
    this.path = join(tmpdir(), `cmc-test-${randomUUID()}`);
  }

  async setup(): Promise<void> {
    await mkdir(this.path, { recursive: true });
  }

  async cleanup(): Promise<void> {
    await rm(this.path, { recursive: true, force: true });
  }

  async createConfig(content: string): Promise<void> {
    await writeFile(join(this.path, 'cmc.toml'), content);
  }

  async createFile(relativePath: string, content: string): Promise<void> {
    const fullPath = join(this.path, relativePath);
    const dir = join(fullPath, '..');
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content);
  }

  async run(args: string[]): Promise<ExecResult> {
    return runCLI(args, this.path);
  }
}

export const minimalConfig = `
[project]
name = "test-project"
category = "production"

[rulesets]
default = []

[ai]
enabled = false
`;

export const configWithDefaultRules = `
[project]
name = "test-project"
category = "production"

[rulesets]
default = ["default"]

[ai]
enabled = false
`;
