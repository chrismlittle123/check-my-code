/**
 * Shared setup for e2e tests
 *
 * Project structure: command/language/test
 *
 * check/
 *   typescript/default         - TypeScript linting
 *   typescript/no-eslint       - Degraded: no ESLint installed
 *   typescript/empty-project   - No source files
 *   typescript/special-chars   - Files with spaces/dashes/underscores
 *   typescript/multi-violations - Multiple violations per file
 *   typescript/symlinks        - Symlinked files and directories
 *   python/default             - Python linting
 *   python/no-ruff             - Degraded: no Ruff installed
 *   typescript-and-python/default    - Mixed-language projects
 *   typescript-and-python/no-linters - No linters installed
 *
 * context/
 *   no-language/single          - Single template
 *   no-language/missing         - No templates configured
 *   no-language/multiple        - Multiple templates
 *   no-language/invalid-source  - Invalid remote source URL
 *   no-language/invalid-template - Template not found in source
 *
 * audit/
 *   typescript-and-python/match        - Matching configs
 *   typescript-and-python/mismatch     - Mismatching configs
 *   typescript-and-python/missing      - Missing config files
 *   typescript-and-python/malformed    - Syntax errors in config files
 *   typescript-and-python/empty-ruleset - No rulesets defined
 *
 * generate/
 *   existing-config  - Configs already exist
 *   fresh           - No existing configs
 *   empty-ruleset   - No rulesets defined
 *
 * mcp-server/
 *   default         - MCP server with TypeScript and Python files
 */

import { beforeAll } from 'vitest';
import { isDockerAvailable, buildImage } from './docker-runner.js';

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
  'check/typescript/empty-project',
  'check/typescript/special-chars',
  'check/typescript/multi-violations',
  'check/typescript/symlinks',
  'check/typescript/subdirectory',
  'check/python/default',
  'check/python/no-ruff',
  'check/typescript-and-python/default',
  'check/typescript-and-python/no-linters',
  'check/config-errors/no-config',
  'check/config-errors/invalid-toml',
  'check/config-errors/missing-name',
  // context command
  'context/no-language/single',
  'context/no-language/missing',
  'context/no-language/multiple',
  'context/no-language/invalid-source',
  'context/no-language/invalid-template',
  // audit command
  'audit/typescript-and-python/match',
  'audit/typescript-and-python/mismatch',
  'audit/typescript-and-python/missing',
  'audit/typescript-and-python/malformed',
  'audit/typescript-and-python/empty-ruleset',
  // generate command
  'generate/existing-config',
  'generate/fresh',
  'generate/empty-ruleset',
  // mcp-server command
  'mcp-server/default',
];

/**
 * Setup function to build Docker images for specified project paths
 * @param projectPaths - Paths relative to tests/e2e/projects (e.g., 'check/typescript/default')
 *
 * Note: Images are NOT cleaned up between test files to allow reuse.
 * Run `docker rmi $(docker images -q 'cmc-e2e-*')` manually to clean up.
 */
export function setupImages(projectPaths: string[] = ALL_PROJECTS) {
  beforeAll(async () => {
    if (!dockerAvailable) return;

    const results = await Promise.all(projectPaths.map((path) => buildImage(path)));

    projectPaths.forEach((path, i) => {
      images[path] = results[i];
    });
  }, 300000);

  // No cleanup - images are reused across test files for speed
}
