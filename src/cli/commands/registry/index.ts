/**
 * Registry command - manages prompts and rulesets registries.
 * Provides subcommands: validate, list, check, sync, bump
 */

import { Command } from "commander";

import { bumpSubcommand } from "./bump.js";
import { checkSubcommand } from "./check.js";
import { listSubcommand } from "./list.js";
import { syncSubcommand } from "./sync.js";
import { validateSubcommand } from "./validate.js";

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
