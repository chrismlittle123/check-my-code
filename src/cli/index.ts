#!/usr/bin/env node

import { Command } from 'commander';
import { checkCommand } from './commands/check.js';

const VERSION = '1.0.0';

const program = new Command();

program
  .name('cmc')
  .description('Verify code against configurable rulesets')
  .version(VERSION, '-V, --version', 'Show version')
  .option('--no-color', 'Disable colored output')
  .option('--debug', 'Show debug information');

program.addCommand(checkCommand);

program.parse();
