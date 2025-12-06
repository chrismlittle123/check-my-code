import { Command } from "commander";
import { stat } from "fs/promises";
import { glob } from "glob";
import { relative, resolve } from "path";

import {
  ConfigError,
  findProjectRoot,
  loadConfig,
} from "../../config/loader.js";
import {
  LinterError,
  type LinterOptions,
  runLinters,
} from "../../linter/index.js";
import { type CheckResult, type Config, ExitCode } from "../../types.js";
import { colors } from "../output.js";

export const checkCommand = new Command("check")
  .description("Run ESLint, Ruff, and TypeScript type checks on project files")
  .argument("[path]", "Path to check (default: current directory)")
  .option("--json", "Output results as JSON", false)
  .option("-q, --quiet", "Suppress all output (exit code only)", false)
  .addHelpText(
    "after",
    `
Examples:
  $ cmc check                Check entire project
  $ cmc check src/           Check specific directory
  $ cmc check src/main.ts    Check specific file
  $ cmc check --json         Output as JSON for CI/tooling
  $ cmc check --quiet        Silent mode (exit code only)`,
  )
  .action(
    async (
      path: string | undefined,
      options: { json?: boolean; quiet?: boolean },
    ) => {
      try {
        const result = await runCheck(path);
        outputResults(result, options.json ?? false, options.quiet ?? false);
        process.exit(
          result.violations.length > 0 ? ExitCode.VIOLATIONS : ExitCode.SUCCESS,
        );
      } catch (error) {
        if (!options.quiet) {
          console.error(
            colors.red(
              `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            ),
          );
        }
        if (error instanceof ConfigError) {
          process.exit(ExitCode.CONFIG_ERROR);
        } else if (error instanceof LinterError) {
          process.exit(ExitCode.RUNTIME_ERROR);
        } else {
          process.exit(ExitCode.RUNTIME_ERROR);
        }
      }
    },
  );

async function runCheck(path?: string): Promise<CheckResult> {
  const projectRoot = findProjectRoot();
  const config = await loadConfig(projectRoot);

  const targetPath = path ? resolve(projectRoot, path) : projectRoot;
  const files = await discoverFiles(targetPath, projectRoot);

  if (files.length === 0) {
    return { violations: [], filesChecked: 0 };
  }

  // Build linter options from config
  const linterOptions = buildLinterOptions(config);
  const violations = await runLinters(projectRoot, files, linterOptions);

  return {
    violations,
    filesChecked: files.length,
  };
}

function buildLinterOptions(config: Config): LinterOptions {
  const options: LinterOptions = {};

  // Enable tsc if configured and not explicitly disabled
  if (config.rulesets?.tsc && config.rulesets.tsc.enabled !== false) {
    options.tscEnabled = true;
  }

  return options;
}

async function discoverFiles(
  targetPath: string,
  projectRoot: string,
): Promise<string[]> {
  const stats = await stat(targetPath).catch(() => null);

  if (!stats) {
    console.error(colors.yellow(`Warning: Path not found: ${targetPath}`));
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
      // Linter config files should not be linted
      "**/eslint.config.*",
      "**/ruff.toml",
      "**/pyproject.toml",
    ],
  });

  return foundFiles.map((f) => relative(projectRoot, f)).sort();
}

function outputResults(
  result: CheckResult,
  json: boolean,
  quiet: boolean,
): void {
  // --quiet takes precedence over --json
  if (quiet) {
    return;
  }

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
