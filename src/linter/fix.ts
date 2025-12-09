/**
 * Linter fix operations.
 */

import { existsSync } from "fs";
import { join } from "path";

import { commandExists, runCommand } from "./command.js";
import { runLinters } from "./runners.js";
import { CommandError, type FixResult, type LinterOptions } from "./types.js";

/**
 * Run linters with --fix flag to auto-fix violations.
 * Returns the number of fixes applied and any remaining violations.
 */
export async function runLintersFix(
  projectRoot: string,
  files: string[],
  options?: LinterOptions,
): Promise<FixResult> {
  const pythonFiles = files.filter(
    (f) => f.endsWith(".py") || f.endsWith(".pyi"),
  );
  const jsFiles = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f));

  const filesModified: string[] = [];
  let totalFixed = 0;

  // Run fixes (respecting disabled flags)
  if (pythonFiles.length > 0 && !options?.ruffDisabled) {
    const ruffResult = await runRuffFix(projectRoot, pythonFiles);
    totalFixed += ruffResult.fixedCount;
    filesModified.push(...ruffResult.filesModified);
  }

  if (jsFiles.length > 0 && !options?.eslintDisabled) {
    const eslintResult = await runESLintFix(projectRoot, jsFiles);
    totalFixed += eslintResult.fixedCount;
    filesModified.push(...eslintResult.filesModified);
  }

  // Re-run linters to get remaining violations (pass options to respect disabled flags)
  const remainingViolations = await runLinters(projectRoot, files, options);

  return {
    fixedCount: totalFixed,
    remainingViolations,
    filesModified: [...new Set(filesModified)], // Deduplicate
  };
}

async function countRuffViolations(
  projectRoot: string,
  absoluteFiles: string[],
): Promise<number> {
  try {
    const output = await runCommand(
      "ruff",
      ["check", "--output-format=json", ...absoluteFiles],
      projectRoot,
    );
    const results = JSON.parse(output) as unknown[];
    return results.length;
  } catch (error) {
    if (error instanceof CommandError && error.stdout) {
      try {
        const results = JSON.parse(error.stdout) as unknown[];
        return results.length;
      } catch {
        return 0;
      }
    }
    return 0;
  }
}

async function runRuffFix(
  projectRoot: string,
  files: string[],
): Promise<{ fixedCount: number; filesModified: string[] }> {
  const hasRuff = await commandExists("ruff");
  if (!hasRuff) {
    return { fixedCount: 0, filesModified: [] };
  }

  const absoluteFiles = files.map((f) => join(projectRoot, f));

  // Get violations count before fix
  const beforeCount = await countRuffViolations(projectRoot, absoluteFiles);

  // Run fix
  try {
    await runCommand("ruff", ["check", "--fix", ...absoluteFiles], projectRoot);
  } catch {
    // Ruff exits with non-zero if there are unfixable violations
  }

  // Get violations count after fix
  const afterCount = await countRuffViolations(projectRoot, absoluteFiles);

  const fixedCount = Math.max(0, beforeCount - afterCount);

  return {
    fixedCount,
    filesModified: fixedCount > 0 ? files : [],
  };
}

async function countESLintViolations(
  eslintBin: string,
  projectRoot: string,
  absoluteFiles: string[],
): Promise<number> {
  const args = [
    "--format=json",
    "--no-error-on-unmatched-pattern",
    "--no-ignore",
    "--no-warn-ignored",
    ...absoluteFiles,
  ];

  try {
    const output = await runCommand(eslintBin, args, projectRoot);
    const results = JSON.parse(output) as { messages?: unknown[] }[];
    return results.reduce((sum, r) => sum + (r.messages?.length ?? 0), 0);
  } catch (error) {
    if (error instanceof CommandError && error.stdout) {
      try {
        const results = JSON.parse(error.stdout) as { messages?: unknown[] }[];
        return results.reduce((sum, r) => sum + (r.messages?.length ?? 0), 0);
      } catch {
        return 0;
      }
    }
    return 0;
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

async function runESLintFix(
  projectRoot: string,
  files: string[],
): Promise<{ fixedCount: number; filesModified: string[] }> {
  const eslintBin = await findESLintBin(projectRoot);
  if (!eslintBin) {
    return { fixedCount: 0, filesModified: [] };
  }

  const absoluteFiles = files.map((f) => join(projectRoot, f));

  // Get violations count before fix
  const beforeCount = await countESLintViolations(
    eslintBin,
    projectRoot,
    absoluteFiles,
  );

  // Run fix
  try {
    await runCommand(
      eslintBin,
      [
        "--fix",
        "--no-error-on-unmatched-pattern",
        "--no-ignore",
        "--no-warn-ignored",
        ...absoluteFiles,
      ],
      projectRoot,
    );
  } catch {
    // ESLint exits with non-zero if there are unfixable violations
  }

  // Get violations count after fix
  const afterCount = await countESLintViolations(
    eslintBin,
    projectRoot,
    absoluteFiles,
  );

  const fixedCount = Math.max(0, beforeCount - afterCount);

  return {
    fixedCount,
    filesModified: fixedCount > 0 ? files : [],
  };
}
