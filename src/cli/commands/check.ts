import { Command } from "commander";
import { stat } from "fs/promises";
import { glob } from "glob";
import { minimatch } from "minimatch";
import { relative, resolve } from "path";

import { type AuditCheckResult, quickAuditCheck } from "../../audit/index.js";
import {
  ConfigError,
  findProjectRoot,
  loadConfig,
} from "../../config/loader.js";
import {
  countLintableFiles,
  type LinterOptions,
  runLinters,
} from "../../linter/index.js";
import {
  checkRequirements,
  hasRequirements,
  type RequirementsCheckResult,
} from "../../requirements/index.js";
import { type Config, ExitCode, type FilesConfig } from "../../types.js";
import { colors } from "../output.js";
import { type ExtendedCheckResult, outputResults } from "../output-check.js";
import {
  outputRequirementsFailure,
  outputRequirementsSuccess,
} from "../output-requirements.js";

interface CheckOptions {
  json?: boolean;
  quiet?: boolean;
  skipRequirements?: boolean;
}

export const checkCommand = new Command("check")
  .description("Run ESLint, Ruff, and TypeScript type checks on project files")
  .argument("[paths...]", "Paths to check (default: current directory)")
  .option("--json", "Output results as JSON", false)
  .option("-q, --quiet", "Suppress all output (exit code only)", false)
  .option("--skip-requirements", "Skip requirements validation", false)
  .addHelpText(
    "after",
    `
Examples:
  $ cmc check                      Check entire project
  $ cmc check src/                 Check specific directory
  $ cmc check src/main.ts          Check specific file
  $ cmc check file1.ts file2.ts    Check multiple files
  $ cmc check --json               Output as JSON for CI/tooling
  $ cmc check --quiet              Silent mode (exit code only)
  $ cmc check --skip-requirements  Skip requirements validation`,
  )
  .action(async (paths: string[], options: CheckOptions) => {
    try {
      await executeCheck(paths, options);
    } catch (error: unknown) {
      handleCheckError(error, options.json ?? false, options.quiet ?? false);
    }
  });

/** Main check execution logic */
async function executeCheck(
  paths: string[],
  options: CheckOptions,
): Promise<void> {
  const json = options.json ?? false;
  const quiet = json || (options.quiet ?? false);
  const skipRequirements = options.skipRequirements ?? false;

  const projectRoot = findProjectRoot();
  const config = await loadConfig(projectRoot);

  // Check requirements first (unless skipped)
  const requirementsResult = validateRequirementsIfNeeded({
    projectRoot,
    config,
    skipRequirements,
    json,
    quiet,
  });

  // Perform audit check (shows warnings before linting)
  const auditWarnings = await performPreCheckAudit(
    projectRoot,
    config,
    json,
    quiet,
  );

  const result = await runCheck({
    projectRoot,
    config,
    paths,
    quiet,
    auditWarnings,
    requirementsResult,
  });

  outputResults(result, json, quiet);
  process.exit(
    result.violations.length > 0 ? ExitCode.VIOLATIONS : ExitCode.SUCCESS,
  );
}

interface RequirementsValidationOptions {
  projectRoot: string;
  config: Config;
  skipRequirements: boolean;
  json: boolean;
  quiet: boolean;
}

/** Validate requirements and exit if failed, return result if passed */
function validateRequirementsIfNeeded(
  opts: RequirementsValidationOptions,
): RequirementsCheckResult | undefined {
  if (opts.skipRequirements || !hasRequirements(opts.config)) {
    return undefined;
  }

  const result = checkRequirements(opts.projectRoot, opts.config);
  if (!result.passed) {
    outputRequirementsFailure(result, opts.json, opts.quiet);
    process.exit(ExitCode.VIOLATIONS);
  }

  if (!opts.json && !opts.quiet) {
    outputRequirementsSuccess(result);
  }
  return result;
}

/**
 * Perform pre-check audit to detect config mismatches.
 * This runs before linting to show warnings even if linting fails.
 */
