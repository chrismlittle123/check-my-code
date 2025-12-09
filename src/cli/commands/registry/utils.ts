/**
 * Shared utility functions for registry commands.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

import {
  type PromptEntry,
  type PromptsRegistry,
  type RegistryEntries,
  type RegistryType,
  type RulesetEntry,
  type RulesetsRegistry,
  type VersionEntry,
} from "./types.js";

// Registry paths
export function getRegistryPath(
  projectRoot: string,
  type: RegistryType,
): string {
  return join(projectRoot, type, `${type}.json`);
}

// Load registry JSON
export function loadRegistry<T>(path: string): T | null {
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
export function incrementVersion(
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
export function success(message: string): void {
  console.log(`✓ ${message}`);
}

export function error(message: string): void {
  console.error(`✗ ${message}`);
}

export function info(message: string): void {
  console.log(`ℹ ${message}`);
}

export function warning(message: string): void {
  console.warn(`⚠ ${message}`);
}

// Collect all registered files from entries
export function collectRegisteredFiles(entries: RegistryEntries): Set<string> {
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

// Get entries from registry
export function getRegistryEntries(
  registry: PromptsRegistry | RulesetsRegistry,
  type: RegistryType,
): Record<string, PromptEntry | RulesetEntry> {
  return type === "prompts"
    ? (registry as PromptsRegistry).prompts
    : (registry as RulesetsRegistry).rulesets;
}

// Infer registry key from file path
export function inferKeyFromPath(filePath: string, type: RegistryType): string {
  const parts = filePath.split("/");
  if (type === "prompts" && parts.length >= 4) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  if (type === "rulesets" && parts.length >= 5) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  return filePath;
}
