/**
 * MCP Tool definitions and handlers.
 * Exposes linting functionality to AI agents via MCP protocol.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { glob } from "glob";
import { stat } from "fs/promises";
import { resolve, relative } from "path";
import { runLinters, runLintersFix, type LinterOptions } from "../linter.js";
import {
  loadConfig,
  findProjectRoot,
  ConfigError,
  validateConfigContent,
} from "../config/loader.js";
import { fetchRemoteFile, RemoteFetchError } from "../remote/fetcher.js";
import { DEFAULT_AI_CONTEXT_SOURCE, type Config } from "../types.js";
import {
  getState,
  setProjectRoot,
  setConfigFound,
  recordFilesChecked,
  recordViolationsFound,
  recordFixesApplied,
} from "./state.js";

// Error codes for structured error responses
const ErrorCode = {
  CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND",
  CONFIG_INVALID: "CONFIG_INVALID",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  TEMPLATE_NOT_FOUND: "TEMPLATE_NOT_FOUND",
  RUNTIME_ERROR: "RUNTIME_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

interface SuccessResponse {
  success: true;
  [key: string]: unknown;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

type ToolResponse = SuccessResponse | ErrorResponse;

function makeError(
  code: string,
  message: string,
  recoverable = false,
): ErrorResponse {
  return {
    success: false,
    error: { code, message, recoverable },
  };
}

function makeSuccess(data: Record<string, unknown>): SuccessResponse {
  return { success: true, ...data };
}

function toTextContent(response: ToolResponse) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(response, null, 2) },
    ],
  };
}

/**
 * Discover files in a directory matching linter patterns
 */
async function discoverFiles(
  targetPath: string,
  projectRoot: string,
): Promise<string[]> {
  const stats = await stat(targetPath).catch(() => null);

  if (!stats) {
    return [];
  }

  if (stats.isFile()) {
    return [relative(projectRoot, targetPath)];
  }

  const pattern = `${targetPath}/**/*.{ts,tsx,js,jsx,mjs,cjs,py,pyi}`;
  const foundFiles = await glob(pattern, {
    nodir: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/__pycache__/**",
      "**/.venv/**",
      "**/eslint.config.*",
      "**/ruff.toml",
      "**/pyproject.toml",
    ],
  });

  return foundFiles.map((f) => relative(projectRoot, f)).sort();
}

/**
 * Load and validate project configuration
 * @param searchPath - Optional path to start searching for cmc.toml from
 */
async function loadProjectConfig(
  searchPath?: string,
): Promise<{ projectRoot: string; config: Config } | ErrorResponse> {
  try {
    const projectRoot = findProjectRoot(searchPath);
    setProjectRoot(projectRoot);

    const config = await loadConfig(projectRoot);
    setConfigFound(true);

    return { projectRoot, config };
  } catch (error) {
    setConfigFound(false);
    if (error instanceof ConfigError) {
      return makeError(ErrorCode.CONFIG_NOT_FOUND, error.message, false);
    }
    return makeError(ErrorCode.RUNTIME_ERROR, String(error), false);
  }
}

/**
 * Validate that files exist and return valid ones
 */
