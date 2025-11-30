import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import type { ProjectConfig } from '../types.js';

// Dynamic import for TOML parser
async function parseTOML(content: string): Promise<any> {
  const TOML = await import('@iarna/toml');
  return TOML.parse(content);
}

export async function loadConfig(configPath?: string): Promise<ProjectConfig> {
  const { path: foundPath, projectRoot } = await discoverConfig(configPath);

  const content = await readFile(foundPath, 'utf-8');
  const parsed = await parseTOML(content);

  validateConfig(parsed);

  return {
    projectRoot,
    ...parsed,
  } as ProjectConfig;
}

async function discoverConfig(
  explicitPath?: string
): Promise<{ path: string; projectRoot: string }> {
  if (explicitPath) {
    const absolutePath = resolve(explicitPath);
    if (!existsSync(absolutePath)) {
      throw new ConfigNotFoundError(`Configuration file not found: ${explicitPath}`);
    }
    return {
      path: absolutePath,
      projectRoot: dirname(absolutePath),
    };
  }

  // Search from current directory upward
  let currentDir = process.cwd();
  const root = dirname(currentDir);

  while (currentDir !== root) {
    const configPath = join(currentDir, 'cmc.toml');
    if (existsSync(configPath)) {
      return {
        path: configPath,
        projectRoot: currentDir,
      };
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  // Check root as well
  const rootConfig = join(currentDir, 'cmc.toml');
  if (existsSync(rootConfig)) {
    return {
      path: rootConfig,
      projectRoot: currentDir,
    };
  }

  throw new ConfigNotFoundError(
    'Configuration file not found\n\n' +
      'No cmc.toml found in current directory or parent directories.\n\n' +
      "Run 'cmc init' to create a configuration file."
  );
}

function validateConfig(config: any): void {
  if (!config.project) {
    throw new ConfigValidationError('Missing required [project] section in cmc.toml');
  }

  if (!config.project.name) {
    throw new ConfigValidationError('Missing required project.name in cmc.toml');
  }

  if (!config.project.category) {
    throw new ConfigValidationError('Missing required project.category in cmc.toml');
  }

  if (!config.rulesets) {
    throw new ConfigValidationError('Missing required [rulesets] section in cmc.toml');
  }
}

export class ConfigNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigNotFoundError';
  }
}

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}
