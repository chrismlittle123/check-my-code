/**
 * Registry command for managing prompts and rulesets registries.
 * Provides subcommands: validate, list, check, sync, bump
 */

import { Command } from "commander";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
} from "fs";
import { join, dirname } from "path";
import { glob } from "glob";
import { ExitCode } from "../../types.js";

// Types for registry entries
interface VersionEntry {
  file: string;
}

interface PromptEntry {
  tier: "prototype" | "internal" | "production";
  description: string;
  format: string;
  language_version: string;
  runtime_version?: string;
  versions: Record<string, string | VersionEntry>;
}

interface RulesetEntry {
  tier: "prototype" | "internal" | "production";
  description: string;
  tool: string;
  format: string;
  target_version?: string;
  language_version?: string;
  runtime_version?: string;
  versions: Record<string, string | VersionEntry>;
}

interface PromptsRegistry {
  schema_version: string;
  prompts: Record<string, PromptEntry>;
}

interface RulesetsRegistry {
  schema_version: string;
  rulesets: Record<string, RulesetEntry>;
}

type RegistryType = "prompts" | "rulesets";

// Built-in schemas for registry validation
const PROMPTS_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://palindrom.dev/schemas/prompts.schema.json",
  title: "Prompts Registry",
  description:
    "Schema for the prompts registry that tracks coding standards prompts",
  type: "object",
  required: ["schema_version", "prompts"],
  additionalProperties: false,
  properties: {
    schema_version: {
      type: "string",
      pattern: "^\\d+\\.\\d+\\.\\d+$",
      description: "Semantic version of this schema",
    },
    prompts: {
      type: "object",
      description: "Map of prompt identifiers to their configurations",
      additionalProperties: false,
      patternProperties: {
        "^(prototype|internal|production)/[a-z]+/[0-9.]+$": {
          $ref: "#/$defs/promptEntry",
        },
      },
    },
  },
  $defs: {
    promptEntry: {
      type: "object",
      required: [
        "tier",
        "description",
        "format",
        "language_version",
        "versions",
      ],
      additionalProperties: false,
      properties: {
        tier: {
          type: "string",
          enum: ["prototype", "internal", "production"],
          description: "The quality tier for this prompt",
        },
        description: {
          type: "string",
          minLength: 1,
          description: "Human-readable description of this prompt",
        },
        format: {
          type: "string",
          enum: ["md", "txt"],
          description: "File format of the prompt files",
        },
        language_version: {
          type: "string",
          pattern: "^[0-9.]+$",
          description: "Version of the programming language",
        },
        runtime_version: {
          type: "string",
          pattern: "^[a-z]+[0-9]+$",
          description: "Runtime version (e.g., node20)",
        },
        versions: {
          $ref: "#/$defs/versionMap",
        },
      },
    },
    versionMap: {
      type: "object",
      required: ["latest"],
      properties: {
        latest: {
          type: "string",
          pattern: "^\\d+\\.\\d+\\.\\d+$",
          description: "The latest version identifier",
        },
      },
      additionalProperties: {
        oneOf: [
          {
            type: "object",
            required: ["file"],
            additionalProperties: false,
            properties: {
              file: {
                type: "string",
                pattern: "^[a-z]+/[a-z]+/[0-9.]+/[0-9.]+\\.md$",
                description: "Relative path to the prompt file",
              },
            },
          },
          {
            type: "string",
            pattern: "^\\d+\\.\\d+\\.\\d+$",
          },
        ],
      },
    },
  },
};

