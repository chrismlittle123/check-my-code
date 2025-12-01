import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OutputFormatter } from '../../../src/output/cli.js';
import type { CheckResult, Violation } from '../../../src/types.js';

describe('OutputFormatter', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  const createResult = (violations: Violation[]): CheckResult => ({
    violations,
    filesChecked: 5,
    filesCached: 10,
    durationMs: 1500,
  });

  describe('default output', () => {
    it('should output "No violations found" when there are no violations', () => {
      const formatter = new OutputFormatter({});
      formatter.outputResults(createResult([]));

      expect(consoleSpy).toHaveBeenCalledWith('\nNo violations found');
    });

    it('should output violations in file:line rule format', () => {
      const violations: Violation[] = [
        { file: 'src/main.ts', line: 10, column: null, rule: 'no-console', message: 'Test' },
      ];
      const formatter = new OutputFormatter({});
      formatter.outputResults(createResult(violations));

      expect(consoleSpy).toHaveBeenCalledWith('src/main.ts:10 no-console');
    });

    it('should output file without line number when line is null', () => {
      const violations: Violation[] = [
        { file: 'src/main.ts', line: null, column: null, rule: 'file-length', message: 'Too long' },
      ];
      const formatter = new OutputFormatter({});
      formatter.outputResults(createResult(violations));

      expect(consoleSpy).toHaveBeenCalledWith('src/main.ts file-length');
    });

    it('should output violation count', () => {
      const violations: Violation[] = [
        { file: 'a.ts', line: 1, column: null, rule: 'r1', message: 'm1' },
        { file: 'b.ts', line: 2, column: null, rule: 'r2', message: 'm2' },
      ];
      const formatter = new OutputFormatter({});
      formatter.outputResults(createResult(violations));

      expect(consoleSpy).toHaveBeenCalledWith('\n2 violations found');
    });

    it('should use singular form for single violation', () => {
      const violations: Violation[] = [
        { file: 'a.ts', line: 1, column: null, rule: 'r1', message: 'm1' },
      ];
      const formatter = new OutputFormatter({});
      formatter.outputResults(createResult(violations));

      expect(consoleSpy).toHaveBeenCalledWith('\n1 violation found');
    });
  });

  describe('quiet output', () => {
    it('should only output the violation count', () => {
      const violations: Violation[] = [
        { file: 'a.ts', line: 1, column: null, rule: 'r1', message: 'm1' },
        { file: 'b.ts', line: 2, column: null, rule: 'r2', message: 'm2' },
        { file: 'c.ts', line: 3, column: null, rule: 'r3', message: 'm3' },
      ];
      const formatter = new OutputFormatter({ quiet: true });
      formatter.outputResults(createResult(violations));

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(3);
    });
  });

  describe('JSON output', () => {
    it('should output valid JSON', () => {
      const violations: Violation[] = [
        {
          file: 'src/main.ts',
          line: 10,
          column: 5,
          rule: 'no-console',
          message: 'Unexpected console',
          ruleset: 'default',
        },
      ];
      const formatter = new OutputFormatter({ json: true });
      formatter.outputResults(createResult(violations));

      const output = consoleSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.summary).toBeDefined();
      expect(parsed.summary.files_checked).toBe(5);
      expect(parsed.summary.files_cached).toBe(10);
      expect(parsed.summary.violations_total).toBe(1);
      expect(parsed.summary.duration_ms).toBe(1500);

      expect(parsed.violations).toHaveLength(1);
      expect(parsed.violations[0].file).toBe('src/main.ts');
      expect(parsed.violations[0].line).toBe(10);
      expect(parsed.violations[0].column).toBe(5);
      expect(parsed.violations[0].rule).toBe('no-console');
      expect(parsed.violations[0].message).toBe('Unexpected console');
      expect(parsed.violations[0].ruleset).toBe('default');
    });

    it('should set ruleset to null when not provided', () => {
      const violations: Violation[] = [
        { file: 'a.ts', line: 1, column: null, rule: 'r1', message: 'm1' },
      ];
      const formatter = new OutputFormatter({ json: true });
      formatter.outputResults(createResult(violations));

      const output = consoleSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.violations[0].ruleset).toBeNull();
    });
  });

  describe('verbose output', () => {
    it('should include messages with violations', () => {
      const violations: Violation[] = [
        {
          file: 'src/main.ts',
          line: 10,
          column: null,
          rule: 'no-console',
          message: 'Unexpected console statement',
        },
      ];
      const formatter = new OutputFormatter({ verbose: true });
      formatter.outputResults(createResult(violations));

      const calls = consoleSpy.mock.calls.map((c) => c[0]);
      expect(calls.some((c) => c.includes('Unexpected console statement'))).toBe(true);
    });

    it('should include timing information', () => {
      const formatter = new OutputFormatter({ verbose: true });
      formatter.outputResults(createResult([]));

      const calls = consoleSpy.mock.calls.map((c) => c[0]);
      expect(calls.some((c) => typeof c === 'string' && c.includes('1.5s'))).toBe(true);
    });
  });
});
