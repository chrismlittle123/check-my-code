/* eslint-disable no-await-in-loop -- Sequential file hashing is intentional */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import type { StateData, FileCheckResult, Violation } from '../types.js';

export class StateTracker {
  private projectRoot: string;
  private statePath: string;
  private state: StateData;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.statePath = join(projectRoot, '.cmc', 'state.json');
    this.state = {
      last_check: '',
      files: {},
      ruleset_versions: {},
    };
  }

  async load(): Promise<void> {
    if (!existsSync(this.statePath)) {
      return;
    }

    try {
      const content = await readFile(this.statePath, 'utf-8');
      this.state = JSON.parse(content);
    } catch {
      // If state file is corrupted, start fresh
      this.state = {
        last_check: '',
        files: {},
        ruleset_versions: {},
      };
    }
  }

  async save(): Promise<void> {
    const dir = dirname(this.statePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    this.state.last_check = new Date().toISOString();
    await writeFile(this.statePath, JSON.stringify(this.state, null, 2));
  }

  async filterChangedFiles(files: string[]): Promise<{ changed: string[]; unchanged: string[] }> {
    const changed: string[] = [];
    const unchanged: string[] = [];

    for (const file of files) {
      const absolutePath = join(this.projectRoot, file);
      const currentHash = await this.hashFile(absolutePath);

      const cachedState = this.state.files[file];
      if (cachedState?.hash === currentHash) {
        unchanged.push(file);
      } else {
        changed.push(file);
      }
    }

    return { changed, unchanged };
  }

  async hashFile(filePath: string): Promise<string> {
    try {
      const content = await readFile(filePath);
      return createHash('sha256').update(content).digest('hex');
    } catch {
      return '';
    }
  }

  async updateState(files: string[], results: Map<string, FileCheckResult>): Promise<void> {
    for (const file of files) {
      const result = results.get(file);
      if (result) {
        this.state.files[file] = {
          hash: result.hash,
          checked_at: result.checkedAt,
          violations: result.violations.map((v) => ({
            rule: v.rule,
            line: v.line,
            message: v.message,
          })),
        };
      }
    }
  }

  getCachedViolations(files: string[]): Violation[] {
    const violations: Violation[] = [];

    for (const file of files) {
      const cached = this.state.files[file];
      if (cached?.violations) {
        for (const v of cached.violations) {
          violations.push({
            file,
            line: v.line,
            column: null,
            rule: v.rule,
            message: v.message,
          });
        }
      }
    }

    return violations;
  }

  getFileHash(file: string): string | undefined {
    return this.state.files[file]?.hash;
  }
}
