/**
 * Registry bump subcommand.
 * Creates a new version of a prompt or ruleset.
 */

import { Command } from "commander";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";

import { ExitCode } from "../../../types.js";
import {
  type PromptEntry,
  type PromptsRegistry,
  type RegistryType,
  type RulesetEntry,
  type RulesetsRegistry,
  type VersionEntry,
} from "./types.js";
import {
  error,
  getRegistryPath,
  incrementVersion,
  info,
  loadRegistry,
  success,
} from "./utils.js";

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

interface BumpResult {
  key: string;
  currentVersion: string;
  newVersion: string;
  currentFile: string;
  newFile: string;
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

function outputBumpResult(result: BumpResult, options: BumpOptions): void {
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

function copyVersionFile(
  projectRoot: string,
  found: FoundEntry,
  currentVersionEntry: VersionEntry,
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
}

function updateRegistry(
  found: FoundEntry,
  newVersion: string,
  newFileName: string,
): void {
  found.entry.versions[newVersion] = { file: newFileName };
  found.entry.versions.latest = newVersion;

  writeFileSync(
    found.registryPath,
    `${JSON.stringify(found.registry, null, 2)}\n`,
  );
}

function outputNextSteps(found: FoundEntry, newFileName: string): void {
  console.log("\nNext steps:");
  console.log(
    `  1. Edit ${found.registryType}/${newFileName} with your changes`,
  );
  console.log("  2. Commit both the new file and the updated registry");
}

function validateEntry(
  found: FoundEntry | null,
  key: string,
): asserts found is FoundEntry {
  if (!found) {
    error(`Entry not found: ${key}`);
    process.exit(ExitCode.VIOLATIONS);
  }
}

function getCurrentVersionEntry(
  found: FoundEntry,
  key: string,
  currentVersion: string,
): VersionEntry {
  const entry = found.entry.versions[currentVersion] as VersionEntry;
  if (!entry?.file) {
    error(`No file found for current version: ${key}@${currentVersion}`);
    process.exit(ExitCode.RUNTIME_ERROR);
  }
  return entry;
}

function buildNewFileName(
  found: FoundEntry,
  currentVersionEntry: VersionEntry,
  currentVersion: string,
  newVersion: string,
): string {
  const fileExt = found.registryType === "prompts" ? "md" : "toml";
  return currentVersionEntry.file.replace(
    `${currentVersion}.${fileExt}`,
    `${newVersion}.${fileExt}`,
  );
}

interface BumpContext {
  projectRoot: string;
  found: FoundEntry;
  currentVersionEntry: VersionEntry;
  newVersion: string;
  newFileName: string;
  options: BumpOptions;
}

function applyBump(ctx: BumpContext): void {
  copyVersionFile(
    ctx.projectRoot,
    ctx.found,
    ctx.currentVersionEntry,
    ctx.newFileName,
  );
  updateRegistry(ctx.found, ctx.newVersion, ctx.newFileName);

  if (!ctx.options.json) {
    success(`Created ${ctx.newFileName}`);
    success(`Updated ${ctx.found.registryType}.json`);
    outputNextSteps(ctx.found, ctx.newFileName);
  }
}

function runBump(projectRoot: string, key: string, options: BumpOptions): void {
  const found = findEntry(projectRoot, key);
  validateEntry(found, key);

  const currentVersion = found.entry.versions.latest as string;
  const newVersion = incrementVersion(currentVersion, options.type);
  const currentVersionEntry = getCurrentVersionEntry(
    found,
    key,
    currentVersion,
  );
  const newFileName = buildNewFileName(
    found,
    currentVersionEntry,
    currentVersion,
    newVersion,
  );

  const result: BumpResult = {
    key,
    currentVersion,
    newVersion,
    currentFile: currentVersionEntry.file,
    newFile: newFileName,
  };

  outputBumpResult(result, options);

  if (options.dryRun) {
    if (!options.json) info("\nDry run - no changes made");
    return;
  }

  applyBump({
    projectRoot,
    found,
    currentVersionEntry,
    newVersion,
    newFileName,
    options,
  });
}

export const bumpSubcommand = new Command("bump")
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
