#!/usr/bin/env node

import { Command } from 'commander';
import { checkCommand } from './commands/check.js';
import { contextCommand } from './commands/context.js';
import { generateCommand } from './commands/generate.js';
import { verifyCommand } from './commands/verify.js';

const program = new Command();

program.name('cmc').description('Run ESLint and Ruff linters on your code').version('1.0.0');

program.addCommand(checkCommand);
program.addCommand(contextCommand);
program.addCommand(generateCommand);
program.addCommand(verifyCommand);

program.parse();
