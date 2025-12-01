/**
 * E2E tests for `cmc context` command
 */

import { describe, it, expect } from 'vitest';
import { runInDocker } from './docker-runner.js';
import { dockerAvailable, images, setupImages } from './setup.js';

// Setup: Build required images
setupImages(['context', 'context-multiple', 'context-missing']);

// =============================================================================
// Context: stdout output
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc context - stdout', () => {
  it('outputs template content to stdout', async () => {
    const result = await runInDocker(images['context'], ['context', '--stdout']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TypeScript Coding Standards');
    expect(result.stdout).toContain('NEVER use `var`');
  }, 30000);

  it('concatenates multiple templates', async () => {
    const result = await runInDocker(images['context-multiple'], ['context', '--stdout']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TypeScript Coding Standards');
    expect(result.stdout).toContain('Python Coding Standards');
  }, 30000);
});

// =============================================================================
// Context: Target file output
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc context - target files', () => {
  it('appends to CLAUDE.md for --target claude', async () => {
    const result = await runInDocker(images['context'], ['context', '--target', 'claude']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Appended context to CLAUDE.md');
  }, 30000);

  it('appends to .cursorrules for --target cursor', async () => {
    const result = await runInDocker(images['context'], ['context', '--target', 'cursor']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Appended context to .cursorrules');
  }, 30000);

  it('appends to .github/copilot-instructions.md for --target copilot', async () => {
    const result = await runInDocker(images['context'], ['context', '--target', 'copilot']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Appended context to .github/copilot-instructions.md');
  }, 30000);
});

// =============================================================================
// Context: Error handling
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc context - error handling', () => {
  it('exits with error when no templates configured', async () => {
    const result = await runInDocker(images['context-missing'], ['context', '--stdout']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('No ai-context templates configured');
  }, 30000);

  it('exits with error for invalid target', async () => {
    const result = await runInDocker(images['context'], ['context', '--target', 'invalid']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Invalid target');
  }, 30000);

  it('exits with error when no target or stdout specified', async () => {
    const result = await runInDocker(images['context'], ['context']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Either --target or --stdout must be specified');
  }, 30000);
});

// =============================================================================
// Context: Help text
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc context - help', () => {
  it('shows help with available targets', async () => {
    const result = await runInDocker(images['context'], ['context', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--target');
    expect(result.stdout).toContain('--stdout');
  }, 30000);
});
