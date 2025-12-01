/**
 * Shared setup for e2e tests
 *
 * Projects:
 * - typescript: Node + ESLint (TypeScript linting, config generation, CLI tests)
 * - python: Python + Ruff (Python linting)
 * - full: Both linters (mixed-language projects)
 * - degraded-ruff: Python files without Ruff installed
 * - degraded-eslint: TypeScript files without ESLint installed
 */

import { beforeAll, afterAll } from 'vitest';
import { isDockerAvailable, cleanupImages, buildImage } from './docker-runner.js';

export interface JsonOutput {
  violations: {
    file: string;
    line: number | null;
    column: number | null;
    rule: string;
    message: string;
    linter: 'eslint' | 'ruff';
  }[];
  summary: {
    files_checked: number;
    violations_count: number;
  };
}

// Check Docker availability at module load
export const dockerAvailable = await isDockerAvailable();

if (!dockerAvailable) {
  console.warn('Docker not available - skipping Docker-based e2e tests');
}

// Shared image registry
export const images: Record<string, string> = {};

// All available projects
const ALL_PROJECTS = [
  'typescript',
  'python',
  'full',
  'degraded-ruff',
  'degraded-eslint',
  'context',
  'context-multiple',
  'context-missing',
];

/**
 * Setup function to build Docker images for specified projects
 */
export function setupImages(projectNames: string[] = ALL_PROJECTS) {
  beforeAll(async () => {
    if (!dockerAvailable) return;

    const results = await Promise.all(projectNames.map((name) => buildImage(name)));

    projectNames.forEach((name, i) => {
      images[name] = results[i];
    });
  }, 300000);

  afterAll(async () => {
    if (dockerAvailable) {
      const imagesToClean = projectNames.map((name) => images[name]).filter(Boolean);
      await cleanupImages(imagesToClean);
    }
  }, 30000);
}
