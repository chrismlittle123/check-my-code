import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestProject, configWithDefaultRules } from './helpers.js';

describe('cmc check output formats (integration)', () => {
  let project: TestProject;

  beforeEach(async () => {
    project = new TestProject();
    await project.setup();
  });

  afterEach(async () => {
    await project.cleanup();
  });

  describe('default output', () => {
    it('should output violations in file:line rule format', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile(
        'src/index.ts',
        `
const x = 1;
console.log(x);
`
      );

      const result = await project.run(['check']);

      expect(result.stdout).toMatch(/src\/index\.ts:\d+ no-console/);
    });

    it('should output violation count at the end', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/a.ts', 'console.log("a");');
      await project.createFile('src/b.ts', 'console.log("b");');

      const result = await project.run(['check']);

      expect(result.stdout).toContain('2 violations found');
    });

    it('should use singular form for single violation', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/a.ts', 'console.log("a");');

      const result = await project.run(['check']);

      expect(result.stdout).toContain('1 violation found');
    });

    it('should output "No violations found" when clean', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/clean.ts', 'export const x = 1;');

      const result = await project.run(['check']);

      expect(result.stdout).toContain('No violations found');
    });
  });

  describe('--quiet output', () => {
    it('should only output the violation count', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/a.ts', 'console.log("a");');
      await project.createFile('src/b.ts', 'console.log("b");');

      const result = await project.run(['check', '--quiet']);

      expect(result.stdout.trim()).toBe('2');
    });

    it('should output 0 when no violations', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/clean.ts', 'export const x = 1;');

      const result = await project.run(['check', '--quiet']);

      expect(result.stdout.trim()).toBe('0');
    });
  });

  describe('--verbose output', () => {
    it('should include violation messages', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'console.log("test");');

      const result = await project.run(['check', '--verbose']);

      expect(result.stdout).toContain('Unexpected console statement');
    });

    it('should show file count and timing', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'export const x = 1;');

      const result = await project.run(['check', '--verbose']);

      expect(result.stdout).toMatch(/Checked \d+ files in \d+\.\d+s/);
    });

    it('should show cached vs checked file counts', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'export const x = 1;');

      // First run to populate cache
      await project.run(['check']);

      // Add another file
      await project.createFile('src/new.ts', 'export const y = 2;');

      const result = await project.run(['check', '--verbose']);

      expect(result.stdout).toMatch(/\d+ cached/);
    });
  });

  describe('--json output', () => {
    it('should output valid JSON', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'console.log("test");');

      const result = await project.run(['check', '--json']);

      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it('should include summary section', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'console.log("test");');

      const result = await project.run(['check', '--json']);
      const output = JSON.parse(result.stdout);

      expect(output.summary).toBeDefined();
      expect(output.summary.files_checked).toBeTypeOf('number');
      expect(output.summary.files_cached).toBeTypeOf('number');
      expect(output.summary.violations_total).toBeTypeOf('number');
      expect(output.summary.duration_ms).toBeTypeOf('number');
    });

    it('should include violations array', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'console.log("test");');

      const result = await project.run(['check', '--json']);
      const output = JSON.parse(result.stdout);

      expect(output.violations).toBeInstanceOf(Array);
      expect(output.violations.length).toBe(1);
      expect(output.violations[0]).toMatchObject({
        file: expect.stringContaining('index.ts'),
        rule: 'no-console',
        message: expect.any(String),
      });
    });

    it('should include line and column in violations', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile(
        'src/index.ts',
        `const x = 1;
console.log(x);
`
      );

      const result = await project.run(['check', '--json']);
      const output = JSON.parse(result.stdout);

      expect(output.violations[0].line).toBe(2);
    });

    it('should return empty violations array when clean', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/clean.ts', 'export const x = 1;');

      const result = await project.run(['check', '--json']);
      const output = JSON.parse(result.stdout);

      expect(output.violations).toEqual([]);
      expect(output.summary.violations_total).toBe(0);
    });
  });
});