async function validateFiles(
  files: string[],
  projectRoot: string,
): Promise<string[]> {
  const validFiles: string[] = [];
  const checkPromises = files.map(async (file) => {
    const fullPath = resolve(projectRoot, file);
    const stats = await stat(fullPath).catch(() => null);
    if (stats?.isFile()) {
      return file;
    }
    return null;
  });

  const results = await Promise.all(checkPromises);
  for (const result of results) {
    if (result) {
      validFiles.push(result);
    }
  }

  return validFiles;
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

/**
 * Load prompts manifest from remote source
 */
async function loadManifest(source: string): Promise<PromptsManifest> {
  const content = await fetchRemoteFile(source, "prompts.json");
  return JSON.parse(content) as PromptsManifest;
}

/**
 * Resolve template file path from manifest
 */
function resolveTemplatePath(
  manifest: PromptsManifest,
  templateName: string,
  requestedVersion?: string,
): string | ErrorResponse {
  const prompt = manifest.prompts[templateName];
  if (!prompt) {
    const available = Object.keys(manifest.prompts).join(", ");
    return makeError(
      ErrorCode.TEMPLATE_NOT_FOUND,
      `Template "${templateName}" not found. Available: ${available}`,
      false,
    );
  }

  const version = requestedVersion ?? "latest";
  const versionEntry = prompt.versions[version];

  if (!versionEntry) {
    const availableVersions = Object.keys(prompt.versions).join(", ");
    return makeError(
      ErrorCode.TEMPLATE_NOT_FOUND,
      `Version "${version}" not found for "${templateName}". Available: ${availableVersions}`,
      false,
    );
  }

  if (typeof versionEntry === "string") {
    const resolvedEntry = prompt.versions[versionEntry];
    if (!resolvedEntry || typeof resolvedEntry === "string") {
      return makeError(
        ErrorCode.TEMPLATE_NOT_FOUND,
        `Invalid version reference for "${templateName}@${version}"`,
        false,
      );
    }
    return resolvedEntry.file;
  }

  return versionEntry.file;
}

/**
 * Load a single template from remote source
 */
async function loadTemplate(
  templateName: string,
  source: string,
): Promise<string | ErrorResponse> {
  const parts = templateName.split("@");
  const name = parts[0] ?? templateName;
  const version = parts[1];

  let manifest: PromptsManifest;
  try {
    manifest = await loadManifest(source);
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      return makeError(
        ErrorCode.TEMPLATE_NOT_FOUND,
        `Failed to load manifest: ${error.message}`,
        false,
      );
    }
    throw error;
  }

  const filePath = resolveTemplatePath(manifest, name, version);
  if (typeof filePath !== "string") {
    return filePath; // Error response
  }

  try {
    return await fetchRemoteFile(source, filePath);
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      return makeError(
        ErrorCode.TEMPLATE_NOT_FOUND,
        `Template "${templateName}": ${error.message}`,
        false,
      );
    }
    throw error;
  }
}

/**
 * Load multiple templates sequentially
 */
async function loadAllTemplates(
  templates: string[],
  source: string,
): Promise<{ contents: string[]; loaded: string[] } | ErrorResponse> {
  const contents: string[] = [];
  const loaded: string[] = [];

  for (const template of templates) {
    // Sequential loading to avoid race conditions in git cache
    // eslint-disable-next-line no-await-in-loop
    const result = await loadTemplate(template, source);
    if (typeof result !== "string") {
      return result; // Error response
    }
    contents.push(result);
    loaded.push(template);
  }

  return { contents, loaded };
}

/**
 * Build linter options from config
 */
function buildLinterOptions(config: Config): LinterOptions {
  const options: LinterOptions = {};
  // Enable tsc if configured and not explicitly disabled
  if (config.rulesets?.tsc && config.rulesets.tsc.enabled !== false) {
    options.tscEnabled = true;
  }
  return options;
}

// Tool handler for check_files
async function handleCheckFiles({ files }: { files: string[] }) {
  // Use the first file path to find the project root
  const searchPath = files.length > 0 ? files[0] : undefined;
  const configResult = await loadProjectConfig(searchPath);
  if ("error" in configResult) {
    return toTextContent(configResult);
  }

  const { projectRoot, config } = configResult;
  const validFiles = await validateFiles(files, projectRoot);

  if (validFiles.length === 0) {
    return toTextContent(
      makeError(
        ErrorCode.FILE_NOT_FOUND,
        "No valid files found to check",
        true,
      ),
    );
  }

  const linterOptions = buildLinterOptions(config);
  const violations = await runLinters(projectRoot, validFiles, linterOptions);

  recordFilesChecked(validFiles.length);
  recordViolationsFound(violations.length);

  return toTextContent(
    makeSuccess({
      violations,
      files_checked: validFiles.length,
      has_violations: violations.length > 0,
    }),
  );
}

