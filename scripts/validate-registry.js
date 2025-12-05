#!/usr/bin/env node

/**
 * Validates prompts.json and rulesets.json against their schemas
 * and verifies that referenced files actually exist in the project.
 */

import Ajv from "ajv";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const ajv = new Ajv({ allErrors: true });

let hasErrors = false;

function error(message) {
  console.error(`\x1b[31m✗ ${message}\x1b[0m`);
  hasErrors = true;
}

function success(message) {
  console.log(`\x1b[32m✓ ${message}\x1b[0m`);
}

function info(message) {
  console.log(`\x1b[36mℹ ${message}\x1b[0m`);
}

/**
 * Load and parse a JSON file
 */
function loadJson(relativePath) {
  const fullPath = join(ROOT_DIR, relativePath);
  try {
    return JSON.parse(readFileSync(fullPath, "utf-8"));
  } catch (e) {
    error(`Failed to load ${relativePath}: ${e.message}`);
    return null;
  }
}

/**
 * Validate JSON against schema
 */
function validateSchema(data, schema, name) {
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid) {
    error(`${name} failed schema validation:`);
    validate.errors.forEach((err) => {
      console.error(`  - ${err.instancePath || "root"}: ${err.message}`);
    });
    return false;
  }

  success(`${name} passes schema validation`);
  return true;
}

/**
 * Validate that all files referenced in prompts.json exist
 */
function validatePromptsFiles(prompts) {
  info("Checking prompts file references...");
  let allValid = true;

  for (const [key, entry] of Object.entries(prompts.prompts)) {
    for (const [version, versionData] of Object.entries(entry.versions)) {
      if (version === "latest") continue;

      const filePath = join(ROOT_DIR, "prompts", versionData.file);
      if (!existsSync(filePath)) {
        error(`Missing file for ${key}@${version}: prompts/${versionData.file}`);
        allValid = false;
      }
    }
  }

  if (allValid) {
    success("All prompt files exist");
  }
  return allValid;
}

/**
 * Validate that all files referenced in rulesets.json exist
 */
function validateRulesetsFiles(rulesets) {
  info("Checking rulesets file references...");
  let allValid = true;

  for (const [key, entry] of Object.entries(rulesets.rulesets)) {
    for (const [version, versionData] of Object.entries(entry.versions)) {
      if (version === "latest") continue;

      const filePath = join(ROOT_DIR, "rulesets", versionData.file);
      if (!existsSync(filePath)) {
        error(`Missing file for ${key}@${version}: rulesets/${versionData.file}`);
        allValid = false;
      }
    }
  }

  if (allValid) {
    success("All ruleset files exist");
  }
  return allValid;
}

/**
 * Check for orphaned files not listed in registry
 */
async function checkOrphanedPrompts(prompts) {
  info("Checking for orphaned prompt files...");

  const registeredFiles = new Set();
  for (const entry of Object.values(prompts.prompts)) {
    for (const [version, versionData] of Object.entries(entry.versions)) {
      if (version !== "latest") {
        registeredFiles.add(versionData.file);
      }
    }
  }

  const actualFiles = await glob("**/[0-9]*.md", {
    cwd: join(ROOT_DIR, "prompts"),
    ignore: ["**/node_modules/**"],
  });

  let hasOrphans = false;
  for (const file of actualFiles) {
    if (!registeredFiles.has(file)) {
      error(`Orphaned prompt file not in registry: prompts/${file}`);
      hasOrphans = true;
    }
  }

  if (!hasOrphans) {
    success("No orphaned prompt files");
  }
}

/**
 * Check for orphaned rulesets not listed in registry
 */
async function checkOrphanedRulesets(rulesets) {
  info("Checking for orphaned ruleset files...");

  const registeredFiles = new Set();
  for (const entry of Object.values(rulesets.rulesets)) {
    for (const [version, versionData] of Object.entries(entry.versions)) {
      if (version !== "latest") {
        registeredFiles.add(versionData.file);
      }
    }
  }

  const actualFiles = await glob("**/[0-9]*.toml", {
    cwd: join(ROOT_DIR, "rulesets"),
    ignore: ["**/node_modules/**"],
  });

  let hasOrphans = false;
  for (const file of actualFiles) {
    if (!registeredFiles.has(file)) {
      error(`Orphaned ruleset file not in registry: rulesets/${file}`);
      hasOrphans = true;
    }
  }

  if (!hasOrphans) {
    success("No orphaned ruleset files");
  }
}

/**
 * Validate that 'latest' points to an existing version
 */
function validateLatestVersions(data, name) {
  info(`Checking ${name} 'latest' references...`);
  let allValid = true;
  const entries = data.prompts || data.rulesets;

  for (const [key, entry] of Object.entries(entries)) {
    const latest = entry.versions.latest;
    if (!entry.versions[latest]) {
      error(`${name} ${key}: 'latest' points to non-existent version '${latest}'`);
      allValid = false;
    }
  }

  if (allValid) {
    success(`All ${name} 'latest' references are valid`);
  }
  return allValid;
}

/**
 * Validate key matches tier in entry
 */
function validateKeyTierConsistency(data, name) {
  info(`Checking ${name} key/tier consistency...`);
  let allValid = true;
  const entries = data.prompts || data.rulesets;

  for (const [key, entry] of Object.entries(entries)) {
    const tierFromKey = key.split("/")[0];
    if (tierFromKey !== entry.tier) {
      error(`${name} ${key}: key tier '${tierFromKey}' doesn't match entry tier '${entry.tier}'`);
      allValid = false;
    }
  }

  if (allValid) {
    success(`All ${name} keys match their tier`);
  }
  return allValid;
}

async function main() {
  console.log("\n📋 Validating coding standards registry\n");

  // Load schemas
  const promptsSchema = loadJson("schemas/prompts.schema.json");
  const rulesetsSchema = loadJson("schemas/rulesets.schema.json");

  if (!promptsSchema || !rulesetsSchema) {
    process.exit(1);
  }

  // Load data files
  const prompts = loadJson("prompts/prompts.json");
  const rulesets = loadJson("rulesets/rulesets.json");

  if (!prompts || !rulesets) {
    process.exit(1);
  }

  console.log("--- Schema Validation ---\n");

  // Validate against schemas
  validateSchema(prompts, promptsSchema, "prompts.json");
  validateSchema(rulesets, rulesetsSchema, "rulesets.json");

  console.log("\n--- File Reference Validation ---\n");

  // Validate file references
  validatePromptsFiles(prompts);
  validateRulesetsFiles(rulesets);

  console.log("\n--- Orphan Detection ---\n");

  // Check for orphaned files
  await checkOrphanedPrompts(prompts);
  await checkOrphanedRulesets(rulesets);

  console.log("\n--- Consistency Checks ---\n");

  // Validate latest versions
  validateLatestVersions(prompts, "prompts");
  validateLatestVersions(rulesets, "rulesets");

  // Validate key/tier consistency
  validateKeyTierConsistency(prompts, "prompts");
  validateKeyTierConsistency(rulesets, "rulesets");

  console.log("");

  if (hasErrors) {
    console.error("\x1b[31m\n❌ Validation failed with errors\x1b[0m\n");
    process.exit(1);
  } else {
    console.log("\x1b[32m\n✅ All validations passed\x1b[0m\n");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
