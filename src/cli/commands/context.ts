import { Command } from "commander";
import { createHash } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";

import {
  ConfigError,
  findProjectRoot,
  loadConfig,
} from "../../config/loader.js";
import { fetchRemoteFile, RemoteFetchError } from "../../remote/fetcher.js";
import {
  AI_TARGET_FILES,
  type AiTarget,
  type Config,
  DEFAULT_AI_CONTEXT_SOURCE,
  ExitCode,
} from "../../types.js";
import { colors } from "../output.js";

const VALID_TARGETS: AiTarget[] = ["claude", "cursor", "copilot"];

class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
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
    console.error(
      colors.red("Error: Either --target or --stdout must be specified."),
    );
    console.error("Usage: cmc context --target <claude|cursor|copilot>");
    console.error("       cmc context --stdout");
    process.exit(ExitCode.CONFIG_ERROR);
  }

  if (options.target && !isValidTarget(options.target)) {
    console.error(colors.red(`Error: Invalid target "${options.target}".`));
    console.error("Valid targets: claude, cursor, copilot");
    process.exit(ExitCode.CONFIG_ERROR);
  }
}

function validateAiContextConfig(config: Config): {
  templates: string[];
  source: string;
} {
  if (!config["prompts"]?.templates?.length) {
    console.error(
      colors.red("Error: No prompts templates configured in cmc.toml."),
    );
    console.error("\nAdd to your cmc.toml:");
    console.error("  [prompts]");
    console.error('  templates = ["internal/typescript/5.5"]');
    console.error("\nTemplate format: <tier>/<language>/<version>");
    console.error("Available tiers: prototype, internal, production");
    process.exit(ExitCode.CONFIG_ERROR);
  }
  return {
    templates: config["prompts"].templates,
    source: config["prompts"].source ?? DEFAULT_AI_CONTEXT_SOURCE,
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
    const content = await fetchRemoteFile(source, "prompts.json");
    manifestCache = JSON.parse(content) as PromptsManifest;
    return manifestCache;
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      throw new TemplateError(
        `Failed to load prompts manifest.\n` +
          `Source: ${source}\n` +
          `Error: ${error.message}`,
      );
    }
    throw error;
  }
}

function resolveTemplatePath(
  manifest: PromptsManifest,
  templateName: string,
  requestedVersion?: string,
): string {
  const prompt = manifest.prompts[templateName];
  if (!prompt) {
    const available = Object.keys(manifest.prompts).join(", ");
    throw new TemplateError(
      `Template "${templateName}" not found.\n` +
        `Available templates: ${available}`,
    );
  }

  // Resolve version: use requested version, or 'latest', or first available
  const version = requestedVersion ?? "latest";
  const versionEntry = prompt.versions[version];

  if (!versionEntry) {
    const availableVersions = Object.keys(prompt.versions).join(", ");
    throw new TemplateError(
      `Version "${version}" not found for template "${templateName}".\n` +
        `Available versions: ${availableVersions}`,
    );
  }

  // Handle 'latest' which points to another version
  if (typeof versionEntry === "string") {
    const resolvedEntry = prompt.versions[versionEntry];
    if (!resolvedEntry || typeof resolvedEntry === "string") {
      throw new TemplateError(
        `Invalid version reference for "${templateName}@${version}"`,
      );
    }
    return resolvedEntry.file;
  }

  return versionEntry.file;
}

async function loadTemplate(
  templateName: string,
  source: string,
): Promise<string> {
  try {
    // Parse template name for optional version: "typescript/strict@1.0.0"
    const parts = templateName.split("@");
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
          `Error: ${error.message}`,
      );
    }
    throw error;
  }
}

async function loadAllTemplates(
  templates: string[],
  source: string,
): Promise<string> {
  // Load templates sequentially to avoid race conditions in git cache
  const contents: string[] = [];
  for (const template of templates) {
    // eslint-disable-next-line no-await-in-loop
    contents.push(await loadTemplate(template, source));
  }
  return contents.join("\n\n");
}

// Markers for CMC-managed content blocks
const CMC_START_MARKER = "<!-- cmc:context:start";
const CMC_END_MARKER = "<!-- cmc:context:end -->";

function generateContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface CmcBlockMatch {
  startMatch: RegExpExecArray;
  endMatch: RegExpExecArray;
  existingHash: string | null;
}

/** Find existing CMC block markers in content */
function findCmcBlock(content: string): CmcBlockMatch | null {
  const startMarkerRegex = new RegExp(
    `${escapeRegex(CMC_START_MARKER)}:[a-f0-9]+\\s*-->`,
  );
  const endMarkerRegex = new RegExp(escapeRegex(CMC_END_MARKER));

  const startMatch = startMarkerRegex.exec(content);
  const endMatch = endMarkerRegex.exec(content);

  if (!startMatch || !endMatch || startMatch.index >= endMatch.index) {
    return null;
  }

  const existingHashMatch = /:([a-f0-9]{12})\s*-->$/.exec(startMatch[0]);
  return {
    startMatch,
    endMatch,
    existingHash: existingHashMatch?.[1] ?? null,
  };
}

