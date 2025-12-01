#!/usr/bin/env node

import { Command } from 'commander';
import { checkCommand } from './commands/check.js';

const program = new Command();

program.name('cmc').description('Run ESLint and Ruff linters on your code').version('1.0.0');

program.addCommand(checkCommand);

program.parse();
