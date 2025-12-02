#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Command } from 'commander';
import { checkCommand } from './commands/check.js';
import { contextCommand } from './commands/context.js';
import { generateCommand } from './commands/generate.js';
import { verifyCommand } from './commands/verify.js';

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program.name('cmc').description('Run ESLint and Ruff linters on your code').version(pkg.version);

program.addCommand(checkCommand);
program.addCommand(contextCommand);
program.addCommand(generateCommand);
program.addCommand(verifyCommand);

program.parse();
