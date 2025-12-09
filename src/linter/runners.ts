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

interface FilteredFiles {
  python: string[];
  typescript: string[];
  javascript: string[];
}

function filterFiles(files: string[]): FilteredFiles {
  return {
    python: files.filter((f) => f.endsWith(".py") || f.endsWith(".pyi")),
    typescript: files.filter((f) => /\.(ts|tsx)$/.test(f)),
    javascript: files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f)),
  };
}

/**
 * Count the number of files that will actually be linted.
 * Excludes files with unrecognized extensions.
 */
export function countLintableFiles(
  files: string[],
  options?: LinterOptions,
): number {
  const filtered = filterFiles(files);

  // Use a Set to avoid double-counting files that match multiple categories
  // (e.g., .ts files are in both typescript and javascript)
  const lintableFiles = new Set<string>();

  // Python files (if ruff not disabled)
  if (!options?.ruffDisabled) {
    filtered.python.forEach((f) => lintableFiles.add(f));
  }

  // JavaScript/TypeScript files (if eslint not disabled)
  if (!options?.eslintDisabled) {
    filtered.javascript.forEach((f) => lintableFiles.add(f));
  }

  // TypeScript files for tsc (if tsc enabled)
  if (options?.tscEnabled) {
    filtered.typescript.forEach((f) => lintableFiles.add(f));
  }

  return lintableFiles.size;
}

async function runRuffIfEnabled(
  projectRoot: string,
  files: string[],
  options?: LinterOptions,
): Promise<Violation[]> {
  if (files.length === 0 || options?.ruffDisabled) return [];
  return runRuff(projectRoot, files, options?.quiet ?? false);
}

async function runESLintIfEnabled(
  projectRoot: string,
  files: string[],
  options?: LinterOptions,
): Promise<Violation[]> {
  if (files.length === 0 || options?.eslintDisabled) return [];
  return runESLint(projectRoot, files, options?.quiet ?? false);
}

async function runTscIfEnabled(
  projectRoot: string,
  files: string[],
  options?: LinterOptions,
): Promise<Violation[]> {
  if (files.length === 0 || !options?.tscEnabled) return [];
  return runTsc(projectRoot, files, options?.quiet ?? false);
}

export async function runLinters(
  projectRoot: string,
  files: string[],
  options?: LinterOptions,
): Promise<Violation[]> {
  const filtered = filterFiles(files);

  const results = await Promise.all([
    runRuffIfEnabled(projectRoot, filtered.python, options),
    runESLintIfEnabled(projectRoot, filtered.javascript, options),
    runTscIfEnabled(projectRoot, filtered.typescript, options),
  ]);

  return results.flat();
}

export async function runRuff(
  projectRoot: string,
  files: string[],
  quiet = false,
): Promise<Violation[]> {
  const hasRuff = await commandExists("ruff");
  if (!hasRuff) {
    if (!quiet) {
      console.error("Warning: Ruff not found, skipping Python file checks");
    }
    return [];
  }

  const absoluteFiles = files.map((f) => join(projectRoot, f));
  const args = ["check", "--output-format=json", ...absoluteFiles];

  try {
    const output = await runCommand("ruff", args, projectRoot);
    const result = parseRuffOutput(output, projectRoot);
    if (result.parseError) {
      throw new LinterError(result.parseError);
    }
    return result.violations;
  } catch (error) {
    if (error instanceof LinterError) throw error;
    return handleRuffError(error, projectRoot);
  }
}

function handleRuffError(error: unknown, projectRoot: string): Violation[] {
  if (error instanceof CommandError && error.stdout) {
    // Ruff exits with non-zero when it finds violations - parse the output
    const result = parseRuffOutput(error.stdout, projectRoot);
    if (result.parseError) {
      throw new LinterError(result.parseError);
    }
    if (result.violations.length > 0) {
      return result.violations;
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
  quiet = false,
): Promise<Violation[]> {
  const eslintBin = await findESLintBin(projectRoot);
  if (!eslintBin) {
    if (!quiet) {
      console.error(
        "Warning: ESLint not found, skipping JavaScript/TypeScript file checks",
      );
    }
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
    const result = parseESLintOutput(output, projectRoot);
    if (result.parseError) {
      throw new LinterError(result.parseError);
    }
    return result.violations;
  } catch (error) {
    if (error instanceof LinterError) throw error;
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
    const result = parseESLintOutput(error.stdout, projectRoot);
    if (result.parseError) {
      throw new LinterError(result.parseError);
    }
    // Return violations if any were found, or empty array if output was valid JSON
    // ESLint may exit non-zero for warnings-only cases with valid empty output
    return result.violations;
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
 * @param quiet - Suppress warning messages
 */
export async function runTsc(
  projectRoot: string,
  files?: string[],
  quiet = false,
): Promise<Violation[]> {
  const tscBin = await findTscBin(projectRoot);
  if (!tscBin) {
    if (!quiet) {
      console.error(
        "Warning: TypeScript (tsc) not found, skipping type checks",
      );
    }
    return [];
  }

  if (!existsSync(join(projectRoot, "tsconfig.json"))) {
    if (!quiet) {
      console.error("Warning: No tsconfig.json found, skipping type checks");
    }
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