async function performPreCheckAudit(
  projectRoot: string,
  config: Config,
  json: boolean,
  quiet: boolean,
): Promise<AuditCheckResult | undefined> {
  const auditResult = await quickAuditCheck(projectRoot, config);
  const hasWarnings =
    auditResult.missingConfigs.length > 0 ||
    auditResult.mismatchedConfigs.length > 0;

  if (!hasWarnings) {
    return undefined;
  }

  // Output warnings immediately (before linting) unless in quiet mode
  // For JSON mode, we'll include them in the final output
  if (!json && !quiet) {
    outputAuditWarnings(auditResult);
    console.log(); // Empty line between warnings and linting output
  }

  return auditResult;
}

interface RunCheckOptions {
  projectRoot: string;
  config: Config;
  paths: string[];
  quiet?: boolean;
  auditWarnings?: AuditCheckResult;
  requirementsResult?: RequirementsCheckResult;
}

async function runCheck(
  options: RunCheckOptions,
): Promise<ExtendedCheckResult> {
  const {
    projectRoot,
    config,
    paths,
    quiet = false,
    auditWarnings,
    requirementsResult,
  } = options;
  // If no paths provided, check entire project
  const targetPaths =
    paths.length > 0
      ? paths.map((p) => resolve(projectRoot, p))
      : [projectRoot];

  // Discover files from all paths in parallel
  const discoveryResults = await Promise.all(
    targetPaths.map((p) => discoverFiles(p, projectRoot, config.files)),
  );

  const { files, notFoundPaths } = processDiscoveryResults(
    discoveryResults,
    targetPaths,
  );

  // Validate that we found something when paths were explicitly provided
  validateDiscoveryResults(files, notFoundPaths, paths, projectRoot);

  if (files.length === 0) {
    return {
      violations: [],
      filesChecked: 0,
      auditWarnings,
      requirementsResult,
    };
  }

  // Build linter options from config
  const linterOptions = buildLinterOptions(config, quiet);
  const violations = await runLinters(projectRoot, files, linterOptions);

  // Only count files that were actually linted (have recognized extensions)
  const filesChecked = countLintableFiles(files, linterOptions);

  return {
    violations,
    filesChecked,
    auditWarnings,
    requirementsResult,
  };
}

function processDiscoveryResults(
  results: DiscoverResult[],
  targetPaths: string[],
): { files: string[]; notFoundPaths: string[] } {
  const allFiles: string[] = [];
  const notFoundPaths: string[] = [];

  results.forEach((result, i) => {
    const targetPath = targetPaths[i];
    if (!result.found && targetPath !== undefined) {
      notFoundPaths.push(targetPath);
    }
    allFiles.push(...result.files);
  });

  // Deduplicate files (in case overlapping paths were provided)
  return { files: [...new Set(allFiles)], notFoundPaths };
}

function validateDiscoveryResults(
  files: string[],
  notFoundPaths: string[],
  originalPaths: string[],
  projectRoot: string,
): void {
  // If explicit paths were provided but none were found, throw an error
  if (
    originalPaths.length > 0 &&
    files.length === 0 &&
    notFoundPaths.length > 0
  ) {
    throw new ConfigError(
      `Path not found: ${notFoundPaths.map((p) => relative(projectRoot, p) || p).join(", ")}`,
    );
  }
}

function shouldEnableTsc(config: Config): boolean {
  // [tools] tsc = false explicitly disables tsc
  if (config.tools?.tsc === false) return false;

  // Enable if [tools] tsc = true OR [rulesets.tsc] is configured and not disabled
  const enabledByTools = config.tools?.tsc === true;
  const enabledByRulesets = Boolean(
    config.rulesets?.tsc && config.rulesets.tsc.enabled !== false,
  );

  return enabledByTools || enabledByRulesets;
}

function buildLinterOptions(config: Config, quiet = false): LinterOptions {
  return {
    quiet,
    eslintDisabled: config.tools?.eslint === false,
    ruffDisabled: config.tools?.ruff === false,
    tscEnabled: shouldEnableTsc(config),
  };
}

interface DiscoverResult {
  files: string[];
  found: boolean;
}

// Default patterns when no [files] config is provided
const DEFAULT_INCLUDE_PATTERNS = ["**/*.{ts,tsx,js,jsx,mjs,cjs,py,pyi}"];
const DEFAULT_EXCLUDE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/__pycache__/**",
  "**/.venv/**",
  // Linter config files should not be linted
  "**/eslint.config.*",
  "**/ruff.toml",
  "**/pyproject.toml",
];

