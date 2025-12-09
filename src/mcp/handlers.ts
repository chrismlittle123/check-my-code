/**
 * MCP Tool handler implementations.
 */

import { isAbsolute, resolve } from "path";

import { validateConfigContent } from "../config/loader.js";
import {
  type LinterOptions,
  runLinters,
  runLintersFix,
} from "../linter/index.js";
import { type Config } from "../types.js";
import {
  ErrorCode,
  type ErrorResponse,
  makeError,
  makeSuccess,
  type TextContent,
  toTextContent,
} from "./response.js";
import {
  getState,
  recordFilesChecked,
  recordFixesApplied,
  recordViolationsFound,
} from "./state.js";
import { loadAllTemplates } from "./templates.js";
import { discoverFiles, loadProjectConfig, validateFiles } from "./utils.js";

// Schema version for suggest_config responses
const SCHEMA_VERSION = "1.0.0";

// Default source for templates when not configured
const DEFAULT_AI_CONTEXT_SOURCE =
  "github:chrismlittle123/check-my-code-community/prompts@latest";

/**
 * Build linter options from config
 */
function buildLinterOptions(config: Config): LinterOptions {
  const options: LinterOptions = {};
  if (config.rulesets?.tsc && config.rulesets.tsc.enabled !== false) {
    options.tscEnabled = true;
  }
  return options;
}

/**
 * Handler for check_files tool
 */
export async function handleCheckFiles({
  files,
}: {
  files: string[];
}): Promise<TextContent> {
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

/**
 * Handler for check_project tool
 */
export async function handleCheckProject({
  path,
}: {
  path?: string;
}): Promise<TextContent> {
  const configResult = await loadProjectConfig(path);
  if ("error" in configResult) {
    return toTextContent(configResult);
  }

  const { projectRoot, config } = configResult;
  let targetPath = projectRoot;
  if (path) {
    // Resolve relative paths from cwd, not projectRoot
    // This ensures paths like "subdir" work when MCP runs from parent directory
    targetPath = isAbsolute(path) ? path : resolve(process.cwd(), path);
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

/**
 * Handler for fix_files tool
 */
export async function handleFixFiles({
  files,
}: {
  files: string[];
}): Promise<TextContent> {
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

/**
 * Handler for get_guidelines tool
 */
export async function handleGetGuidelines({
  templates: requestedTemplates,
}: {
  templates?: string[];
}): Promise<TextContent> {
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
    return toTextContent(result as ErrorResponse);
  }

  return toTextContent(
    makeSuccess({
      content: result.contents.join("\n\n"),
      templates_loaded: result.loaded,
    }),
  );
}

/**
 * Handler for get_status tool
 */
export async function handleGetStatus(): Promise<TextContent> {
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

/**
 * Handler for suggest_config tool
 */
export async function handleSuggestConfig({
  description,
}: {
  description: string;
}): Promise<TextContent> {
  if (!description || description.trim().length === 0) {
    return toTextContent(
      makeError(
        ErrorCode.VALIDATION_ERROR,
        "Description cannot be empty",
        true,
      ),
    );
  }

  const schemaGuide = buildSchemaGuide(description);

  return toTextContent(
    makeSuccess({
      prompt: schemaGuide,
      schema_version: SCHEMA_VERSION,
      validation_endpoint:
        "Use validate_config tool to validate the generated TOML",
    }),
  );
}

/**
 * Build schema guidance prompt for config generation
 */
function buildSchemaGuide(description: string): string {
  return `
Generate a valid cmc.toml configuration for the following project:

PROJECT DESCRIPTION:
${description}

SCHEMA REQUIREMENTS:
- [project] section with "name" field (required, non-empty string)
- [prompts] section (optional) with "templates" array for AI coding guidelines
  - Available templates: "internal/typescript/5.5", "internal/python/3.12"
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
templates = ["internal/typescript/5.5"]

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
}

/**
 * Handler for validate_config tool
 */
export async function handleValidateConfig({
  config,
}: {
  config: string;
}): Promise<TextContent> {
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
