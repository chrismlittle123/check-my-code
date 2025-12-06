/**
 * Registry validate subcommand.
 * Validates registry JSON files against schemas and project structure.
 */

import { Command } from "commander";
import { existsSync } from "fs";
import { glob } from "glob";
import { join } from "path";

import { ExitCode } from "../../../types.js";
import { getBuiltInSchema } from "./schemas.js";
import {
  type PromptsRegistry,
  type RegistryEntries,
  type RegistryType,
  type RulesetsRegistry,
  type ValidationResult,
  type VersionEntry,
} from "./types.js";
import {
  collectRegisteredFiles,
  error,
  getRegistryEntries,
  getRegistryPath,
  loadRegistry,
  success,
  warning,
} from "./utils.js";

function checkRegistryExists(
  registryPath: string,
  result: ValidationResult,
): boolean {
  if (!existsSync(registryPath)) {
    result.errors.push(`Registry file not found: ${registryPath}`);
    result.valid = false;
    return false;
  }
  return true;
}

function loadAndValidateRegistry(
  registryPath: string,
  type: RegistryType,
  result: ValidationResult,
): { registry: PromptsRegistry | RulesetsRegistry; schema: object } | null {
  const registry = loadRegistry<PromptsRegistry | RulesetsRegistry>(
    registryPath,
  );
  const schema = getBuiltInSchema(type);

  if (!registry) {
    result.errors.push(`Failed to parse registry: ${registryPath}`);
    result.valid = false;
    return null;
  }
  return { registry, schema };
}

async function validateAgainstSchema(
  registry: PromptsRegistry | RulesetsRegistry,
  schema: object,
  result: ValidationResult,
): Promise<void> {
  const ajvModule = await import("ajv");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ajv = ajvModule.default as any;
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const schemaValid = validate(registry);

  if (!schemaValid && validate.errors) {
    for (const err of validate.errors) {
      result.errors.push(`${err.instancePath ?? "root"}: ${err.message}`);
    }
    result.valid = false;
  }
}

function validateTierConsistency(
  key: string,
  entry: { tier: string },
  result: ValidationResult,
): void {
  const tierFromKey = key.split("/")[0];
  if (tierFromKey !== entry.tier) {
    result.errors.push(
      `${key}: key tier '${tierFromKey}' doesn't match entry tier '${entry.tier}'`,
    );
    result.valid = false;
  }
}

interface VersionFileContext {
  key: string;
  projectRoot: string;
  type: RegistryType;
  result: ValidationResult;
}

function validateLatestVersion(
  entry: { versions: Record<string, string | VersionEntry> },
  latestVersion: string,
  ctx: VersionFileContext,
): void {
  if (!entry.versions[latestVersion]) {
    ctx.result.errors.push(
      `${ctx.key}: 'latest' points to non-existent version '${latestVersion}'`,
    );
    ctx.result.valid = false;
  }
}

function validateVersionFile(
  version: string,
  fileEntry: VersionEntry,
  ctx: VersionFileContext,
): void {
  if (fileEntry.file) {
    const filePath = join(ctx.projectRoot, ctx.type, fileEntry.file);
    if (!existsSync(filePath)) {
      ctx.result.errors.push(
        `${ctx.key}@${version}: file not found: ${ctx.type}/${fileEntry.file}`,
      );
      ctx.result.valid = false;
    }
  }
}

function validateVersionFiles(
  entry: { versions: Record<string, string | VersionEntry> },
  ctx: VersionFileContext,
): void {
  for (const [version, versionData] of Object.entries(entry.versions)) {
    if (version === "latest") {
      validateLatestVersion(entry, versionData as string, ctx);
    } else {
      validateVersionFile(version, versionData as VersionEntry, ctx);
    }
  }
}

function validateEntryConsistency(
  entries: RegistryEntries,
  projectRoot: string,
  type: RegistryType,
  result: ValidationResult,
): void {
  for (const [key, entry] of Object.entries(entries)) {
    validateTierConsistency(key, entry, result);
    validateVersionFiles(entry, { key, projectRoot, type, result });
  }
}

async function checkOrphanedFiles(
  projectRoot: string,
  type: RegistryType,
  entries: RegistryEntries,
  result: ValidationResult,
): Promise<void> {
  const filePattern = type === "prompts" ? "**/[0-9]*.md" : "**/[0-9]*.toml";
  const actualFiles = await glob(filePattern, {
    cwd: join(projectRoot, type),
    ignore: ["**/node_modules/**"],
  });

  const registeredFiles = collectRegisteredFiles(entries);

  for (const file of actualFiles) {
    if (!registeredFiles.has(file)) {
      result.warnings.push(`Orphaned file not in registry: ${type}/${file}`);
    }
  }
}

async function validateRegistry(
  projectRoot: string,
  type: RegistryType,
): Promise<ValidationResult> {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  const registryPath = getRegistryPath(projectRoot, type);

  if (!checkRegistryExists(registryPath, result)) {
    return result;
  }

  const loaded = loadAndValidateRegistry(registryPath, type, result);
  if (!loaded) {
    return result;
  }

  await validateAgainstSchema(loaded.registry, loaded.schema, result);

  const entries = getRegistryEntries(loaded.registry, type);
  validateEntryConsistency(entries, projectRoot, type, result);
  await checkOrphanedFiles(projectRoot, type, entries, result);

  return result;
}

function outputPromptsResult(result: ValidationResult): void {
  console.log("\n--- Prompts Registry ---\n");
  if (result.valid) {
    success("prompts.json passes validation");
  } else {
    error("prompts.json validation failed:");
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }
  for (const warn of result.warnings) {
    warning(warn);
  }
}

function outputRulesetsResult(result: ValidationResult): void {
  console.log("\n--- Rulesets Registry ---\n");
  if (result.valid) {
    success("rulesets.json passes validation");
  } else {
    error("rulesets.json validation failed:");
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }
  for (const warn of result.warnings) {
    warning(warn);
  }
}

async function runValidate(
  projectRoot: string,
  options: { json?: boolean },
): Promise<void> {
  const promptsResult = await validateRegistry(projectRoot, "prompts");
  const rulesetsResult = await validateRegistry(projectRoot, "rulesets");

  const allValid = promptsResult.valid && rulesetsResult.valid;

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          valid: allValid,
          prompts: promptsResult,
          rulesets: rulesetsResult,
        },
        null,
        2,
      ),
    );
  } else {
    outputPromptsResult(promptsResult);
    outputRulesetsResult(rulesetsResult);
    console.log("");
  }

  process.exit(allValid ? ExitCode.SUCCESS : ExitCode.VIOLATIONS);
}

export const validateSubcommand = new Command("validate")
  .description(
    "Validate registry JSON files against schemas and project structure",
  )
  .option("--json", "Output results as JSON", false)
  .action(async (options) => {
    const projectRoot = process.cwd();
    await runValidate(projectRoot, options);
  });