const RULESETS_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://palindrom.dev/schemas/rulesets.schema.json",
  title: "Rulesets Registry",
  description:
    "Schema for the rulesets registry that tracks linter/formatter configurations",
  type: "object",
  required: ["schema_version", "rulesets"],
  additionalProperties: false,
  properties: {
    schema_version: {
      type: "string",
      pattern: "^\\d+\\.\\d+\\.\\d+$",
      description: "Semantic version of this schema",
    },
    rulesets: {
      type: "object",
      description: "Map of ruleset identifiers to their configurations",
      additionalProperties: false,
      patternProperties: {
        "^(prototype|internal|production)/[a-z]+/[0-9.]+(/[a-z]+)?$": {
          $ref: "#/$defs/rulesetEntry",
        },
      },
    },
  },
  $defs: {
    rulesetEntry: {
      type: "object",
      required: ["tier", "description", "tool", "format", "versions"],
      additionalProperties: false,
      properties: {
        tier: {
          type: "string",
          enum: ["prototype", "internal", "production"],
          description: "The quality tier for this ruleset",
        },
        description: {
          type: "string",
          minLength: 1,
          description: "Human-readable description of this ruleset",
        },
        tool: {
          type: "string",
          enum: ["ruff", "eslint", "biome", "prettier"],
          description: "The linting/formatting tool this ruleset is for",
        },
        format: {
          type: "string",
          enum: ["toml", "json", "yaml", "js"],
          description: "File format of the ruleset files",
        },
        target_version: {
          type: "string",
          pattern: "^py[0-9]+$",
          description: "Python target version (e.g., py312)",
        },
        language_version: {
          type: "string",
          pattern: "^[0-9.]+$",
          description: "Language version (e.g., 5.5 for TypeScript)",
        },
        runtime_version: {
          type: "string",
          pattern: "^[a-z]+[0-9]+$",
          description: "Runtime version (e.g., node20)",
        },
        versions: {
          $ref: "#/$defs/versionMap",
        },
      },
    },
    versionMap: {
      type: "object",
      required: ["latest"],
      properties: {
        latest: {
          type: "string",
          pattern: "^\\d+\\.\\d+\\.\\d+$",
          description: "The latest version identifier",
        },
      },
      additionalProperties: {
        oneOf: [
          {
            type: "object",
            required: ["file"],
            additionalProperties: false,
            properties: {
              file: {
                type: "string",
                pattern: "^[a-z]+/[a-z]+/[0-9.]+/[a-z]+/[0-9.]+\\.toml$",
                description: "Relative path to the ruleset file",
              },
            },
          },
          {
            type: "string",
            pattern: "^\\d+\\.\\d+\\.\\d+$",
          },
        ],
      },
    },
  },
};

// Get built-in schema for registry type
function getBuiltInSchema(type: RegistryType): object {
  return type === "prompts" ? PROMPTS_SCHEMA : RULESETS_SCHEMA;
}

// Registry paths
function getRegistryPath(projectRoot: string, type: RegistryType): string {
  return join(projectRoot, type, `${type}.json`);
}

// Load registry JSON
function loadRegistry<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

