import { Command } from 'commander';
import { existsSync, mkdirSync } from 'fs';
import { readFile, appendFile } from 'fs/promises';
import { join, dirname } from 'path';
import { loadConfig, findProjectRoot, ConfigError } from '../../config/loader.js';
import { fetchRemoteFile, RemoteFetchError } from '../../remote/fetcher.js';
import {
  ExitCode,
  AI_TARGET_FILES,
  DEFAULT_AI_CONTEXT_SOURCE,
  type AiTarget,
  type Config,
} from '../../types.js';

const VALID_TARGETS: AiTarget[] = ['claude', 'cursor', 'copilot'];

class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateError';
  }
}

interface ContextOptions {
  target?: string;
  stdout?: boolean;
}

function isValidTarget(target: string): target is AiTarget {
  return VALID_TARGETS.includes(target as AiTarget);
}

function validateOptions(options: ContextOptions): void {
  if (!options.stdout && !options.target) {
    console.error('Error: Either --target or --stdout must be specified.');
    console.error('Usage: cmc context --target <claude|cursor|copilot>');
    console.error('       cmc context --stdout');
    process.exit(ExitCode.CONFIG_ERROR);
  }

  if (options.target && !isValidTarget(options.target)) {
    console.error(`Error: Invalid target "${options.target}".`);
    console.error('Valid targets: claude, cursor, copilot');
    process.exit(ExitCode.CONFIG_ERROR);
  }
}

function validateAiContextConfig(config: Config): { templates: string[]; source: string } {
  if (!config['ai-context']?.templates?.length) {
    console.error('Error: No ai-context templates configured in cmc.toml.');
    console.error('\nAdd to your cmc.toml:');
    console.error('  [ai-context]');
    console.error('  templates = ["typescript-strict"]');
    process.exit(ExitCode.CONFIG_ERROR);
  }
  return {
    templates: config['ai-context'].templates,
    source: config['ai-context'].source ?? DEFAULT_AI_CONTEXT_SOURCE,
  };
}

async function loadTemplate(templateName: string, source: string): Promise<string> {
  try {
    // Fetch template from remote repository
    const content = await fetchRemoteFile(source, `${templateName}.md`);
    return content;
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      throw new TemplateError(
        `Template "${templateName}" not found.\n` +
          `Source: ${source}\n` +
          `Error: ${error.message}`
      );
    }
    throw error;
  }
}

async function loadAllTemplates(templates: string[], source: string): Promise<string> {
  // Load templates sequentially to avoid race conditions in git cache
  const contents: string[] = [];
  for (const template of templates) {
    // eslint-disable-next-line no-await-in-loop
    contents.push(await loadTemplate(template, source));
  }
  return contents.join('\n\n');
}

async function appendToTargetFile(
  projectRoot: string,
  target: AiTarget,
  output: string
): Promise<void> {
  const targetFile = AI_TARGET_FILES[target];
  const targetPath = join(projectRoot, targetFile);
  const targetDir = dirname(targetPath);

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  let prefix = '';
  if (existsSync(targetPath)) {
    const existingContent = await readFile(targetPath, 'utf-8');
    if (existingContent.length > 0 && !existingContent.endsWith('\n\n')) {
      prefix = existingContent.endsWith('\n') ? '\n' : '\n\n';
    }
  }

  await appendFile(targetPath, `${prefix}${output}\n`, 'utf-8');
  console.log(`✓ Appended context to ${targetFile}`);
}

function handleError(error: unknown): never {
  if (error instanceof ConfigError) {
    console.error(`Error: ${error.message}`);
    process.exit(ExitCode.CONFIG_ERROR);
  }
  if (error instanceof TemplateError) {
    console.error(`Error: ${error.message}`);
    process.exit(ExitCode.RUNTIME_ERROR);
  }
  if (error instanceof RemoteFetchError) {
    console.error(`Error: ${error.message}`);
    process.exit(ExitCode.RUNTIME_ERROR);
  }
  console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(ExitCode.RUNTIME_ERROR);
}

export const contextCommand = new Command('context')
  .description('Append coding standards context to AI agent configuration files')
  .option('--target <tool>', 'Target AI tool: claude, cursor, or copilot')
  .option('--stdout', 'Output to stdout instead of appending to file', false)
  .action(async (options: ContextOptions) => {
    try {
      validateOptions(options);

      const projectRoot = findProjectRoot();
      const config = await loadConfig(projectRoot);
      const { templates, source } = validateAiContextConfig(config);
      const output = await loadAllTemplates(templates, source);

      if (options.stdout) {
        console.log(output);
        process.exit(ExitCode.SUCCESS);
      }

      await appendToTargetFile(projectRoot, options.target as AiTarget, output);
      process.exit(ExitCode.SUCCESS);
    } catch (error) {
      handleError(error);
    }
  });
