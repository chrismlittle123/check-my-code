import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestProject } from './helpers.js';
import {
  getInvalidConfigs,
  categoryPermutations,
  aiPermutations,
  rulesetPermutations,
  languageRulesetPermutations,
  getTestMatrix,
  minimalConfig,
  buildConfig,
} from '../utils/config-factory.js';

describe('Schema Validation (integration)', () => {
  let project: TestProject;

  beforeEach(async () => {
    project = new TestProject();
    await project.setup();
  });

  afterEach(async () => {
    await project.cleanup();
  });

  describe('invalid configs should fail validation', () => {
    const invalidConfigs = getInvalidConfigs();

    for (const testCase of invalidConfigs) {
      it(`should reject: ${testCase.description}`, async () => {
        await project.createConfig(testCase.config);
        await project.createFile('src/index.ts', 'export const x = 1;');

        const result = await project.run(['check']);

        expect(result.exitCode).toBe(2);
        expect(result.stderr).toMatch(testCase.expectedError);
      });
    }
  });

  describe('category permutations', () => {
    for (const { category, config } of categoryPermutations()) {
      it(`should accept category: ${category}`, async () => {
        await project.createConfig(config);
        await project.createFile('src/index.ts', 'export const x = 1;');

        const result = await project.run(['check']);

        // Should not fail with validation error (exit code 2)
        expect(result.exitCode).not.toBe(2);
        // May warn about no rulesets, but that's expected
        expect(result.stderr).not.toMatch(/Invalid.*category/i);
      });
    }

    it('should reject invalid category', async () => {
      // Manually create invalid config since factory only creates valid ones
      await project.createConfig(`
[project]
name = "test"
category = "invalid-category"

[rulesets]
default = []
`);
      await project.createFile('src/index.ts', 'export const x = 1;');

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toMatch(/Invalid value.*category/i);
    });
  });

  describe('AI configuration permutations', () => {
    for (const { description, config } of aiPermutations()) {
      it(`should accept: ${description}`, async () => {
        await project.createConfig(config);
        await project.createFile('src/index.ts', 'export const x = 1;');

        const result = await project.run(['check']);

        // Should not fail with validation error
        expect(result.exitCode).not.toBe(2);
      });
    }
  });

  describe('ruleset permutations', () => {
    for (const { description, config, rulesets } of rulesetPermutations()) {
      it(`should accept: ${description}`, async () => {
        await project.createConfig(config);
        await project.createFile('src/index.ts', 'export const x = 1;');

        const result = await project.run(['check']);

        // Empty rulesets should warn but exit 0
        if (rulesets.length === 0) {
          expect(result.exitCode).toBe(0);
          expect(result.stderr).toContain('No rulesets configured');
        } else {
          // With rulesets, should not have validation error
          expect(result.exitCode).not.toBe(2);
        }
      });
    }
  });

  describe('language-specific ruleset permutations', () => {
    for (const { description, config, languages } of languageRulesetPermutations()) {
      it(`should accept: ${description}`, async () => {
        await project.createConfig(config);

        // Create appropriate files for languages
        if (languages.includes('python')) {
          await project.createFile(
            'main.py',
            `"""Module docstring."""\ndef greet():\n    """Greet."""\n    pass\n`
          );
        }
        if (languages.includes('typescript')) {
          await project.createFile('src/index.ts', 'export const x = 1;');
        }

        const result = await project.run(['check']);

        // Should not fail with validation error
        expect(result.exitCode).not.toBe(2);
      });
    }
  });

  describe('test matrix - comprehensive permutations', () => {
    const matrix = getTestMatrix();

    // Run a subset of the matrix to keep tests fast
    const subset = matrix.slice(0, 10);

    for (const { name, config } of subset) {
      it(`should accept config: ${name}`, async () => {
        await project.createConfig(config);
        await project.createFile('src/index.ts', 'export const x = 1;');

        const result = await project.run(['check']);

        // Should not fail with validation error
        expect(result.exitCode).not.toBe(2);
      });
    }
  });

  describe('edge cases', () => {
    it('should accept project name with underscores', async () => {
      await project.createConfig(minimalConfig({ projectName: 'my_project_name' }));
      await project.createFile('src/index.ts', 'export const x = 1;');

      const result = await project.run(['check']);

      expect(result.exitCode).not.toBe(2);
    });

    it('should accept project name with hyphens', async () => {
      await project.createConfig(minimalConfig({ projectName: 'my-project-name' }));
      await project.createFile('src/index.ts', 'export const x = 1;');

      const result = await project.run(['check']);

      expect(result.exitCode).not.toBe(2);
    });

    it('should accept project name with numbers', async () => {
      await project.createConfig(minimalConfig({ projectName: 'project123' }));
      await project.createFile('src/index.ts', 'export const x = 1;');

      const result = await project.run(['check']);

      expect(result.exitCode).not.toBe(2);
    });

    it('should accept config with all optional sections', async () => {
      const fullConfig = buildConfig({
        projectName: 'full-config',
        projectCategory: 'production',
        projectDescription: 'A fully configured project',
        defaultRulesets: ['default'],
        languageRulesets: {
          python: { paths: ['**/*.py'], rules: [] },
          typescript: { paths: ['**/*.ts'], rules: [] },
        },
        aiEnabled: true,
        aiAgent: 'claude',
        aiMaxTokens: 10000,
        supportedAgents: ['claude', 'cursor'],
        includePaths: ['src/**/*'],
        excludePaths: ['node_modules', 'dist'],
        fileLength: { maxLines: 400 },
        outputFormat: 'verbose',
        outputColor: true,
      });

      await project.createConfig(fullConfig);
      await project.createFile('src/index.ts', 'export const x = 1;');

      const result = await project.run(['check']);

      expect(result.exitCode).not.toBe(2);
    });

    it('should reject ai.max_tokens at boundary (below min)', async () => {
      await project.createConfig(`
[project]
name = "test"
category = "production"

[rulesets]
default = []

[ai]
enabled = true
max_tokens = 99
`);
      await project.createFile('src/index.ts', 'export const x = 1;');

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toMatch(/too small|minimum/i);
    });

    it('should accept ai.max_tokens at boundary (at min)', async () => {
      await project.createConfig(`
[project]
name = "test"
category = "production"

[rulesets]
default = []

[ai]
enabled = true
max_tokens = 100
`);
      await project.createFile('src/index.ts', 'export const x = 1;');

      const result = await project.run(['check']);

      expect(result.exitCode).not.toBe(2);
    });

    it('should reject empty project name', async () => {
      await project.createConfig(`
[project]
name = ""
category = "production"

[rulesets]
default = []
`);
      await project.createFile('src/index.ts', 'export const x = 1;');

      const result = await project.run(['check']);

      expect(result.exitCode).toBe(2);
    });
  });
});