// Parse semantic version
function parseVersion(
  version: string,
): { major: number; minor: number; patch: number } | null {
  const versionRegex = /^(\d+)\.(\d+)\.(\d+)$/;
  const match = versionRegex.exec(version);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

// Increment version
function incrementVersion(
  version: string,
  type: "major" | "minor" | "patch",
): string {
  const parsed = parseVersion(version);
  if (!parsed) return "1.0.0";

  switch (type) {
    case "major":
      return `${parsed.major + 1}.0.0`;
    case "minor":
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case "patch":
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }
}

// Output helpers
function success(message: string): void {
  console.log(`✓ ${message}`);
}

function error(message: string): void {
  console.error(`✗ ${message}`);
}

function info(message: string): void {
  console.log(`ℹ ${message}`);
}

function warning(message: string): void {
  console.log(`⚠ ${message}`);
}

// ============================================================================
// VALIDATE SUBCOMMAND
// ============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

type RegistryEntries = Record<string, PromptEntry | RulesetEntry>;

function validateEntryConsistency(
  entries: RegistryEntries,
  projectRoot: string,
  type: RegistryType,
  result: ValidationResult,
): void {
  for (const [key, entry] of Object.entries(entries)) {
    const tierFromKey = key.split("/")[0];
    if (tierFromKey !== entry.tier) {
      result.errors.push(
        `${key}: key tier '${tierFromKey}' doesn't match entry tier '${entry.tier}'`,
      );
      result.valid = false;
    }

    for (const [version, versionData] of Object.entries(entry.versions)) {
      if (version === "latest") {
        const latestVersion = versionData as string;
        if (!entry.versions[latestVersion]) {
          result.errors.push(
            `${key}: 'latest' points to non-existent version '${latestVersion}'`,
          );
          result.valid = false;
        }
        continue;
      }

      const fileEntry = versionData as VersionEntry;
      if (fileEntry.file) {
        const filePath = join(projectRoot, type, fileEntry.file);
        if (!existsSync(filePath)) {
          result.errors.push(
            `${key}@${version}: file not found: ${type}/${fileEntry.file}`,
          );
          result.valid = false;
        }
      }
    }
  }
}

function collectRegisteredFiles(entries: RegistryEntries): Set<string> {
  const registeredFiles = new Set<string>();
  for (const entry of Object.values(entries)) {
    for (const [version, versionData] of Object.entries(entry.versions)) {
      if (
        version !== "latest" &&
        versionData !== null &&
        typeof versionData === "object" &&
        "file" in versionData
      ) {
        registeredFiles.add((versionData as VersionEntry).file);
      }
    }
  }
  return registeredFiles;
}

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

  const entries =
    type === "prompts"
      ? (loaded.registry as PromptsRegistry).prompts
      : (loaded.registry as RulesetsRegistry).rulesets;

  validateEntryConsistency(entries, projectRoot, type, result);
  await checkOrphanedFiles(projectRoot, type, entries, result);

  return result;
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
    console.log("\n--- Prompts Registry ---\n");
    if (promptsResult.valid) {
      success("prompts.json passes validation");
    } else {
      error("prompts.json validation failed:");
      for (const err of promptsResult.errors) {
        console.log(`  - ${err}`);
      }
    }
    for (const warn of promptsResult.warnings) {
      warning(warn);
    }

    console.log("\n--- Rulesets Registry ---\n");
    if (rulesetsResult.valid) {
      success("rulesets.json passes validation");
    } else {
      error("rulesets.json validation failed:");
      for (const err of rulesetsResult.errors) {
        console.log(`  - ${err}`);
      }
    }
    for (const warn of rulesetsResult.warnings) {
      warning(warn);
    }

    console.log("");
  }

  process.exit(allValid ? ExitCode.SUCCESS : ExitCode.VIOLATIONS);
}

// ============================================================================
// LIST SUBCOMMAND
// ============================================================================

interface ListOptions {
  tier?: string;
  language?: string;
  tool?: string;
  json?: boolean;
}

function runList(projectRoot: string, options: ListOptions): void {
  const promptsPath = getRegistryPath(projectRoot, "prompts");
  const rulesetsPath = getRegistryPath(projectRoot, "rulesets");

  const prompts = loadRegistry<PromptsRegistry>(promptsPath);
  const rulesets = loadRegistry<RulesetsRegistry>(rulesetsPath);

  const results: {
    key: string;
    type: "prompt" | "ruleset";
    tier: string;
    description: string;
    latest: string;
    tool?: string;
  }[] = [];

  // Filter and collect prompts
  if (prompts) {
    for (const [key, entry] of Object.entries(prompts.prompts)) {
      if (options.tier && entry.tier !== options.tier) continue;
      if (options.language) {
        const lang = key.split("/")[1];
        if (lang !== options.language) continue;
      }

      results.push({
        key,
        type: "prompt",
        tier: entry.tier,
        description: entry.description,
        latest: entry.versions.latest as string,
      });
    }
  }

  // Filter and collect rulesets
  if (rulesets) {
    for (const [key, entry] of Object.entries(rulesets.rulesets)) {
      if (options.tier && entry.tier !== options.tier) continue;
      if (options.language) {
        const lang = key.split("/")[1];
        if (lang !== options.language) continue;
      }
      if (options.tool && entry.tool !== options.tool) continue;

      results.push({
        key,
        type: "ruleset",
        tier: entry.tier,
        description: entry.description,
        latest: entry.versions.latest as string,
        tool: entry.tool,
      });
    }
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    if (results.length === 0) {
      console.log("No entries found matching the criteria.");
      return;
    }

    console.log("\nAvailable standards:\n");
    for (const item of results) {
      const toolStr = item.tool ? ` [${item.tool}]` : "";
      console.log(`  ${item.key}@${item.latest} (${item.tier})${toolStr}`);
      console.log(`    ${item.description}\n`);
    }
  }
}