// Tool handler for check_project
async function handleCheckProject({ path }: { path?: string }) {
  // Use the provided path to find the project root
  const configResult = await loadProjectConfig(path);
  if ("error" in configResult) {
    return toTextContent(configResult);
  }

  const { projectRoot, config } = configResult;
  // If path is absolute, use it; otherwise resolve relative to projectRoot
  let targetPath = projectRoot;
  if (path) {
    targetPath = path.startsWith("/") ? path : resolve(projectRoot, path);
  }

  const files = await discoverFiles(targetPath, projectRoot);

  if (files.length === 0) {
    return toTextContent(
      makeSuccess({
        violations: [],
        files_checked: 0,
        has_violations: false,
        message: "No lintable files found",
      }),
    );
  }

  const linterOptions = buildLinterOptions(config);
  const violations = await runLinters(projectRoot, files, linterOptions);

  recordFilesChecked(files.length);
  recordViolationsFound(violations.length);

  return toTextContent(
    makeSuccess({
      violations,
      files_checked: files.length,
      has_violations: violations.length > 0,
    }),
  );
}

// Tool handler for fix_files
async function handleFixFiles({ files }: { files: string[] }) {
  // Use the first file path to find the project root
  const searchPath = files.length > 0 ? files[0] : undefined;
  const configResult = await loadProjectConfig(searchPath);
  if ("error" in configResult) {
    return toTextContent(configResult);
  }

  const { projectRoot } = configResult;
  const validFiles = await validateFiles(files, projectRoot);

  if (validFiles.length === 0) {
    return toTextContent(
      makeError(ErrorCode.FILE_NOT_FOUND, "No valid files found to fix", true),
    );
  }

  const result = await runLintersFix(projectRoot, validFiles);

  recordFixesApplied(result.fixedCount);
  recordViolationsFound(result.remainingViolations.length);

  return toTextContent(
    makeSuccess({
      fixed_count: result.fixedCount,
      remaining_violations: result.remainingViolations,
      files_modified: result.filesModified,
    }),
  );
}

// Tool handler for get_guidelines
async function handleGetGuidelines({
  templates: requestedTemplates,
}: {
  templates?: string[];
}) {
  const configResult = await loadProjectConfig();
  if ("error" in configResult) {
    return toTextContent(configResult);
  }

  const { config } = configResult;

  let templatesToLoad = requestedTemplates;
  if (!templatesToLoad || templatesToLoad.length === 0) {
    if (!config.prompts?.templates?.length) {
      return toTextContent(
        makeError(
          ErrorCode.CONFIG_INVALID,
          "No templates specified and none configured in cmc.toml [prompts] section",
          true,
        ),
      );
    }
    templatesToLoad = config.prompts.templates;
  }

  const source = config.prompts?.source ?? DEFAULT_AI_CONTEXT_SOURCE;
  const result = await loadAllTemplates(templatesToLoad, source);

  if ("error" in result) {
    return toTextContent(result);
  }

  return toTextContent(
    makeSuccess({
      content: result.contents.join("\n\n"),
      templates_loaded: result.loaded,
    }),
  );
}

// Tool handler for get_status
async function handleGetStatus() {
  const state = getState();

  if (!state.projectRoot) {
    const configResult = await loadProjectConfig();
    if ("error" in configResult) {
      return toTextContent(
        makeSuccess({
          project_root: null,
          config_found: false,
          session_stats: state.stats,
          error: configResult.error,
        }),
      );
    }
  }

  const currentState = getState();

  return toTextContent(
    makeSuccess({
      project_root: currentState.projectRoot,
      config_found: currentState.configFound,
      session_stats: {
        files_checked: currentState.stats.filesChecked,
        violations_found: currentState.stats.violationsFound,
        fixes_applied: currentState.stats.fixesApplied,
      },
    }),
  );
}

// Schema version for suggest_config responses
const SCHEMA_VERSION = "1.0.0";

