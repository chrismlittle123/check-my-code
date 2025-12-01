/**
 * Shared setup for e2e tests
 *
 * Project structure: command/language/test
 *
 * check/
 *   typescript/default         - TypeScript linting
 *   typescript/no-eslint       - Degraded: no ESLint installed
 *   python/default             - Python linting
 *   python/no-ruff             - Degraded: no Ruff installed
 *   typescript-and-python/default - Mixed-language projects
 *
 * context/
 *   no-language/single    - Single template
 *   no-language/missing   - No templates configured
 *   no-language/multiple  - Multiple templates
 *
 * verify/
 *   typescript-and-python/match     - Matching configs
 *   typescript-and-python/mismatch  - Mismatching configs
 *   typescript-and-python/missing   - Missing config files
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

// Shared image registry (keyed by project path)
export const images: Record<string, string> = {};

// All available project paths
const ALL_PROJECTS = [
  // check command
  'check/typescript/default',
  'check/typescript/no-eslint',
  'check/python/default',
  'check/python/no-ruff',
  'check/typescript-and-python/default',
  // context command
  'context/no-language/single',
  'context/no-language/missing',
  'context/no-language/multiple',
  // verify command
  'verify/typescript-and-python/match',
  'verify/typescript-and-python/mismatch',
  'verify/typescript-and-python/missing',
];

/**
 * Setup function to build Docker images for specified project paths
 * @param projectPaths - Paths relative to tests/e2e/projects (e.g., 'check/typescript/default')
 */
export function setupImages(projectPaths: string[] = ALL_PROJECTS) {
  beforeAll(async () => {
    if (!dockerAvailable) return;

    const results = await Promise.all(projectPaths.map((path) => buildImage(path)));

    projectPaths.forEach((path, i) => {
      images[path] = results[i];
    });
  }, 300000);

  afterAll(async () => {
    if (dockerAvailable) {
      const imagesToClean = projectPaths.map((path) => images[path]).filter(Boolean);
      await cleanupImages(imagesToClean);
    }
  }, 30000);
}
