import { readFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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

// TypeScript compiler configuration schema
// Defines required tsconfig.json settings - audited via `cmc audit tsc`
// When enabled, `cmc check` runs `tsc --noEmit` using the project's tsconfig.json
const tscConfigSchema = z.object({
  enabled: z.boolean().optional(),
  // Strict type-checking options
  strict: z.boolean().optional(),
  noImplicitAny: z.boolean().optional(),
  strictNullChecks: z.boolean().optional(),
  strictFunctionTypes: z.boolean().optional(),
  strictBindCallApply: z.boolean().optional(),
  strictPropertyInitialization: z.boolean().optional(),
  noImplicitThis: z.boolean().optional(),
  alwaysStrict: z.boolean().optional(),
  // Additional strictness
  noUncheckedIndexedAccess: z.boolean().optional(),
  noImplicitReturns: z.boolean().optional(),
  noFallthroughCasesInSwitch: z.boolean().optional(),
  noUnusedLocals: z.boolean().optional(),
  noUnusedParameters: z.boolean().optional(),
  exactOptionalPropertyTypes: z.boolean().optional(),
  noImplicitOverride: z.boolean().optional(),
  // Permissive options
  allowUnusedLabels: z.boolean().optional(),
  allowUnreachableCode: z.boolean().optional(),
});

// Remote reference pattern: github:owner/repo[/path]@version
const remoteRefPattern = /^github:[^/]+\/[^/@]+(?:\/[^@]*)?@.+$/;

// AI context configuration schema
const aiContextSchema = z.object({
  templates: z.array(z.string().min(1)).min(1, 'at least one template is required'),
  source: z
    .string()
    .regex(remoteRefPattern, 'must be format: github:owner/repo/path@version')
    .optional(),
});

// Extends configuration schema (v2)
const extendsSchema = z.object({
  eslint: z
    .string()
    .regex(remoteRefPattern, 'must be format: github:owner/repo/path@version')
    .optional(),
  ruff: z
    .string()
    .regex(remoteRefPattern, 'must be format: github:owner/repo/path@version')
    .optional(),
});

// Strip Symbol keys from an object (recursively)
// @iarna/toml adds Symbol keys for metadata that interfere with Zod validation
export function stripSymbolKeys(obj: unknown): unknown {
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
export const configSchema = z.object({
  project: z.object({
    name: z.string().min(1, 'project name cannot be empty'),
  }),
  extends: extendsSchema.optional(),
  prompts: aiContextSchema.optional(),
  rulesets: z
    .object({
      eslint: z
        .object({
          rules: z.record(z.string(), eslintRuleValueSchema).optional(),
        })
        .optional(),
      ruff: ruffConfigSchema.optional(),
      tsc: tscConfigSchema.optional(),
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

export interface ValidationResult {
  valid: boolean;
  config?: Config;
  errors?: string[];
}

interface AjvErrorObject {
  instancePath: string;
  keyword: string;
  message?: string;
  params: Record<string, unknown>;
}

function formatAjvError(error: AjvErrorObject): string {
  switch (error.keyword) {
    case 'required':
      return `missing required property '${error.params.missingProperty}'`;
    case 'type':
      return `must be ${error.params.type}`;
    case 'minLength':
      return `must have at least ${error.params.limit} character(s)`;
    case 'minItems':
      return `must have at least ${error.params.limit} item(s)`;
    case 'pattern':
      return `must match pattern: ${error.params.pattern}`;
    case 'enum':
      return `must be one of: ${(error.params.allowedValues as string[]).join(', ')}`;
    case 'additionalProperties':
      return `has unknown property '${error.params.additionalProperty}'`;
    default:
      return error.message ?? 'validation failed';
  }
}

/**
 * Validate TOML content against the cmc.toml JSON schema.
 * Uses the same JSON Schema validation as the CLI validate command.
 * Returns validation result with parsed config or errors.
 */
export async function validateConfigContent(tomlContent: string): Promise<ValidationResult> {
  const TOML = await import('@iarna/toml');

  let parsed: unknown;
  try {
    parsed = TOML.parse(tomlContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parse error';
    return {
      valid: false,
      errors: [`Invalid TOML syntax: ${message}`],
    };
  }

  // Strip Symbol keys added by @iarna/toml
  parsed = stripSymbolKeys(parsed);

  // Load JSON schema from package
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const schemaPath = join(__dirname, '../../schemas/cmc.schema.json');
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  const schema = JSON.parse(schemaContent);

  // Validate against JSON schema using Ajv 2020-12 (for JSON Schema draft 2020-12)
  const ajvModule = await import('ajv/dist/2020.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ajv2020 = ajvModule.default as any;
  const ajv = new Ajv2020({ allErrors: true, verbose: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(parsed);

  if (valid) {
    return {
      valid: true,
      config: parsed as Config,
    };
  }

  // Convert Ajv errors to our format
  const errors = (
    ((validate as { errors?: AjvErrorObject[] }).errors ?? []) as AjvErrorObject[]
  ).map((err) => {
    const path = err.instancePath || '/';
    return `${path}: ${formatAjvError(err)}`;
  });

  return {
    valid: false,
    errors,
  };
}
