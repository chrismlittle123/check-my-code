import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { Config } from '../types.js';

export async function loadConfig(projectRoot: string): Promise<Config> {
  const configPath = join(projectRoot, 'cmc.toml');

  if (!existsSync(configPath)) {
    throw new Error(
      `Config not found: cmc.toml\nCreate a cmc.toml file with [project] name = "your-project"`
    );
  }

  const content = await readFile(configPath, 'utf-8');
  const TOML = await import('@iarna/toml');

  let parsed: unknown;
  try {
    parsed = TOML.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parse error';
    throw new Error(`Invalid TOML: ${message}`);
  }

  const config = parsed as Config;
  if (!config.project?.name) {
    throw new Error('Invalid config: [project] name is required');
  }

  return config;
}

export function findProjectRoot(): string {
  let dir = process.cwd();

  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'cmc.toml'))) {
      return dir;
    }
    dir = dirname(dir);
  }

  // Check root
  if (existsSync(join(dir, 'cmc.toml'))) {
    return dir;
  }

  return process.cwd();
}
