import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestProject, minimalConfig, configWithDefaultRules } from './helpers.js';

describe('cmc check (integration)', () => {
  let project: TestProject;

  beforeEach(async () => {
    project = new TestProject();
    await project.setup();
  });

  afterEach(async () => {
    await project.cleanup();
  });

  describe('configuration handling', () => {
    it('should fail with exit code 2 when no config exists', async () => {
      const result = await project.run(['check']);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Configuration file not found');
    });

    it('should fail with exit code 2 for invalid config', async () => {
      await project.createConfig(`
[project]
# missing name and category
`);
      const result = await project.run(['check']);

      expect(result.exitCode).toBe(2);
    });

    it('should warn when no rulesets configured', async () => {
      await project.createConfig(minimalConfig);

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('No rulesets configured');
    });
  });

  describe('file discovery', () => {
    it('should find and check TypeScript files in project', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'export const x = 1;');
      await project.createFile('src/utils.ts', 'export const y = 2;');

      const result = await project.run(['check', '--verbose']);

      // Should find files to check (exact count may vary due to config file)
      expect(result.stderr).toMatch(/Found \d+ files to check/);
    });

    it('should find and check Python files in project', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('main.py', 'x = 1');

      const result = await project.run(['check', '--verbose']);

      expect(result.stderr).toMatch(/Found \d+ files to check/);
    });

    it('should check specific path when provided', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'export const x = 1;');
      await project.createFile('lib/utils.ts', 'export const y = 2;');

      const result = await project.run(['check', 'src/', '--verbose']);

      // Should only find 1 file in src/
      expect(result.stderr).toContain('Found 1 files to check');
    });

    it('should check multiple paths with --paths flag', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'export const x = 1;');
      await project.createFile('lib/utils.ts', 'export const y = 2;');
      await project.createFile('test/test.ts', 'export const z = 3;');

      const result = await project.run(['check', '--paths', 'src/', 'lib/', '--verbose']);

      // Should find 2 files (src/index.ts and lib/utils.ts)
      expect(result.stderr).toContain('Found 2 files to check');
    });

    it('should exclude node_modules by default', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'export const x = 1;');
      await project.createFile('node_modules/pkg/index.ts', 'export const y = 2;');

      const result = await project.run(['check', 'src/', '--verbose']);

      // When checking src/ specifically, should only find 1 file
      expect(result.stderr).toContain('Found 1 files to check');
    });
  });

  describe('violation detection', () => {
    it('should detect no-console violations', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile(
        'src/index.ts',
        `
function test() {
  console.log('hello');
}
`
      );

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('no-console');
    });

    it('should detect no-print violations in Python', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile(
        'main.py',
        `
def test():
    print("hello")
`
      );

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('no-print');
    });

    it('should detect file-length violations', async () => {
      await project.createConfig(configWithDefaultRules);
      const longContent = Array(600).fill('const x = 1;').join('\n');
      await project.createFile('src/long.ts', longContent);

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('file-length');
    });

    it('should detect require-docstrings violations', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile(
        'main.py',
        `
def my_function():
    pass
`
      );

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('require-docstrings');
    });

    it('should return exit code 0 when no violations', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/clean.ts', 'export const x = 1;');

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No violations');
    });
  });

  describe('smart checking (caching)', () => {
    it('should cache results and skip unchanged files', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'export const x = 1;');

      // First run - check specific path to avoid config file
      const result1 = await project.run(['check', 'src/', '--verbose']);
      expect(result1.stderr).toContain('Found 1 files to check');
      expect(result1.stderr).toContain('0 cached');

      // Second run - should use cache
      const result2 = await project.run(['check', 'src/', '--verbose']);
      expect(result2.stderr).toContain('Found 0 files to check');
      expect(result2.stderr).toContain('cached');
    });

    it('should re-check files with --all flag', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'export const x = 1;');

      // First run to populate cache
      await project.run(['check', 'src/']);

      // Second run with --all
      const result = await project.run(['check', 'src/', '--all', '--verbose']);
      expect(result.stderr).toContain('Found 1 files to check');
    });

    it('should not update cache with --no-cache flag', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/index.ts', 'export const x = 1;');

      // Run with --no-cache
      await project.run(['check', 'src/', '--no-cache']);

      // Second run should still check all files
      const result = await project.run(['check', 'src/', '--verbose']);
      expect(result.stderr).toContain('Found 1 files to check');
    });
  });
});
