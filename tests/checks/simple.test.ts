import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { runSimpleCheck } from '../../src/checks/simple.js';

describe('simple checks', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(process.cwd(), `test-fixtures-simple-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('file-length', () => {
    it('should return no violations for files under the limit', async () => {
      const content = 'line1\nline2\nline3\n';
      await writeFile(join(testDir, 'short.ts'), content);

      const violations = await runSimpleCheck(testDir, 'short.ts', 'file-length', {
        type: 'simple',
        check: 'file-length',
        max: 500,
        message: 'File too long',
      });

      expect(violations).toHaveLength(0);
    });

    it('should return a violation for files over the limit', async () => {
      const content = Array(600).fill('line').join('\n');
      await writeFile(join(testDir, 'long.ts'), content);

      const violations = await runSimpleCheck(testDir, 'long.ts', 'file-length', {
        type: 'simple',
        check: 'file-length',
        max: 500,
        message: 'File too long',
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('file-length');
      expect(violations[0].message).toContain('exceeds 500 lines');
    });

    it('should use custom max value', async () => {
      const content = Array(15).fill('line').join('\n');
      await writeFile(join(testDir, 'medium.ts'), content);

      const violations = await runSimpleCheck(testDir, 'medium.ts', 'file-length', {
        type: 'simple',
        check: 'file-length',
        max: 10,
        message: 'File too long',
      });

      expect(violations).toHaveLength(1);
    });
  });

  describe('no-console', () => {
    it('should detect console.log statements', async () => {
      const content = `
function test() {
  console.log('hello');
}
`;
      await writeFile(join(testDir, 'with-console.ts'), content);

      const violations = await runSimpleCheck(testDir, 'with-console.ts', 'no-console', {
        type: 'simple',
        check: 'no-console',
        message: 'No console',
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('no-console');
      expect(violations[0].line).toBe(3);
    });

    it('should detect multiple console statements', async () => {
      const content = `
console.log('one');
console.warn('two');
console.error('three');
`;
      await writeFile(join(testDir, 'multi-console.ts'), content);

      const violations = await runSimpleCheck(testDir, 'multi-console.ts', 'no-console', {
        type: 'simple',
        check: 'no-console',
        message: 'No console',
      });

      expect(violations).toHaveLength(3);
    });

    it('should not flag commented console statements', async () => {
      const content = `
// console.log('commented');
function test() {
  return 1;
}
`;
      await writeFile(join(testDir, 'commented.ts'), content);

      const violations = await runSimpleCheck(testDir, 'commented.ts', 'no-console', {
        type: 'simple',
        check: 'no-console',
        message: 'No console',
      });

      expect(violations).toHaveLength(0);
    });

    it('should only apply to JS/TS files', async () => {
      const content = 'console.log("test")';
      await writeFile(join(testDir, 'test.py'), content);

      const violations = await runSimpleCheck(testDir, 'test.py', 'no-console', {
        type: 'simple',
        check: 'no-console',
        message: 'No console',
      });

      expect(violations).toHaveLength(0);
    });
  });

  describe('no-print', () => {
    it('should detect print statements in Python files', async () => {
      const content = `
def test():
    print("hello")
`;
      await writeFile(join(testDir, 'with-print.py'), content);

      const violations = await runSimpleCheck(testDir, 'with-print.py', 'no-print', {
        type: 'simple',
        check: 'no-print',
        message: 'No print',
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('no-print');
      expect(violations[0].line).toBe(3);
    });

    it('should not flag commented print statements', async () => {
      const content = `
# print("commented")
def test():
    pass
`;
      await writeFile(join(testDir, 'commented.py'), content);

      const violations = await runSimpleCheck(testDir, 'commented.py', 'no-print', {
        type: 'simple',
        check: 'no-print',
        message: 'No print',
      });

      expect(violations).toHaveLength(0);
    });

    it('should only apply to Python files', async () => {
      const content = 'print("test")';
      await writeFile(join(testDir, 'test.ts'), content);

      const violations = await runSimpleCheck(testDir, 'test.ts', 'no-print', {
        type: 'simple',
        check: 'no-print',
        message: 'No print',
      });

      expect(violations).toHaveLength(0);
    });
  });

  describe('require-docstrings', () => {
    it('should detect functions without docstrings', async () => {
      const content = `
def my_function():
    pass
`;
      await writeFile(join(testDir, 'no-docstring.py'), content);

      const violations = await runSimpleCheck(testDir, 'no-docstring.py', 'require-docstrings', {
        type: 'simple',
        check: 'require-docstrings',
        scope: 'functions',
        message: 'Missing docstring',
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('require-docstrings');
    });

    it('should not flag functions with docstrings', async () => {
      const content = `
def my_function():
    """This is a docstring."""
    pass
`;
      await writeFile(join(testDir, 'with-docstring.py'), content);

      const violations = await runSimpleCheck(testDir, 'with-docstring.py', 'require-docstrings', {
        type: 'simple',
        check: 'require-docstrings',
        scope: 'functions',
        message: 'Missing docstring',
      });

      expect(violations).toHaveLength(0);
    });

    it('should skip dunder methods', async () => {
      const content = `
def __init__(self):
    pass
`;
      await writeFile(join(testDir, 'dunder.py'), content);

      const violations = await runSimpleCheck(testDir, 'dunder.py', 'require-docstrings', {
        type: 'simple',
        check: 'require-docstrings',
        scope: 'functions',
        message: 'Missing docstring',
      });

      expect(violations).toHaveLength(0);
    });
  });
});
