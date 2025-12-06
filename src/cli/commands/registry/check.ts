/**
 * Registry check subcommand.
 * Checks if a specific prompt or ruleset exists.
 */

import { Command } from "commander";

import { ExitCode } from "../../../types.js";
import {
  type PromptEntry,
  type PromptsRegistry,
  type RulesetEntry,
  type RulesetsRegistry,
} from "./types.js";
import { error, getRegistryPath, loadRegistry, success } from "./utils.js";

interface FoundEntry {
  type: "prompt" | "ruleset";
  entry: PromptEntry | RulesetEntry;
}

function findEntry(projectRoot: string, key: string): FoundEntry | null {
  const promptsPath = getRegistryPath(projectRoot, "prompts");
  const rulesetsPath = getRegistryPath(projectRoot, "rulesets");

  const prompts = loadRegistry<PromptsRegistry>(promptsPath);
  const rulesets = loadRegistry<RulesetsRegistry>(rulesetsPath);

  if (prompts?.prompts[key]) {
    return { type: "prompt", entry: prompts.prompts[key] };
  }
  if (rulesets?.rulesets[key]) {
    return { type: "ruleset", entry: rulesets.rulesets[key] };
  }
  return null;
}

function outputJsonResult(found: FoundEntry | null, key: string): void {
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
}

function outputTextResult(found: FoundEntry | null, key: string): void {
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
  }
}

function runCheck(
  projectRoot: string,
  key: string,
  options: { json?: boolean },
): void {
  const found = findEntry(projectRoot, key);

  if (options.json) {
    outputJsonResult(found, key);
  } else {
    outputTextResult(found, key);
  }

  if (!found) {
    process.exit(ExitCode.VIOLATIONS);
  }
}

export const checkSubcommand = new Command("check")
  .description("Check if a specific prompt or ruleset exists")
  .argument("<key>", "Entry key (e.g., production/python/3.12)")
  .option("--json", "Output results as JSON", false)
  .action((key, options) => {
    const projectRoot = process.cwd();
    runCheck(projectRoot, key, options);
  });
