import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { StateTracker } from '../../../src/state/tracker.js';

describe('StateTracker', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(process.cwd(), `test-fixtures-state-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('should start with empty state when no state file exists', async () => {
      const tracker = new StateTracker(testDir);
      await tracker.load();

      const violations = tracker.getCachedViolations(['any-file.ts']);
      expect(violations).toEqual([]);
    });

    it('should load existing state from file', async () => {
      const stateDir = join(testDir, '.cmc');
      await mkdir(stateDir, { recursive: true });

      const stateContent = JSON.stringify({
        last_check: '2025-01-01T00:00:00Z',
        files: {
          'test.ts': {
            hash: 'abc123',
            checked_at: '2025-01-01T00:00:00Z',
            violations: [{ rule: 'no-console', line: 5, message: 'No console' }],
          },
        },
        ruleset_versions: {},
      });
      await writeFile(join(stateDir, 'state.json'), stateContent);

      const tracker = new StateTracker(testDir);
      await tracker.load();

      const violations = tracker.getCachedViolations(['test.ts']);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('no-console');
    });
  });

  describe('filterChangedFiles', () => {
    it('should mark all files as changed when no cache exists', async () => {
      await writeFile(join(testDir, 'file1.ts'), 'content1');
      await writeFile(join(testDir, 'file2.ts'), 'content2');

      const tracker = new StateTracker(testDir);
      await tracker.load();

      const { changed, unchanged } = await tracker.filterChangedFiles(['file1.ts', 'file2.ts']);

      expect(changed).toEqual(['file1.ts', 'file2.ts']);
      expect(unchanged).toEqual([]);
    });

    it('should detect unchanged files by hash', async () => {
      await writeFile(join(testDir, 'file1.ts'), 'content1');

      const tracker = new StateTracker(testDir);
      await tracker.load();

      // Simulate a previous check by updating state
      const fileResults = new Map([
        [
          'file1.ts',
          {
            file: 'file1.ts',
            hash: await tracker.hashFile(join(testDir, 'file1.ts')),
            violations: [],
            checkedAt: new Date().toISOString(),
          },
        ],
      ]);
      await tracker.updateState(['file1.ts'], fileResults);

      // Now check again - file should be unchanged
      const { changed, unchanged } = await tracker.filterChangedFiles(['file1.ts']);

      expect(changed).toEqual([]);
      expect(unchanged).toEqual(['file1.ts']);
    });

    it('should detect changed files by hash', async () => {
      await writeFile(join(testDir, 'file1.ts'), 'content1');

      const tracker = new StateTracker(testDir);
      await tracker.load();

      // Simulate a previous check
      const fileResults = new Map([
        [
          'file1.ts',
          {
            file: 'file1.ts',
            hash: await tracker.hashFile(join(testDir, 'file1.ts')),
            violations: [],
            checkedAt: new Date().toISOString(),
          },
        ],
      ]);
      await tracker.updateState(['file1.ts'], fileResults);

      // Modify the file
      await writeFile(join(testDir, 'file1.ts'), 'modified content');

      // Now check again - file should be changed
      const { changed, unchanged } = await tracker.filterChangedFiles(['file1.ts']);

      expect(changed).toEqual(['file1.ts']);
      expect(unchanged).toEqual([]);
    });
  });

  describe('save', () => {
    it('should create .cmc directory and state file', async () => {
      const tracker = new StateTracker(testDir);
      await tracker.load();
      await tracker.save();

      expect(existsSync(join(testDir, '.cmc', 'state.json'))).toBe(true);
    });

    it('should persist state to disk', async () => {
      await writeFile(join(testDir, 'file1.ts'), 'content1');

      const tracker = new StateTracker(testDir);
      await tracker.load();

      const hash = await tracker.hashFile(join(testDir, 'file1.ts'));
      const fileResults = new Map([
        [
          'file1.ts',
          {
            file: 'file1.ts',
            hash,
            violations: [
              { file: 'file1.ts', line: 1, column: null, rule: 'test', message: 'Test' },
            ],
            checkedAt: new Date().toISOString(),
          },
        ],
      ]);
      await tracker.updateState(['file1.ts'], fileResults);
      await tracker.save();

      // Load state in new tracker instance
      const newTracker = new StateTracker(testDir);
      await newTracker.load();

      const violations = newTracker.getCachedViolations(['file1.ts']);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('test');
    });
  });

  describe('hashFile', () => {
    it('should return consistent hash for same content', async () => {
      await writeFile(join(testDir, 'file1.ts'), 'same content');
      await writeFile(join(testDir, 'file2.ts'), 'same content');

      const tracker = new StateTracker(testDir);

      const hash1 = await tracker.hashFile(join(testDir, 'file1.ts'));
      const hash2 = await tracker.hashFile(join(testDir, 'file2.ts'));

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('should return different hash for different content', async () => {
      await writeFile(join(testDir, 'file1.ts'), 'content1');
      await writeFile(join(testDir, 'file2.ts'), 'content2');

      const tracker = new StateTracker(testDir);

      const hash1 = await tracker.hashFile(join(testDir, 'file1.ts'));
      const hash2 = await tracker.hashFile(join(testDir, 'file2.ts'));

      expect(hash1).not.toBe(hash2);
    });

    it('should return empty string for non-existent file', async () => {
      const tracker = new StateTracker(testDir);

      const hash = await tracker.hashFile(join(testDir, 'nonexistent.ts'));

      expect(hash).toBe('');
    });
  });
});
