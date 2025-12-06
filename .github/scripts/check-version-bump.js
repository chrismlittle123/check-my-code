#!/usr/bin/env node

/**
 * Pre-commit hook that enforces version bumps when prompt or ruleset files are modified.
 *
 * Rules:
 * 1. If a versioned file (e.g., 1.0.0.md) is modified, you must:
 *    - Create a NEW version file (e.g., 1.0.1.md) with the changes
 *    - Update the corresponding JSON registry to include the new version
 *    - Update 'latest' to point to the new version
 * 2. The old version file should remain unchanged (immutable versions)
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

let hasErrors = false;

function error(message) {
  console.error(`\x1b[31m✗ ${message}\x1b[0m`);
  hasErrors = true;
}

function success(message) {
  console.log(`\x1b[32m✓ ${message}\x1b[0m`);
}

function warning(message) {
  console.log(`\x1b[33m⚠ ${message}\x1b[0m`);
}

function info(message) {
  console.log(`\x1b[36mℹ ${message}\x1b[0m`);
}

/**
 * Parse semantic version string
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare two versions, returns true if v1 > v2
 */
function isNewerVersion(v1, v2) {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);
  if (!p1 || !p2) return false;

  if (p1.major !== p2.major) return p1.major > p2.major;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor;
  return p1.patch > p2.patch;
}

/**
 * Get staged files from git
 */
function getStagedFiles() {
  try {
    const output = execSync("git diff --cached --name-status", {
      encoding: "utf-8",
      cwd: ROOT_DIR,
    });
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [status, ...pathParts] = line.split("\t");
        const path = pathParts.join("\t"); // Handle paths with tabs
        return { status: status.charAt(0), path };
      });
  } catch {
    return [];
  }
}

/**
 * Extract version from file path like "prompts/internal/python/3.12/1.0.0.md"
 */
function extractVersionFromPath(filePath) {
  const filename = basename(filePath);
  const match = filename.match(/^(\d+\.\d+\.\d+)\.(md|toml)$/);
  return match ? match[1] : null;
}

/**
 * Get the registry key from a file path
 * e.g., "prompts/internal/python/3.12/1.0.0.md" -> "internal/python/3.12"
 */
function getRegistryKeyFromPath(filePath, type) {
  const prefix = `${type}/`;
  if (!filePath.startsWith(prefix)) return null;

  const relativePath = filePath.slice(prefix.length);
  const parts = relativePath.split("/");

  if (type === "prompts") {
    // prompts/tier/language/version/file.md -> tier/language/version
    if (parts.length >= 4) {
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
  } else {
    // rulesets/tier/language/version/tool/file.toml -> tier/language/version
    if (parts.length >= 5) {
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
  }
  return null;
}

/**
 * Load JSON registry
 */
function loadRegistry(type) {
  const path = join(ROOT_DIR, type, `${type}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Check if the registry was also modified in this commit
 */
function isRegistryModified(stagedFiles, type) {
  return stagedFiles.some((f) => f.path === `${type}/${type}.json` && f.status !== "D");
}

/**
 * Check if a new version was added for the given key
 */
function checkNewVersionAdded(stagedFiles, type, key, oldVersion) {
  const addedFiles = stagedFiles.filter((f) => f.status === "A" && f.path.startsWith(`${type}/`));

  for (const file of addedFiles) {
    const fileKey = getRegistryKeyFromPath(file.path, type);
    if (fileKey === key) {
      const newVersion = extractVersionFromPath(file.path);
      if (newVersion && isNewerVersion(newVersion, oldVersion)) {
        return newVersion;
      }
    }
  }
  return null;
}

/**
 * Main validation logic
 */
function main() {
  console.log("\n🔍 Checking version bump requirements\n");

  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    info("No staged files to check");
    return;
  }

  // Find modified versioned files (not added, not deleted)
  const modifiedVersionedFiles = stagedFiles.filter((f) => {
    if (f.status !== "M") return false;

    const isPrompt = f.path.startsWith("prompts/") && f.path.endsWith(".md") && !f.path.endsWith("prompts.json");
    const isRuleset = f.path.startsWith("rulesets/") && f.path.endsWith(".toml") && !f.path.endsWith("rulesets.json");

    if (!isPrompt && !isRuleset) return false;

    // Check if it's a versioned file
    return extractVersionFromPath(f.path) !== null;
  });

  if (modifiedVersionedFiles.length === 0) {
    success("No versioned files were modified");
    return;
  }

  info(`Found ${modifiedVersionedFiles.length} modified versioned file(s)\n`);

  for (const file of modifiedVersionedFiles) {
    const type = file.path.startsWith("prompts/") ? "prompts" : "rulesets";
    const key = getRegistryKeyFromPath(file.path, type);
    const oldVersion = extractVersionFromPath(file.path);

    console.log(`  Checking: ${file.path}`);

    if (!key || !oldVersion) {
      warning(`  Could not parse file path: ${file.path}`);
      continue;
    }

    // Check if a new version file was added
    const newVersion = checkNewVersionAdded(stagedFiles, type, key, oldVersion);

    if (!newVersion) {
      error(
        `  Version ${oldVersion} was modified but no new version was created.\n` +
          `     To fix: Create a new version file (e.g., ${incrementPatch(oldVersion)}.${type === "prompts" ? "md" : "toml"})\n` +
          `     and update ${type}/${type}.json accordingly.\n` +
          `     Versions should be immutable once published.`
      );
      continue;
    }

    // Check if the registry was updated
    if (!isRegistryModified(stagedFiles, type)) {
      error(
        `  New version ${newVersion} was added but ${type}/${type}.json was not updated.\n` +
          `     To fix: Add the new version to the registry and update 'latest'.`
      );
      continue;
    }

    // Verify the registry has the new version
    const registry = loadRegistry(type);
    if (registry) {
      const entries = registry[type];
      const entry = entries?.[key];

      if (!entry) {
        error(`  Registry entry not found for ${key}`);
        continue;
      }

      if (!entry.versions[newVersion]) {
        error(
          `  New version ${newVersion} exists as a file but is not in the registry.\n` +
            `     To fix: Add "${newVersion}": { "file": "..." } to ${type}/${type}.json`
        );
        continue;
      }

      if (entry.versions.latest !== newVersion) {
        warning(`  'latest' is set to ${entry.versions.latest}, not ${newVersion}. Is this intentional?`);
      }
    }

    success(`  Version bump to ${newVersion} looks correct`);
  }

  console.log("");

  if (hasErrors) {
    console.error("\x1b[31m❌ Version bump check failed\x1b[0m");
    console.error("\x1b[33m\nVersioned files are immutable. When making changes:\x1b[0m");
    console.error("  1. Create a NEW version file with incremented version number");
    console.error("  2. Update the JSON registry to include the new version");
    console.error("  3. Update 'latest' to point to the new version");
    console.error("  4. Keep the old version file unchanged\n");
    process.exit(1);
  }

  console.log("\x1b[32m✅ Version bump check passed\x1b[0m\n");
}

function incrementPatch(version) {
  const parsed = parseVersion(version);
  if (!parsed) return "1.0.1";
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

main();
