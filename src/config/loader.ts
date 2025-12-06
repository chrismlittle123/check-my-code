import { existsSync, readFileSync, statSync } from "fs";
import { readFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

import type { Config } from "../types.js";

// Custom error class for configuration errors (exit code 2)
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

// JSON Schema for cmc.toml validation
// ESLint rule values: "off", "warn", "error", or array like ["error", "always"]
const eslintRuleValueSchema = z.union([
  z.enum(["off", "warn", "error"]),
  z.tuple([z.string()]).rest(z.unknown()),
]);

// Ruff configuration schema
const ruffConfigSchema = z
  .object({
    "line-length": z.number().int().positive().optional(),
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
  templates: z
    .array(z.string().min(1))
    .min(1, "at least one template is required"),
  source: z
    .string()
    .regex(remoteRefPattern, "must be format: github:owner/repo/path@version")
    .optional(),
});

// Extends configuration schema (v2)
const extendsSchema = z.object({
  eslint: z
    .string()
    .regex(remoteRefPattern, "must be format: github:owner/repo/path@version")
    .optional(),
  ruff: z
    .string()
    .regex(remoteRefPattern, "must be format: github:owner/repo/path@version")
    .optional(),
  tsc: z
    .string()
    .regex(remoteRefPattern, "must be format: github:owner/repo/path@version")
    .optional(),
});

// Strip Symbol keys from an object (recursively)
// @iarna/toml adds Symbol keys for metadata that interfere with Zod validation
export function stripSymbolKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
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
    name: z.string().min(1, "project name cannot be empty"),
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

async function parseTomlFile(configPath: string): Promise<unknown> {
  const content = await readFile(configPath, "utf-8");
  const TOML = await import("@iarna/toml");

  try {
    return stripSymbolKeys(TOML.parse(content));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parse error";
    throw new ConfigError(`Invalid TOML: ${message}`);
  }
}

function formatZodErrors(issues: z.ZodIssue[]): string {
  return issues
    .map((issue) => {
      const pathStr = issue.path.map((p) => String(p)).join(".");
      return `  - ${pathStr}: ${issue.message}`;
    })
    .join("\n");
}

export async function loadConfig(projectRoot: string): Promise<Config> {
  const configPath = join(projectRoot, "cmc.toml");

  if (!existsSync(configPath)) {
    throw new ConfigError(
      `No cmc.toml found.\n\nCreate a cmc.toml file with:\n  [project]\n  name = "your-project"`,
    );
  }

  const parsed = await parseTomlFile(configPath);
  const result = configSchema.safeParse(parsed);

  if (!result.success) {
    throw new ConfigError(
      `Invalid cmc.toml:\n${formatZodErrors(result.error.issues)}`,
    );
  }

  return result.data as Config;
}

/**
 * Resolve a path to an absolute directory path.
 * If the path is a file, returns its parent directory.
 */
function resolveToDirectory(inputPath: string): string {
  const absolutePath = resolve(inputPath);
  if (existsSync(absolutePath)) {
    const stats = statSync(absolutePath);
    return stats.isDirectory() ? absolutePath : dirname(absolutePath);
  }
  return absolutePath;
}

/**
 * Find the project root by searching for cmc.toml.
 * @param startPath - Optional starting path to search from. Defaults to process.cwd().
 *                    If provided, searches from this path upward. Supports both file and directory paths.
 * @returns Absolute path to the project root directory
 */
export function findProjectRoot(startPath?: string): string {
  // Determine starting directory - always resolve to absolute path
  let dir = startPath ? resolveToDirectory(startPath) : process.cwd();

  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "cmc.toml"))) {
      return dir;
    }
    dir = dirname(dir);
  }

  // Check root
  if (existsSync(join(dir, "cmc.toml"))) {
    return dir;
  }

  // Fallback: return absolute directory path
  return startPath ? resolveToDirectory(startPath) : process.cwd();
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
    case "required":
      return `missing required property '${error.params.missingProperty}'`;
    case "type":
      return `must be ${error.params.type}`;
    case "minLength":
      return `must have at least ${error.params.limit} character(s)`;
    case "minItems":
      return `must have at least ${error.params.limit} item(s)`;
    case "pattern":
      return `must match pattern: ${error.params.pattern}`;
    case "enum":
      return `must be one of: ${(error.params.allowedValues as string[]).join(", ")}`;
    case "additionalProperties":
      return `has unknown property '${error.params.additionalProperty}'`;
    default:
      return error.message ?? "validation failed";
  }
}

async function parseTomlContent(
  content: string,
): Promise<{ parsed: unknown } | { errors: string[] }> {
  const TOML = await import("@iarna/toml");
  try {
    return { parsed: stripSymbolKeys(TOML.parse(content)) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parse error";
    return { errors: [`Invalid TOML syntax: ${message}`] };
  }
}

function loadJsonSchema(): object {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const schemaPath = join(__dirname, "../../schemas/cmc.schema.json");
  const schemaContent = readFileSync(schemaPath, "utf-8");
  return JSON.parse(schemaContent);
}

async function validateWithAjv(
  parsed: unknown,
  schema: object,
): Promise<string[]> {
  const ajvModule = await import("ajv/dist/2020.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ajv2020 = ajvModule.default as any;
  const ajv = new Ajv2020({ allErrors: true, verbose: true, strict: false });
  const validate = ajv.compile(schema);

  if (validate(parsed)) return [];

  const ajvErrors = (validate as { errors?: AjvErrorObject[] }).errors ?? [];
  return ajvErrors.map(
    (err) => `${err.instancePath || "/"}: ${formatAjvError(err)}`,
  );
}

/**
 * Validate TOML content against the cmc.toml JSON schema.
 * Uses the same JSON Schema validation as the CLI validate command.
 * Returns validation result with parsed config or errors.
 */
export async function validateConfigContent(
  tomlContent: string,
): Promise<ValidationResult> {
  const parseResult = await parseTomlContent(tomlContent);

  if ("errors" in parseResult) {
    return { valid: false, errors: parseResult.errors };
  }

  const schema = loadJsonSchema();
  const errors = await validateWithAjv(parseResult.parsed, schema);

  if (errors.length === 0) {
    return { valid: true, config: parseResult.parsed as Config };
  }

  return { valid: false, errors };
}
