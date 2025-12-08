/**
 * Linter runner functions.
 */

import { existsSync } from "fs";
import { join } from "path";

import { type Violation } from "../types.js";
import { commandExists, runCommand, runCommandWithStderr } from "./command.js";
import {
  parseESLintOutput,
  parseRuffOutput,
  parseTscOutput,
} from "./parsers.js";
import {
  CommandError,
  CommandErrorWithStderr,
  LinterError,
  type LinterOptions,
} from "./types.js";

export async function runLinters(
  projectRoot: string,
  files: string[],
  options?: LinterOptions,
): Promise<Violation[]> {
  const violations: Violation[] = [];

  const pythonFiles = files.filter(
    (f) => f.endsWith(".py") || f.endsWith(".pyi"),
  );
  const tsFiles = files.filter((f) => /\.(ts|tsx)$/.test(f));
  const jsFiles = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f));

  if (pythonFiles.length > 0) {
    const ruffViolations = await runRuff(projectRoot, pythonFiles);
    violations.push(...ruffViolations);
  }

  if (jsFiles.length > 0) {
    const eslintViolations = await runESLint(projectRoot, jsFiles);
    violations.push(...eslintViolations);
  }

  // Run TypeScript type checking if enabled and there are TS files
  if (tsFiles.length > 0 && options?.tscEnabled) {
    const tscViolations = await runTsc(projectRoot, tsFiles);
    violations.push(...tscViolations);
  }

  return violations;
}

export async function runRuff(
  projectRoot: string,
  files: string[],
): Promise<Violation[]> {
  const hasRuff = await commandExists("ruff");
  if (!hasRuff) {
    console.error("Warning: Ruff not found, skipping Python file checks");
    return [];
  }

  const absoluteFiles = files.map((f) => join(projectRoot, f));
  const args = ["check", "--output-format=json", ...absoluteFiles];

  try {
    const output = await runCommand("ruff", args, projectRoot);
    return parseRuffOutput(output, projectRoot);
  } catch (error) {
    return handleRuffError(error, projectRoot);
  }
}

function handleRuffError(error: unknown, projectRoot: string): Violation[] {
  if (error instanceof CommandError && error.stdout) {
    // Ruff exits with non-zero when it finds violations - parse the output
    const violations = parseRuffOutput(error.stdout, projectRoot);
    if (violations.length > 0) {
      return violations;
    }
    // If no violations but exit code was non-zero, check for config errors
    throw new LinterError(
      `Ruff failed to run. This may indicate a configuration error.\n` +
        `Exit code was non-zero but no violations were found.\n` +
        `Please check your ruff.toml configuration.`,
    );
  }
  // Unknown error - likely a spawn error or ruff crashed
  throw new LinterError(
    `Ruff failed to execute: ${error instanceof Error ? error.message : String(error)}`,
  );
}

export async function runESLint(
  projectRoot: string,
  files: string[],
): Promise<Violation[]> {
  const eslintBin = await findESLintBin(projectRoot);
  if (!eslintBin) {
    console.error(
      "Warning: ESLint not found, skipping JavaScript/TypeScript file checks",
    );
    return [];
  }

  const absoluteFiles = files.map((f) => join(projectRoot, f));
  const args = [
    "--format=json",
    "--no-error-on-unmatched-pattern",
    "--no-ignore",
    "--no-warn-ignored",
    ...absoluteFiles,
  ];

  try {
    const output = await runCommand(eslintBin, args, projectRoot);
    return parseESLintOutput(output, projectRoot);
  } catch (error) {
    return handleESLintError(error, projectRoot);
  }
}

async function findESLintBin(projectRoot: string): Promise<string | null> {
  const localEslintPath = join(projectRoot, "node_modules", ".bin", "eslint");
  const hasLocalESLint = existsSync(localEslintPath);
  const hasGlobalESLint = await commandExists("eslint");

  if (hasLocalESLint) return localEslintPath;
  if (hasGlobalESLint) return "eslint";
  return null;
}

function handleESLintError(error: unknown, projectRoot: string): Violation[] {
  if (error instanceof CommandError && error.stdout) {
    const violations = parseESLintOutput(error.stdout, projectRoot);
    if (violations.length > 0) {
      return violations;
    }
    // Check if the output looks like valid JSON (empty results array)
    try {
      const parsed = JSON.parse(error.stdout);
      if (Array.isArray(parsed)) {
        return [];
      }
    } catch {
      // Not valid JSON - ESLint failed to run properly
    }
    throw new LinterError(
      `ESLint failed to run. This may indicate a configuration error.\n` +
        `Check your eslint.config.js and ensure all required packages are installed.\n` +
        `Exit code was non-zero but no valid lint output was produced.`,
    );
  }
  throw new LinterError(
    `ESLint failed to execute: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/** Filter violations to only include files from the requested list */
function filterViolationsByFiles(
  violations: Violation[],
  files?: string[],
): Violation[] {
  if (!files || files.length === 0) return violations;
  const fileSet = new Set(files);
  return violations.filter((v) => fileSet.has(v.file));
}

/**
 * Run TypeScript type checking.
 * TypeScript type checking is inherently project-wide since types from one file
 * affect others. We run tsc on the full project but filter violations to only
 * include files from the requested list.
 *
 * @param projectRoot - Project root directory
 * @param files - List of files to report violations for (relative to projectRoot)
 */
export async function runTsc(
  projectRoot: string,
  files?: string[],
): Promise<Violation[]> {
  const tscBin = await findTscBin(projectRoot);
  if (!tscBin) {
    console.error("Warning: TypeScript (tsc) not found, skipping type checks");
    return [];
  }

  if (!existsSync(join(projectRoot, "tsconfig.json"))) {
    console.error("Warning: No tsconfig.json found, skipping type checks");
    return [];
  }

  const args = ["--noEmit", "--pretty", "false"];

  try {
    const output = await runCommandWithStderr(tscBin, args, projectRoot);
    return filterViolationsByFiles(parseTscOutput(output, projectRoot), files);
  } catch (error) {
    return handleTscError(error, projectRoot, files);
  }
}

function handleTscError(
  error: unknown,
  projectRoot: string,
  files?: string[],
): Violation[] {
  if (error instanceof CommandErrorWithStderr) {
    const violations = parseTscOutput(error.stdout + error.stderr, projectRoot);
    if (violations.length > 0) {
      return filterViolationsByFiles(violations, files);
    }
    // Non-zero exit with no violations indicates config error
    throw new LinterError(
      "TypeScript (tsc) failed to run. This may indicate a configuration error.\n" +
        "Exit code was non-zero but no location-based diagnostics were parsed.\n" +
        "Please check your tsconfig.json and referenced projects.",
    );
  }
  // Unknown error - likely spawn failure
  throw new LinterError(
    `TypeScript (tsc) failed to execute: ${error instanceof Error ? error.message : String(error)}`,
  );
}

async function findTscBin(projectRoot: string): Promise<string | null> {
  const localTscPath = join(projectRoot, "node_modules", ".bin", "tsc");
  const hasLocalTsc = existsSync(localTscPath);
  const hasGlobalTsc = await commandExists("tsc");

  if (hasLocalTsc) return localTscPath;
  if (hasGlobalTsc) return "tsc";
  return null;
}
