/**
 * E2E tests for `cmc registry` command
 */

import { describe, it, expect } from 'vitest';
import { run } from './runner.js';

describe('cmc registry validate', () => {
  it('validates valid registries and exits 0', async () => {
    const result = await run('registry/valid-registry', ['registry', 'validate']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('prompts.json passes validation');
    expect(result.stdout).toContain('rulesets.json passes validation');
  });

  it('detects missing files referenced in registry', async () => {
    const result = await run('registry/invalid-registry', ['registry', 'validate']);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('file not found');
  });

  it('outputs JSON when --json flag is used', async () => {
    const result = await run('registry/valid-registry', ['registry', 'validate', '--json']);
    const output = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.valid).toBe(true);
    expect(output.prompts.valid).toBe(true);
    expect(output.rulesets.valid).toBe(true);
  });
});

describe('cmc registry list', () => {
  it('lists all available entries', async () => {
    const result = await run('registry/valid-registry', ['registry', 'list']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('internal/python/3.12');
    expect(result.stdout).toContain('internal/typescript/5.5');
  });

  it('filters by tier', async () => {
    const result = await run('registry/valid-registry', ['registry', 'list', '--tier=internal']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('internal/');
  });

  it('filters by language', async () => {
    const result = await run('registry/valid-registry', ['registry', 'list', '--language=python']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('python');
    expect(result.stdout).not.toContain('typescript');
  });

  it('outputs JSON when --json flag is used', async () => {
    const result = await run('registry/valid-registry', ['registry', 'list', '--json']);
    const output = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(Array.isArray(output)).toBe(true);
    expect(output.length).toBeGreaterThan(0);
    expect(output[0]).toHaveProperty('key');
    expect(output[0]).toHaveProperty('type');
  });
});

describe('cmc registry check', () => {
  it('finds existing entry', async () => {
    const result = await run('registry/valid-registry', [
      'registry',
      'check',
      'internal/python/3.12',
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Found');
    expect(result.stdout).toContain('internal/python/3.12');
  });

  it('reports missing entry', async () => {
    const result = await run('registry/valid-registry', [
      'registry',
      'check',
      'nonexistent/entry/1.0',
    ]);

    expect(result.exitCode).toBe(1);
    // Error output may go to stdout or stderr
    const output = result.stdout + result.stderr;
    expect(output).toContain('Not found');
  });

  it('outputs JSON when --json flag is used', async () => {
    const result = await run('registry/valid-registry', [
      'registry',
      'check',
      'internal/python/3.12',
      '--json',
    ]);
    const output = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.exists).toBe(true);
    expect(output.key).toBe('internal/python/3.12');
    expect(output.type).toBe('prompt');
  });
});

describe('cmc registry sync', () => {
  it('reports registries in sync', async () => {
    const result = await run('registry/valid-registry', ['registry', 'sync']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('in sync');
  });

  it('supports --dry-run flag', async () => {
    const result = await run('registry/valid-registry', ['registry', 'sync', '--dry-run']);

    expect(result.exitCode).toBe(0);
  });

  it('outputs JSON when --json flag is used', async () => {
    const result = await run('registry/valid-registry', ['registry', 'sync', '--json']);
    const output = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output).toHaveProperty('changes');
    expect(Array.isArray(output.changes)).toBe(true);
  });
});

describe('cmc registry bump', () => {
  it('shows bump preview with --dry-run', async () => {
    const result = await run('registry/valid-registry', [
      'registry',
      'bump',
      'internal/python/3.12',
      '--type=patch',
      '--dry-run',
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('1.0.0');
    expect(result.stdout).toContain('1.0.1');
    expect(result.stdout).toContain('Dry run');
  });

  it('outputs JSON when --json flag is used', async () => {
    const result = await run('registry/valid-registry', [
      'registry',
      'bump',
      'internal/python/3.12',
      '--type=patch',
      '--dry-run',
      '--json',
    ]);
    const output = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.currentVersion).toBe('1.0.0');
    expect(output.newVersion).toBe('1.0.1');
    expect(output.dryRun).toBe(true);
  });

  it('fails for nonexistent entry', async () => {
    const result = await run('registry/valid-registry', [
      'registry',
      'bump',
      'nonexistent/entry/1.0',
      '--type=patch',
    ]);

    expect(result.exitCode).toBe(1);
    // Error output may go to stdout or stderr
    const output = result.stdout + result.stderr;
    expect(output).toContain('not found');
  });

  it('supports different bump types', async () => {
    // Test minor bump
    const minorResult = await run('registry/valid-registry', [
      'registry',
      'bump',
      'internal/python/3.12',
      '--type=minor',
      '--dry-run',
      '--json',
    ]);
    const minorOutput = JSON.parse(minorResult.stdout);
    expect(minorOutput.newVersion).toBe('1.1.0');

    // Test major bump
    const majorResult = await run('registry/valid-registry', [
      'registry',
      'bump',
      'internal/python/3.12',
      '--type=major',
      '--dry-run',
      '--json',
    ]);
    const majorOutput = JSON.parse(majorResult.stdout);
    expect(majorOutput.newVersion).toBe('2.0.0');
  });
});