// ============================================================================
// CHECK SUBCOMMAND
// ============================================================================

function runCheck(
  projectRoot: string,
  key: string,
  options: { json?: boolean },
): void {
  const promptsPath = getRegistryPath(projectRoot, "prompts");
  const rulesetsPath = getRegistryPath(projectRoot, "rulesets");

  const prompts = loadRegistry<PromptsRegistry>(promptsPath);
  const rulesets = loadRegistry<RulesetsRegistry>(rulesetsPath);

  let found: {
    type: "prompt" | "ruleset";
    entry: PromptEntry | RulesetEntry;
  } | null = null;

  if (prompts?.prompts[key]) {
    found = { type: "prompt", entry: prompts.prompts[key] };
  } else if (rulesets?.rulesets[key]) {
    found = { type: "ruleset", entry: rulesets.rulesets[key] };
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          exists: found !== null,
          key,
          ...(found && { type: found.type, entry: found.entry }),
        },
        null,
        2,
      ),
    );
  } else {
    if (found) {
      success(`Found ${found.type}: ${key}`);
      console.log(`  Tier: ${found.entry.tier}`);
      console.log(`  Description: ${found.entry.description}`);
      console.log(`  Latest: ${found.entry.versions.latest}`);
      console.log(
        `  Versions: ${Object.keys(found.entry.versions)
          .filter((v) => v !== "latest")
          .join(", ")}`,
      );
    } else {
      error(`Not found: ${key}`);
      process.exit(ExitCode.VIOLATIONS);
    }
  }
}

// ============================================================================
// SYNC SUBCOMMAND
// ============================================================================

interface SyncOptions {
  dryRun?: boolean;
  json?: boolean;
}

interface SyncChange {
  type: string;
  action: string;
  key: string;
  file?: string;
}

function findOrphanedFiles(
  actualFiles: string[],
  registeredFiles: Set<string>,
  registryType: RegistryType,
): SyncChange[] {
  const changes: SyncChange[] = [];
  for (const file of actualFiles) {
    if (!registeredFiles.has(file)) {
      changes.push({
        type: registryType,
        action: "add",
        key: inferKeyFromPath(file, registryType),
        file,
      });
    }
  }
  return changes;
}

function findStaleEntries(
  entries: RegistryEntries,
  projectRoot: string,
  registryType: RegistryType,
): SyncChange[] {
  const changes: SyncChange[] = [];
  for (const [key, entry] of Object.entries(entries)) {
    for (const [version, versionData] of Object.entries(entry.versions)) {
      if (
        version !== "latest" &&
        versionData !== null &&
        typeof versionData === "object" &&
        "file" in versionData
      ) {
        const fileEntry = versionData as VersionEntry;
        const filePath = join(projectRoot, registryType, fileEntry.file);
        if (!existsSync(filePath)) {
          changes.push({
            type: registryType,
            action: "remove",
            key: `${key}@${version}`,
            file: fileEntry.file,
          });
        }
      }
    }
  }
  return changes;
}

function getActionIcon(action: string): string {
  if (action === "add") return "+";
  if (action === "remove") return "-";
  return "!";
}

async function runSync(
  projectRoot: string,
  options: SyncOptions,
): Promise<void> {
  const changes: SyncChange[] = [];

  for (const registryType of ["prompts", "rulesets"] as RegistryType[]) {
    const registryPath = getRegistryPath(projectRoot, registryType);
    const registry = loadRegistry<PromptsRegistry | RulesetsRegistry>(
      registryPath,
    );

    if (!registry) {
      changes.push({
        type: registryType,
        action: "error",
        key: "registry",
        file: "Could not load registry",
      });
      continue;
    }

    const entries =
      registryType === "prompts"
        ? (registry as PromptsRegistry).prompts
        : (registry as RulesetsRegistry).rulesets;

    const filePattern =
      registryType === "prompts" ? "**/[0-9]*.md" : "**/[0-9]*.toml";
    // eslint-disable-next-line no-await-in-loop
    const actualFiles = await glob(filePattern, {
      cwd: join(projectRoot, registryType),
      ignore: ["**/node_modules/**"],
    });

    const registeredFiles = collectRegisteredFiles(entries);
    changes.push(
      ...findOrphanedFiles(actualFiles, registeredFiles, registryType),
    );
    changes.push(...findStaleEntries(entries, projectRoot, registryType));
  }

  if (options.json) {
    console.log(JSON.stringify({ dryRun: options.dryRun, changes }, null, 2));
    return;
  }

  if (changes.length === 0) {
    success("Registries are in sync with filesystem");
    return;
  }

  const header = options.dryRun
    ? "\nDry run - changes that would be made:\n"
    : "\nSyncing registries:\n";
  console.log(header);

  for (const change of changes) {
    console.log(
      `  ${getActionIcon(change.action)} [${change.type}] ${change.action}: ${change.key}`,
    );
    if (change.file) {
      console.log(`    File: ${change.file}`);
    }
  }

  if (!options.dryRun) {
    warning(
      "\nAuto-sync not yet implemented. Please update registries manually.",
    );
  }
}

