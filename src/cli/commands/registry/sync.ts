/**
 * Registry sync subcommand.
 * Checks registry sync with filesystem (discovers new files, finds stale entries).
 */

import { Command } from "commander";
import { existsSync } from "fs";
import { glob } from "glob";
import { join } from "path";

import type {
  PromptsRegistry,
  RegistryEntries,
  RegistryType,
  RulesetsRegistry,
  VersionEntry,
} from "./types.js";
import {
  collectRegisteredFiles,
  getRegistryEntries,
  getRegistryPath,
  inferKeyFromPath,
  loadRegistry,
  success,
  warning,
} from "./utils.js";

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

async function collectChangesForRegistry(
  projectRoot: string,
  registryType: RegistryType,
): Promise<SyncChange[]> {
  const changes: SyncChange[] = [];
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
    return changes;
  }

  const entries = getRegistryEntries(registry, registryType);
  const filePattern =
    registryType === "prompts" ? "**/[0-9]*.md" : "**/[0-9]*.toml";
  const actualFiles = await glob(filePattern, {
    cwd: join(projectRoot, registryType),
    ignore: ["**/node_modules/**"],
  });

  const registeredFiles = collectRegisteredFiles(entries);
  changes.push(
    ...findOrphanedFiles(actualFiles, registeredFiles, registryType),
  );
  changes.push(...findStaleEntries(entries, projectRoot, registryType));

  return changes;
}

function outputChanges(changes: SyncChange[], dryRun: boolean): void {
  if (changes.length === 0) {
    success("Registries are in sync with filesystem");
    return;
  }

  const header = dryRun
    ? "\nDry run - changes that would be made:\n"
    : "\nSyncing registries:\n";
  console.log(header);

  for (const change of changes) {
    const icon = getActionIcon(change.action);
    console.log(`  ${icon} [${change.type}] ${change.action}: ${change.key}`);
    if (change.file) {
      console.log(`    File: ${change.file}`);
    }
  }

  if (!dryRun) {
    warning(
      "\nAuto-sync not yet implemented. Please update registries manually.",
    );
  }
}

async function runSync(
  projectRoot: string,
  options: SyncOptions,
): Promise<void> {
  const promptsChanges = await collectChangesForRegistry(
    projectRoot,
    "prompts",
  );
  const rulesetsChanges = await collectChangesForRegistry(
    projectRoot,
    "rulesets",
  );
  const changes = [...promptsChanges, ...rulesetsChanges];

  if (options.json) {
    console.log(JSON.stringify({ dryRun: options.dryRun, changes }, null, 2));
    return;
  }

  outputChanges(changes, options.dryRun ?? false);
}

export const syncSubcommand = new Command("sync")
  .description(
    "Check registry sync with filesystem (discover new files, find stale entries)",
  )
  .option("--dry-run", "Show what would change without making changes", false)
  .option("--json", "Output results as JSON", false)
  .action(async (options) => {
    const projectRoot = process.cwd();
    await runSync(projectRoot, options);
  });
