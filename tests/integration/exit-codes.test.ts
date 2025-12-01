import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestProject, minimalConfig, configWithDefaultRules } from './helpers.js';

describe('cmc check exit codes (integration)', () => {
  let project: TestProject;

  beforeEach(async () => {
    project = new TestProject();
    await project.setup();
  });

  afterEach(async () => {
    await project.cleanup();
  });

  describe('exit code 0 - no violations', () => {
    it('should exit 0 when no files to check', async () => {
      await project.createConfig(minimalConfig);

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(0);
    });

    it('should exit 0 when all files pass checks', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/clean.ts', 'export const x = 1;');

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(0);
    });

    it('should exit 0 with cached violations from previous run', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/clean.ts', 'export const x = 1;');

      // First run
      await project.run(['check']);

      // Second run with cache
      const result = await project.run(['check']);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('exit code 1 - violations found', () => {
    it('should exit 1 when console.log found', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/bad.ts', 'console.log("test");');

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(1);
    });

    it('should exit 1 when print found in Python', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('main.py', 'print("test")');

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(1);
    });

    it('should exit 1 when file exceeds max length', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/long.ts', Array(600).fill('x').join('\n'));

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(1);
    });

    it('should exit 1 with multiple violations', async () => {
      await project.createConfig(configWithDefaultRules);
      await project.createFile('src/a.ts', 'console.log("a");');
      await project.createFile('src/b.ts', 'console.log("b");');

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(1);
    });
  });

  describe('exit code 2 - configuration error', () => {
    it('should exit 2 when no config file exists', async () => {
      const result = await project.run(['check']);

      expect(result.exitCode).toBe(2);
    });

    it('should exit 2 when config is missing project section', async () => {
      await project.createConfig(`
[rulesets]
default = []
`);

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(2);
    });

    it('should exit 2 when config is missing project.name', async () => {
      await project.createConfig(`
[project]
category = "production"

[rulesets]
default = []
`);

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(2);
    });

    it('should exit 2 when config is missing rulesets section', async () => {
      await project.createConfig(`
[project]
name = "test"
category = "production"
`);

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(2);
    });

    it('should exit 2 when --verbose and --quiet used together', async () => {
      await project.createConfig(minimalConfig);

      const result = await project.run(['check', '--verbose', '--quiet']);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('--verbose and --quiet cannot be used together');
    });
  });
});