function inferKeyFromPath(filePath: string, type: RegistryType): string {
  // e.g., "internal/python/3.12/1.0.0.md" -> "internal/python/3.12"
  // e.g., "internal/typescript/5.5/eslint/1.0.0.toml" -> "internal/typescript/5.5"
  const parts = filePath.split("/");
  if (type === "prompts" && parts.length >= 4) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  if (type === "rulesets" && parts.length >= 5) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  return filePath;
}

// ============================================================================
// BUMP SUBCOMMAND
// ============================================================================

interface BumpOptions {
  type: "major" | "minor" | "patch";
  dryRun?: boolean;
  json?: boolean;
}

interface FoundEntry {
  registryType: RegistryType;
  registryPath: string;
  registry: PromptsRegistry | RulesetsRegistry;
  entry: PromptEntry | RulesetEntry;
}

function findEntry(projectRoot: string, key: string): FoundEntry | null {
  const promptsPath = getRegistryPath(projectRoot, "prompts");
  const rulesetsPath = getRegistryPath(projectRoot, "rulesets");

  const prompts = loadRegistry<PromptsRegistry>(promptsPath);
  const rulesets = loadRegistry<RulesetsRegistry>(rulesetsPath);

  if (prompts?.prompts[key]) {
    return {
      registryType: "prompts",
      registryPath: promptsPath,
      registry: prompts,
      entry: prompts.prompts[key],
    };
  }
  if (rulesets?.rulesets[key]) {
    return {
      registryType: "rulesets",
      registryPath: rulesetsPath,
      registry: rulesets,
      entry: rulesets.rulesets[key],
    };
  }
  return null;
}

function outputBumpResult(
  result: {
    key: string;
    currentVersion: string;
    newVersion: string;
    currentFile: string;
    newFile: string;
  },
  options: BumpOptions,
): void {
  if (options.json) {
    console.log(JSON.stringify({ dryRun: options.dryRun, ...result }, null, 2));
  } else {
    console.log(`\nBumping ${result.key}:`);
    console.log(`  Current version: ${result.currentVersion}`);
    console.log(`  New version: ${result.newVersion}`);
    console.log(`  Current file: ${result.currentFile}`);
    console.log(`  New file: ${result.newFile}`);
  }
}

function performBump(
  projectRoot: string,
  found: FoundEntry,
  currentVersionEntry: VersionEntry,
  newVersion: string,
  newFileName: string,
): void {
  const currentFilePath = join(
    projectRoot,
    found.registryType,
    currentVersionEntry.file,
  );
  const newFilePath = join(projectRoot, found.registryType, newFileName);

  const newFileDir = dirname(newFilePath);
  if (!existsSync(newFileDir)) {
    mkdirSync(newFileDir, { recursive: true });
  }
  copyFileSync(currentFilePath, newFilePath);

  found.entry.versions[newVersion] = { file: newFileName };
  found.entry.versions.latest = newVersion;

  writeFileSync(
    found.registryPath,
    `${JSON.stringify(found.registry, null, 2)}\n`,
  );
}

