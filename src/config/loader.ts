import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import type { ProjectConfig } from '../types.js';
import { validateConfig, formatValidationErrors } from './validator.js';

// Dynamic import for TOML parser
async function parseTOML(content: string): Promise<unknown> {
  const TOML = await import('@iarna/toml');
  return TOML.parse(content);
}

export async function loadConfig(configPath?: string): Promise<ProjectConfig> {
  const { path: foundPath, projectRoot } = await discoverConfig(configPath);

  const content = await readFile(foundPath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = await parseTOML(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';
    throw new ConfigValidationError(`Invalid TOML syntax in cmc.toml:\n${message}`);
  }

  // Validate against JSON schema
  const validationResult = await validateConfig(parsed);
  if (!validationResult.valid) {
    const errorMessages = formatValidationErrors(validationResult.errors);
    throw new ConfigValidationError(`Invalid cmc.toml configuration:\n${errorMessages}`);
  }

  return {
    projectRoot,
    ...(parsed as Omit<ProjectConfig, 'projectRoot'>),
  };
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