/**
 * Check if a file path matches any of the given glob patterns.
 */
function matchesPatterns(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(filePath, pattern));
}

/**
 * Check if a single file should be included based on filesConfig patterns.
 */
function shouldIncludeFile(
  relPath: string,
  filesConfig?: FilesConfig,
): boolean {
  if (!filesConfig?.include && !filesConfig?.exclude) {
    return true;
  }
  const matchesInclude = matchesPatterns(
    relPath,
    filesConfig.include ?? DEFAULT_INCLUDE_PATTERNS,
  );
  const matchesExclude = matchesPatterns(relPath, filesConfig.exclude ?? []);
  return matchesInclude && !matchesExclude;
}

/**
 * Discover files in a directory based on filesConfig patterns.
 */
async function discoverFilesInDirectory(
  targetPath: string,
  projectRoot: string,
  filesConfig?: FilesConfig,
): Promise<string[]> {
  const includePatterns = filesConfig?.include ?? DEFAULT_INCLUDE_PATTERNS;
  const excludePatterns = [
    ...DEFAULT_EXCLUDE_PATTERNS,
    ...(filesConfig?.exclude ?? []),
  ];

  const patterns = includePatterns.map((p) => `${targetPath}/${p}`);
  const foundFiles = await glob(patterns, {
    nodir: true,
    ignore: excludePatterns.map((p) =>
      p.startsWith("**/") ? p : `${targetPath}/${p}`,
    ),
  });

  return foundFiles.map((f) => relative(projectRoot, f)).sort();
}

async function discoverFiles(
  targetPath: string,
  projectRoot: string,
  filesConfig?: FilesConfig,
): Promise<DiscoverResult> {
  const stats = await stat(targetPath).catch(() => null);

  if (!stats) {
    return { files: [], found: false };
  }

  if (stats.isFile()) {
    const relPath = relative(projectRoot, targetPath);
    const included = shouldIncludeFile(relPath, filesConfig);
    return { files: included ? [relPath] : [], found: true };
  }

  const files = await discoverFilesInDirectory(
    targetPath,
    projectRoot,
    filesConfig,
  );
  return { files, found: true };
}

function outputAuditWarnings(auditWarnings: AuditCheckResult): void {
  // Output missing config warnings
  for (const missing of auditWarnings.missingConfigs) {
    console.log(
      colors.yellow(
        `⚠ Config file ${missing.filename} not found. ` +
          `Run 'cmc generate ${missing.linter}' to create it from cmc.toml rules.`,
      ),
    );
  }

  // Output mismatch warnings
  for (const mismatch of auditWarnings.mismatchedConfigs) {
    const mismatchCount = mismatch.mismatches.length;
    const s = mismatchCount === 1 ? "" : "es";
    console.log(
      colors.yellow(
        `⚠ ${mismatch.filename} has ${mismatchCount} mismatch${s} with cmc.toml. ` +
          `Run 'cmc generate ${mismatch.linter} --force' to sync.`,
      ),
    );
  }
}

type ErrorCode = "CONFIG_ERROR" | "RUNTIME_ERROR";

interface ErrorInfo {
  code: ErrorCode;
  exitCode: number;
}

function getErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof ConfigError) {
    return { code: "CONFIG_ERROR", exitCode: ExitCode.CONFIG_ERROR };
  }
  // All other errors (including LinterError) are treated as runtime errors
  return { code: "RUNTIME_ERROR", exitCode: ExitCode.RUNTIME_ERROR };
}

function handleCheckError(
  error: unknown,
  json: boolean,
  quiet: boolean,
): never {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const { code: errorCode, exitCode } = getErrorInfo(error);

  // --json takes precedence over --quiet (JSON output is still useful for CI)
  if (json) {
    console.log(
      JSON.stringify(
        {
          error: {
            code: errorCode,
            message: errorMessage,
          },
        },
        null,
        2,
      ),
    );
  } else if (!quiet) {
    console.error(colors.red(`Error: ${errorMessage}`));
  }
  process.exit(exitCode);
}