// Tool handler for suggest_config
async function handleSuggestConfig({ description }: { description: string }) {
  if (!description || description.trim().length === 0) {
    return toTextContent(
      makeError(
        ErrorCode.VALIDATION_ERROR,
        "Description cannot be empty",
        true,
      ),
    );
  }

  // Return guidance for the AI to generate the config, along with schema info
  // The AI client will use this to generate appropriate TOML
  const schemaGuide = `
Generate a valid cmc.toml configuration for the following project:

PROJECT DESCRIPTION:
${description}

SCHEMA REQUIREMENTS:
- [project] section with "name" field (required, non-empty string)
- [prompts] section (optional) with "templates" array for AI coding guidelines
  - Available templates: "typescript/5.5", "python/3.12"
- [rulesets.eslint.rules] section (optional) for ESLint rules
  - Rule values: "off", "warn", "error", or array like ["error", "always"]
- [rulesets.ruff] section (optional) for Ruff Python linter config
  - "line-length" (integer)
  - [rulesets.ruff.lint] with "select" and "ignore" arrays
- [rulesets.tsc] section (optional) for TypeScript type checking
  - "enabled" (boolean) - enable/disable type checking
  - "strict" (boolean) - enable all strict options
  - Individual options: noImplicitAny, strictNullChecks, noUncheckedIndexedAccess, etc.

EXAMPLE CONFIG:
\`\`\`toml
[project]
name = "my-api"

[prompts]
templates = ["typescript/5.5"]

[rulesets.eslint.rules]
"no-console" = "warn"
"@typescript-eslint/no-explicit-any" = "error"

[rulesets.tsc]
strict = true
noUncheckedIndexedAccess = true

[rulesets.ruff]
line-length = 100

[rulesets.ruff.lint]
select = ["E", "F", "I", "UP"]
\`\`\`

GUIDELINES:
- For TypeScript projects: Add [rulesets.tsc] with strict=true for type safety
- For TypeScript projects: Add strict typing ESLint rules, use typescript/5.5 template
- For Python projects: Add Ruff rules for style (E, F), imports (I), upgrades (UP)
- For production/strict projects: Use "error" level, strict=true, add more rules
- For development/flexible projects: Use "warn" level, fewer rules

Return ONLY the TOML content, no markdown code blocks or explanation.
`.trim();

  return toTextContent(
    makeSuccess({
      prompt: schemaGuide,
      schema_version: SCHEMA_VERSION,
      validation_endpoint:
        "Use validate_config tool to validate the generated TOML",
    }),
  );
}

// Tool handler for validate_config
async function handleValidateConfig({ config }: { config: string }) {
  if (!config || config.trim().length === 0) {
    return toTextContent(
      makeError(ErrorCode.VALIDATION_ERROR, "Config cannot be empty", true),
    );
  }

  const result = await validateConfigContent(config);

  if (!result.valid) {
    return toTextContent(
      makeError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid config:\n${result.errors?.join("\n")}`,
        true,
      ),
    );
  }

  return toTextContent(
    makeSuccess({
      validated: true,
      config: config,
      parsed: result.config,
      schema_version: SCHEMA_VERSION,
    }),
  );
}

export function registerTools(server: McpServer): void {
  server.tool(
    "check_files",
    "Lint specific files for violations. Returns violations found in the specified files.",
    {
      files: z
        .array(z.string())
        .describe("Array of file paths to check (relative to project root)"),
    },
    handleCheckFiles,
  );

  server.tool(
    "check_project",
    "Lint entire project or a subdirectory. Discovers all lintable files and checks them.",
    {
      path: z
        .string()
        .optional()
        .describe("Optional subdirectory to check (defaults to project root)"),
    },
    handleCheckProject,
  );

  server.tool(
    "fix_files",
    "Auto-fix linting violations in specific files using ESLint --fix and Ruff --fix.",
    {
      files: z
        .array(z.string())
        .describe("Array of file paths to fix (relative to project root)"),
    },
    handleFixFiles,
  );

  server.tool(
    "get_guidelines",
    "Fetch coding standards/guidelines templates. Uses templates from cmc.toml or specified templates.",
    {
      templates: z
        .array(z.string())
        .optional()
        .describe(
          'Optional array of template names (e.g., ["typescript/5.5"]). Defaults to cmc.toml config.',
        ),
    },
    handleGetGuidelines,
  );

  server.tool(
    "get_status",
    "Get current session state including project info and statistics.",
    {},
    handleGetStatus,
  );

  server.tool(
    "suggest_config",
    "Generate a cmc.toml configuration based on a project description. Returns a prompt with schema guidance for the AI to generate appropriate config.",
    {
      description: z
        .string()
        .describe(
          'Natural language description of the project (e.g., "A TypeScript REST API using Express with strict type checking")',
        ),
    },
    handleSuggestConfig,
  );

  server.tool(
    "validate_config",
    "Validate TOML content against the cmc.toml schema. Use after suggest_config to verify generated config.",
    {
      config: z
        .string()
        .describe("TOML content to validate against the cmc.toml schema"),
    },
    handleValidateConfig,
  );
}