function runBump(projectRoot: string, key: string, options: BumpOptions): void {
  const found = findEntry(projectRoot, key);

  if (!found) {
    error(`Entry not found: ${key}`);
    process.exit(ExitCode.VIOLATIONS);
    return;
  }

  const currentVersion = found.entry.versions.latest as string;
  const newVersion = incrementVersion(currentVersion, options.type);

  const currentVersionEntry = found.entry.versions[
    currentVersion
  ] as VersionEntry;
  if (!currentVersionEntry?.file) {
    error(`No file found for current version: ${key}@${currentVersion}`);
    process.exit(ExitCode.RUNTIME_ERROR);
    return;
  }

  const fileExt = found.registryType === "prompts" ? "md" : "toml";
  const newFileName = currentVersionEntry.file.replace(
    `${currentVersion}.${fileExt}`,
    `${newVersion}.${fileExt}`,
  );

  const result = {
    key,
    currentVersion,
    newVersion,
    currentFile: currentVersionEntry.file,
    newFile: newFileName,
  };

  outputBumpResult(result, options);

  if (options.dryRun) {
    if (!options.json) {
      info("\nDry run - no changes made");
    }
    return;
  }

  performBump(projectRoot, found, currentVersionEntry, newVersion, newFileName);

  if (!options.json) {
    success(`Created ${newFileName}`);
    success(`Updated ${found.registryType}.json`);
    console.log("\nNext steps:");
    console.log(
      `  1. Edit ${found.registryType}/${newFileName} with your changes`,
    );
    console.log("  2. Commit both the new file and the updated registry");
  }
}

// ============================================================================
// COMMAND DEFINITIONS
// ============================================================================

const validateSubcommand = new Command("validate")
  .description(
    "Validate registry JSON files against schemas and project structure",
  )
  .option("--json", "Output results as JSON", false)
  .action(async (options) => {
    const projectRoot = process.cwd();
    await runValidate(projectRoot, options);
  });

const listSubcommand = new Command("list")
  .description("List all available prompts and rulesets")
  .option("--tier <tier>", "Filter by tier (prototype, internal, production)")
  .option("--language <language>", "Filter by language (python, typescript)")
  .option("--tool <tool>", "Filter by tool (eslint, ruff)")
  .option("--json", "Output results as JSON", false)
  .action((options) => {
    const projectRoot = process.cwd();
    runList(projectRoot, options);
  });

const checkSubcommand = new Command("check")
  .description("Check if a specific prompt or ruleset exists")
  .argument("<key>", "Entry key (e.g., production/python/3.12)")
  .option("--json", "Output results as JSON", false)
  .action((key, options) => {
    const projectRoot = process.cwd();
    runCheck(projectRoot, key, options);
  });

const syncSubcommand = new Command("sync")
  .description(
    "Check registry sync with filesystem (discover new files, find stale entries)",
  )
  .option("--dry-run", "Show what would change without making changes", false)
  .option("--json", "Output results as JSON", false)
  .action(async (options) => {
    const projectRoot = process.cwd();
    await runSync(projectRoot, options);
  });

const bumpSubcommand = new Command("bump")
  .description("Create a new version of a prompt or ruleset")
  .argument("<key>", "Entry key (e.g., production/python/3.12)")
  .requiredOption("--type <type>", "Version bump type (major, minor, patch)")
  .option("--dry-run", "Show what would change without making changes", false)
  .option("--json", "Output results as JSON", false)
  .action((key, options) => {
    if (!["major", "minor", "patch"].includes(options.type)) {
      error("--type must be one of: major, minor, patch");
      process.exit(ExitCode.CONFIG_ERROR);
    }
    const projectRoot = process.cwd();
    runBump(projectRoot, key, options as BumpOptions);
  });

export const registryCommand = new Command("registry")
  .description("Manage prompts and rulesets registries")
  .addCommand(validateSubcommand)
  .addCommand(listSubcommand)
  .addCommand(checkSubcommand)
  .addCommand(syncSubcommand)
  .addCommand(bumpSubcommand)
  .addHelpText(
    "after",
    `
Examples:
  $ cmc registry validate              Validate all registries
  $ cmc registry list                  List all available standards
  $ cmc registry list --tier=production  List production-tier standards
  $ cmc registry check production/python/3.12  Check if entry exists
  $ cmc registry sync --dry-run        Preview sync changes
  $ cmc registry bump production/python/3.12 --type=patch  Bump version`,
  );
