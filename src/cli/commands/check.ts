import { Command } from "commander";
import { stat } from "fs/promises";
import { glob } from "glob";
import { minimatch } from "minimatch";
import { relative, resolve } from "path";

import {
  ConfigError,
  findProjectRoot,
  loadConfig,
} from "../../config/loader.js";
import { type LinterOptions, runLinters } from "../../linter/index.js";
import {
  type CheckResult,
  type Config,
  ExitCode,
  type FilesConfig,
} from "../../types.js";
import { colors } from "../output.js";

export const checkCommand = new Command("check")
  .description("Run ESLint, Ruff, and TypeScript type checks on project files")
  .argument("[paths...]", "Paths to check (default: current directory)")
  .option("--json", "Output results as JSON", false)
  .option("-q, --quiet", "Suppress all output (exit code only)", false)
  .addHelpText(
    "after",
    `
Examples:
  $ cmc check                      Check entire project
  $ cmc check src/                 Check specific directory
  $ cmc check src/main.ts          Check specific file
  $ cmc check file1.ts file2.ts    Check multiple files
  $ cmc check --json               Output as JSON for CI/tooling
  $ cmc check --quiet              Silent mode (exit code only)`,
  )
  .action(
    async (paths: string[], options: { json?: boolean; quiet?: boolean }) => {
      try {
        // Suppress linter warnings in JSON mode to avoid polluting JSON output
        const quiet = options.json ?? options.quiet ?? false;
        const result = await runCheck(paths, quiet);
        outputResults(result, options.json ?? false, options.quiet ?? false);
        process.exit(
          result.violations.length > 0 ? ExitCode.VIOLATIONS : ExitCode.SUCCESS,
        );
      } catch (error: unknown) {
        handleCheckError(error, options.json ?? false, options.quiet ?? false);
      }
    },
  );

async function runCheck(paths: string[], quiet = false): Promise<CheckResult> {
  const projectRoot = findProjectRoot();
  const config = await loadConfig(projectRoot);

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
    return { violations: [], filesChecked: 0 };
  }

  // Build linter options from config
  const linterOptions = buildLinterOptions(config, quiet);
  const violations = await runLinters(projectRoot, files, linterOptions);

  return { violations, filesChecked: files.length };
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

function outputResults(
  result: CheckResult,
  json: boolean,
  quiet: boolean,
): void {
  // --json takes precedence over --quiet (JSON output is still useful for CI)
  if (json) {
    console.log(
      JSON.stringify(
        {
          violations: result.violations,
          summary: {
            files_checked: result.filesChecked,
            violations_count: result.violations.length,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  // --quiet suppresses all non-JSON output
  if (quiet) {
    return;
  }

  if (result.violations.length === 0) {
    console.log(
      colors.green(
        `✓ No violations found (${result.filesChecked} files checked)`,
      ),
    );
    return;
  }

  for (const v of result.violations) {
    const location = v.line ? `:${v.line}` : "";
    const filePath = colors.cyan(`${v.file}${location}`);
    const rule = colors.dim(`[${v.linter}/${v.rule}]`);
    console.log(`${filePath} ${rule} ${v.message}`);
  }

  const s = result.violations.length === 1 ? "" : "s";
  console.log(
    colors.red(`\n✗ ${result.violations.length} violation${s} found`),
  );
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
