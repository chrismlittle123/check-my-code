/**
 * Registry list subcommand.
 * Lists all available prompts and rulesets.
 */

import { Command } from "commander";

import type { PromptsRegistry, RulesetsRegistry } from "./types.js";
import { getRegistryPath, loadRegistry } from "./utils.js";

interface ListOptions {
  tier?: string;
  language?: string;
  tool?: string;
  json?: boolean;
}

interface ListItem {
  key: string;
  type: "prompt" | "ruleset";
  tier: string;
  description: string;
  latest: string;
  tool?: string;
}

function collectPrompts(
  prompts: PromptsRegistry | null,
  options: ListOptions,
): ListItem[] {
  if (!prompts) return [];

  const results: ListItem[] = [];
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
      latest:
        typeof entry.versions.latest === "string"
          ? entry.versions.latest
          : "unknown",
    });
  }
  return results;
}

function collectRulesets(
  rulesets: RulesetsRegistry | null,
  options: ListOptions,
): ListItem[] {
  if (!rulesets) return [];

  const results: ListItem[] = [];
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
      latest:
        typeof entry.versions.latest === "string"
          ? entry.versions.latest
          : "unknown",
      tool: entry.tool,
    });
  }
  return results;
}

function outputResults(results: ListItem[], json: boolean): void {
  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

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

function runList(projectRoot: string, options: ListOptions): void {
  const promptsPath = getRegistryPath(projectRoot, "prompts");
  const rulesetsPath = getRegistryPath(projectRoot, "rulesets");

  const prompts = loadRegistry<PromptsRegistry>(promptsPath);
  const rulesets = loadRegistry<RulesetsRegistry>(rulesetsPath);

  if (!prompts && !rulesets) {
    console.log(
      "No registries found. Run from a project with prompts/ or rulesets/ directories.",
    );
    return;
  }

  const results = [
    ...collectPrompts(prompts, options),
    ...collectRulesets(rulesets, options),
  ];

  outputResults(results, options.json ?? false);
}

export const listSubcommand = new Command("list")
  .description("List all available prompts and rulesets")
  .option("--tier <tier>", "Filter by tier (prototype, internal, production)")
  .option("--language <language>", "Filter by language (python, typescript)")
  .option("--tool <tool>", "Filter by tool (eslint, ruff)")
  .option("--json", "Output results as JSON", false)
  .action((options) => {
    const projectRoot = process.cwd();
    runList(projectRoot, options);
  });
