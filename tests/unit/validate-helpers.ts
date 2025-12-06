/**
 * Test helpers for validate command
 * Exports a function that can validate a config file without invoking the full CLI
 */

import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { stripSymbolKeys } from "../../src/config/loader.js";

interface AjvErrorObject {
  instancePath: string;
  keyword: string;
  message?: string;
  params: Record<string, unknown>;
}

interface ValidationError {
  path: string;
  message: string;
  keyword: string;
}

interface ValidateResult {
  valid: boolean;
  errors: ValidationError[];
  configPath: string;
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

export async function validateConfig(
  configPath: string,
): Promise<ValidateResult> {
  // Check if file exists
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  // Load schema from package
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const schemaPath = join(__dirname, "../../schemas/cmc.schema.json");
  const schemaContent = await readFile(schemaPath, "utf-8");
  const schema = JSON.parse(schemaContent);

  // Load and parse TOML config
  const configContent = await readFile(configPath, "utf-8");
  const TOML = await import("@iarna/toml");

  let parsed: unknown;
  try {
    parsed = TOML.parse(configContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parse error";
    return {
      valid: false,
      errors: [
        {
          path: "",
          message: `Invalid TOML syntax: ${message}`,
          keyword: "syntax",
        },
      ],
      configPath,
    };
  }

  // Strip Symbol keys added by @iarna/toml
  parsed = stripSymbolKeys(parsed);

  // Validate against JSON schema using Ajv 2020-12 (for JSON Schema draft 2020-12)
  const ajvModule = await import("ajv/dist/2020.js");
  const Ajv2020 = ajvModule.default;
  const ajv = new Ajv2020({ allErrors: true, verbose: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(parsed);

  if (valid) {
    return { valid: true, errors: [], configPath };
  }

  // Convert Ajv errors to our format
  const errors = (
    ((validate as { errors?: AjvErrorObject[] }).errors ??
      []) as AjvErrorObject[]
  ).map((err) => ({
    path: err.instancePath || "/",
    message: formatAjvError(err),
    keyword: err.keyword,
  }));

  return { valid: false, errors, configPath };
}
