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
  if (!config['prompts']?.templates?.length) {
    console.error('Error: No prompts templates configured in cmc.toml.');
    console.error('\nAdd to your cmc.toml:');
    console.error('  [prompts]');
    console.error('  templates = ["typescript/5.5"]');
    process.exit(ExitCode.CONFIG_ERROR);
  }
  return {
    templates: config['prompts'].templates,
    source: config['prompts'].source ?? DEFAULT_AI_CONTEXT_SOURCE,
  };
}

// Manifest structure for prompts.json
interface PromptsManifest {
  schema_version: string;
  prompts: Record<
    string,
    {
      description: string;
      format: string;
      versions: Record<string, string | { file: string }>;
    }
  >;
}

// Cache the manifest to avoid fetching it multiple times
let manifestCache: PromptsManifest | null = null;

async function loadManifest(source: string): Promise<PromptsManifest> {
  if (manifestCache) {
    return manifestCache;
  }

  try {
    const content = await fetchRemoteFile(source, 'prompts.json');
    manifestCache = JSON.parse(content) as PromptsManifest;
    return manifestCache;
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      throw new TemplateError(
        `Failed to load prompts manifest.\n` + `Source: ${source}\n` + `Error: ${error.message}`
      );
    }
    throw error;
  }
}

function resolveTemplatePath(
  manifest: PromptsManifest,
  templateName: string,
  requestedVersion?: string
): string {
  const prompt = manifest.prompts[templateName];
  if (!prompt) {
    const available = Object.keys(manifest.prompts).join(', ');
    throw new TemplateError(
      `Template "${templateName}" not found.\n` + `Available templates: ${available}`
    );
  }

  // Resolve version: use requested version, or 'latest', or first available
  const version = requestedVersion ?? 'latest';
  const versionEntry = prompt.versions[version];

  if (!versionEntry) {
    const availableVersions = Object.keys(prompt.versions).join(', ');
    throw new TemplateError(
      `Version "${version}" not found for template "${templateName}".\n` +
        `Available versions: ${availableVersions}`
    );
  }

  // Handle 'latest' which points to another version
  if (typeof versionEntry === 'string') {
    const resolvedEntry = prompt.versions[versionEntry];
    if (!resolvedEntry || typeof resolvedEntry === 'string') {
      throw new TemplateError(`Invalid version reference for "${templateName}@${version}"`);
    }
    return resolvedEntry.file;
  }

  return versionEntry.file;
}

async function loadTemplate(templateName: string, source: string): Promise<string> {
  try {
    // Parse template name for optional version: "typescript/strict@1.0.0"
    const parts = templateName.split('@');
    const name = parts[0] ?? templateName;
    const version = parts[1];

    // Fetch and parse manifest
    const manifest = await loadManifest(source);

    // Resolve the file path from manifest
    const filePath = resolveTemplatePath(manifest, name, version);

    // Fetch the actual template file
    const content = await fetchRemoteFile(source, filePath);
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
  .addHelpText(
    'after',
    `
Examples:
  $ cmc context --target claude   Append to CLAUDE.md
  $ cmc context --target cursor   Append to .cursorrules
  $ cmc context --target copilot  Append to .github/copilot-instructions.md
  $ cmc context --stdout          Preview output without writing

Requires prompts templates in cmc.toml:
  [prompts]
  templates = ["typescript/5.5"]`
  )
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
