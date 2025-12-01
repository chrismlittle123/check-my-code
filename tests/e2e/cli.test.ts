/**
 * E2E tests for CLI basics (--help, --version)
 */

import { describe, it, expect } from 'vitest';
import { runInDocker } from './docker-runner.js';
import { dockerAvailable, images, setupImages } from './setup.js';

// Setup: Build required images (only need typescript for CLI tests)
setupImages(['check/typescript/default']);

// =============================================================================
// CLI: Basic flags and help
// =============================================================================
describe.skipIf(!dockerAvailable)('CLI basics', () => {
  it('--version outputs version number', async () => {
    const result = await runInDocker(images['check/typescript/default'], ['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  }, 30000);

  it('--help outputs usage information', async () => {
    const result = await runInDocker(images['check/typescript/default'], ['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('check');
    expect(result.stdout).toContain('generate');
  }, 30000);
});
