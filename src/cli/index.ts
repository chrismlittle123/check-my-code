#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Command } from 'commander';
import { checkCommand } from './commands/check.js';
import { contextCommand } from './commands/context.js';
import { generateCommand } from './commands/generate.js';
import { auditCommand } from './commands/audit.js';
import { validateCommand } from './commands/validate.js';
import { mcpServerCommand } from './commands/mcp-server.js';
import { registryCommand } from './commands/registry.js';

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program
  .name('cmc')
  .description('A unified CLI for running ESLint and Ruff linters on your code')
  .version(pkg.version)
  .addHelpText(
    'after',
    `
Examples:
  $ cmc check                    Run linters on entire project
  $ cmc check src/               Check specific directory
  $ cmc check --json             Output results as JSON
  $ cmc generate eslint          Generate eslint.config.js
  $ cmc audit                    Audit linter configs match cmc.toml
  $ cmc validate                 Validate cmc.toml against schema
  $ cmc context --target claude  Add coding standards to CLAUDE.md

Getting started:
  Create a cmc.toml in your project root:
    [project]
    name = "my-project"

Documentation: https://github.com/chrismlittle123/check-my-code`
  );

program.addCommand(checkCommand);
program.addCommand(contextCommand);
program.addCommand(generateCommand);
program.addCommand(auditCommand);
program.addCommand(validateCommand);
program.addCommand(mcpServerCommand);
program.addCommand(registryCommand);

program.parse();
