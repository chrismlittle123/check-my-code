import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { z } from 'zod';
import type { Config } from '../types.js';

// Custom error class for configuration errors (exit code 2)
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

// JSON Schema for cmc.toml validation
// ESLint rule values: "off", "warn", "error", or array like ["error", "always"]
const eslintRuleValueSchema = z.union([
  z.enum(['off', 'warn', 'error']),
  z.tuple([z.string()]).rest(z.unknown()),
]);

// Ruff configuration schema
const ruffConfigSchema = z
  .object({
    'line-length': z.number().int().positive().optional(),
    lint: z
      .object({
        select: z.array(z.string()).optional(),
        ignore: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .passthrough(); // Allow additional ruff options

// Strip Symbol keys from an object (recursively)
// @iarna/toml adds Symbol keys for metadata that interfere with Zod validation
function stripSymbolKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(stripSymbolKeys);
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    result[key] = stripSymbolKeys((obj as Record<string, unknown>)[key]);
  }
  return result;
}

// Full cmc.toml schema
const configSchema = z.object({
  project: z.object({
    name: z.string().min(1, 'project name cannot be empty'),
  }),
  rulesets: z
    .object({
      eslint: z
        .object({
          rules: z.record(z.string(), eslintRuleValueSchema).optional(),
        })
        .optional(),
      ruff: ruffConfigSchema.optional(),
    })
    .optional(),
});

export async function loadConfig(projectRoot: string): Promise<Config> {
  const configPath = join(projectRoot, 'cmc.toml');

  if (!existsSync(configPath)) {
    throw new ConfigError(
      `No cmc.toml found.\n\nCreate a cmc.toml file with:\n  [project]\n  name = "your-project"`
    );
  }

  const content = await readFile(configPath, 'utf-8');
  const TOML = await import('@iarna/toml');

  let parsed: unknown;
  try {
    parsed = TOML.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parse error';
    throw new ConfigError(`Invalid TOML: ${message}`);
  }

  // Strip Symbol keys added by @iarna/toml (metadata like Symbol(type), Symbol(declared))
  parsed = stripSymbolKeys(parsed);

  // Validate against schema
  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => {
        // Convert path elements to strings (handles Symbol keys from @iarna/toml)
        const pathStr = issue.path.map((p) => String(p)).join('.');
        return `  - ${pathStr}: ${issue.message}`;
      })
      .join('\n');
    throw new ConfigError(`Invalid cmc.toml:\n${errors}`);
  }

  return result.data as Config;
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