/** Replace existing CMC block with new content */
function replaceExistingBlock(
  existingContent: string,
  block: CmcBlockMatch,
  wrappedOutput: string,
): string {
  const before = existingContent.slice(0, block.startMatch.index);
  const after = existingContent.slice(
    block.endMatch.index + CMC_END_MARKER.length,
  );
  const prefix = before.length > 0 ? "\n\n" : "";
  const suffix = after.trimStart().length > 0 ? "\n\n" : "\n";
  return `${before.trimEnd()}${prefix}${wrappedOutput}${suffix}${after.trimStart()}`;
}

/** Create new content by appending CMC block */
function appendNewBlock(
  existingContent: string,
  wrappedOutput: string,
): string {
  let prefix = "";
  if (existingContent.length > 0 && !existingContent.endsWith("\n\n")) {
    prefix = existingContent.endsWith("\n") ? "\n" : "\n\n";
  }
  return `${existingContent}${prefix}${wrappedOutput}\n`;
}

async function appendToTargetFile(
  projectRoot: string,
  target: AiTarget,
  output: string,
): Promise<void> {
  const targetFile = AI_TARGET_FILES[target];
  const targetPath = join(projectRoot, targetFile);

  ensureDirectoryExists(dirname(targetPath));

  const contentHash = generateContentHash(output);
  const wrappedOutput = `${CMC_START_MARKER}:${contentHash} -->\n${output}\n${CMC_END_MARKER}`;

  const existingContent = await readExistingContent(targetPath);
  const block = findCmcBlock(existingContent);

  if (block) {
    await handleExistingBlock({
      targetPath,
      targetFile,
      existingContent,
      block,
      contentHash,
      wrappedOutput,
    });
  } else {
    await writeFile(
      targetPath,
      appendNewBlock(existingContent, wrappedOutput),
      "utf-8",
    );
    console.log(
      colors.green(
        `✓ Appended context to ${targetFile} (hash: ${contentHash})`,
      ),
    );
  }
}

/** Ensure directory exists, create if needed */
function ensureDirectoryExists(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Read existing file content or return empty string */
async function readExistingContent(path: string): Promise<string> {
  if (existsSync(path)) {
    return readFile(path, "utf-8");
  }
  return "";
}

interface ExistingBlockContext {
  targetPath: string;
  targetFile: string;
  existingContent: string;
  block: CmcBlockMatch;
  contentHash: string;
  wrappedOutput: string;
}

/** Handle updating existing CMC block */
async function handleExistingBlock(ctx: ExistingBlockContext): Promise<void> {
  if (ctx.block.existingHash === ctx.contentHash) {
    console.log(
      colors.green(
        `✓ Context in ${ctx.targetFile} is already up to date (hash: ${ctx.contentHash})`,
      ),
    );
    return;
  }

  const newContent = replaceExistingBlock(
    ctx.existingContent,
    ctx.block,
    ctx.wrappedOutput,
  );
  await writeFile(ctx.targetPath, newContent, "utf-8");
  console.log(
    colors.green(
      `✓ Updated context in ${ctx.targetFile} (hash: ${ctx.contentHash})`,
    ),
  );
}

function handleError(error: unknown): never {
  if (error instanceof ConfigError) {
    console.error(colors.red(`Error: ${error.message}`));
    process.exit(ExitCode.CONFIG_ERROR);
  }
  if (error instanceof TemplateError) {
    console.error(colors.red(`Error: ${error.message}`));
    process.exit(ExitCode.RUNTIME_ERROR);
  }
  if (error instanceof RemoteFetchError) {
    console.error(colors.red(`Error: ${error.message}`));
    process.exit(ExitCode.RUNTIME_ERROR);
  }
  console.error(
    colors.red(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    ),
  );
  process.exit(ExitCode.RUNTIME_ERROR);
}

export const contextCommand = new Command("context")
  .description(
    "Append coding standards context to AI agent configuration files",
  )
  .option("--target <tool>", "Target AI tool: claude, cursor, or copilot")
  .option("--stdout", "Output to stdout instead of appending to file", false)
  .addHelpText(
    "after",
    `
Examples:
  $ cmc context --target claude   Append to CLAUDE.md
  $ cmc context --target cursor   Append to .cursorrules
  $ cmc context --target copilot  Append to .github/copilot-instructions.md
  $ cmc context --stdout          Preview output without writing

Requires prompts templates in cmc.toml:
  [prompts]
  templates = ["internal/typescript/5.5"]

Template format: <tier>/<language>/<version>
Available tiers: prototype, internal, production`,
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
