import { spawn } from "child_process";
import { existsSync } from "fs";
import { join, relative } from "path";

import type { Violation } from "./types.js";

// Custom error class for linter runtime errors (exit code 3)
export class LinterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinterError";
  }
}

// Result type for fix operations
export interface FixResult {
  fixedCount: number;
  remainingViolations: Violation[];
  filesModified: string[];
}

// Options for running linters
export interface LinterOptions {
  tscEnabled?: boolean;
}

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
    const tscViolations = await runTsc(projectRoot);
    violations.push(...tscViolations);
  }

  return violations;
}

async function runRuff(
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
    if (error instanceof CommandError && error.stdout) {
      // Ruff exits with non-zero when it finds violations - parse the output
      const violations = parseRuffOutput(error.stdout, projectRoot);
      // If we got violations, that's the expected behavior
      if (violations.length > 0) {
        return violations;
      }
      // If no violations but exit code was non-zero, check for config errors
      // Ruff outputs config errors in stderr, not as JSON
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
}

async function runESLint(
  projectRoot: string,
  files: string[],
): Promise<Violation[]> {
  // Look for eslint in the project's node_modules or globally
  const localEslintPath = join(projectRoot, "node_modules", ".bin", "eslint");
  const hasLocalESLint = existsSync(localEslintPath);
  const hasGlobalESLint = await commandExists("eslint");

  if (!hasLocalESLint && !hasGlobalESLint) {
    console.error(
      "Warning: ESLint not found, skipping JavaScript/TypeScript file checks",
    );
    return [];
  }

  const eslintBin = hasLocalESLint ? localEslintPath : "eslint";
  const absoluteFiles = files.map((f) => join(projectRoot, f));

  // Use --no-ignore to check files even if they're in ignored paths
  // Use --no-warn-ignored to suppress warnings about ignored files
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
    if (error instanceof CommandError && error.stdout) {
      // ESLint exits with non-zero when it finds violations - try to parse the output
      // If the output is valid JSON with violations, return them
      const violations = parseESLintOutput(error.stdout, projectRoot);
      if (violations.length > 0) {
        return violations;
      }
      // Check if the output looks like valid JSON (empty results array)
      try {
        const parsed = JSON.parse(error.stdout);
        if (Array.isArray(parsed)) {
          // Valid JSON but no violations - this is fine
          return [];
        }
      } catch {
        // Not valid JSON - ESLint failed to run properly
      }
      // ESLint exited with error but didn't produce valid output
      throw new LinterError(
        `ESLint failed to run. This may indicate a configuration error.\n` +
          `Check your eslint.config.js and ensure all required packages are installed.\n` +
          `Exit code was non-zero but no valid lint output was produced.`,
      );
    }
    // Unknown error - likely a spawn error or ESLint crashed
    throw new LinterError(
      `ESLint failed to execute: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseRuffOutput(output: string, projectRoot: string): Violation[] {
  if (!output.trim()) return [];

  try {
    const results = JSON.parse(output) as {
      filename: string;
      location?: { row?: number; column?: number };
      code: string;
      message: string;
    }[];

    return results.map((r) => ({
      file: relative(projectRoot, r.filename),
      line: r.location?.row ?? null,
      column: r.location?.column ?? null,
      rule: r.code,
      message: r.message,
      linter: "ruff" as const,
    }));
  } catch {
    return [];
  }
}

function parseESLintOutput(output: string, projectRoot: string): Violation[] {
  if (!output.trim()) return [];

  try {
    const results = JSON.parse(output) as {
      filePath: string;
      messages?: {
        line?: number;
        column?: number;
        ruleId?: string;
        message: string;
      }[];
    }[];

    const violations: Violation[] = [];
    for (const file of results) {
      for (const msg of file.messages ?? []) {
        violations.push({
          file: relative(projectRoot, file.filePath),
          line: msg.line ?? null,
          column: msg.column ?? null,
          rule: msg.ruleId ?? "eslint",
          message: msg.message,
          linter: "eslint" as const,
        });
      }
    }
    return violations;
  } catch {
    return [];
  }
}

/**
 * Run TypeScript compiler for type checking only (no emit).
 * Uses the project's tsconfig.json directly.
 */
async function runTsc(projectRoot: string): Promise<Violation[]> {
  // Look for tsc in the project's node_modules or globally
  const localTscPath = join(projectRoot, "node_modules", ".bin", "tsc");
  const hasLocalTsc = existsSync(localTscPath);
  const hasGlobalTsc = await commandExists("tsc");

  if (!hasLocalTsc && !hasGlobalTsc) {
    console.error("Warning: TypeScript (tsc) not found, skipping type checks");
    return [];
  }

  // Check for tsconfig.json
  const projectTsconfigPath = join(projectRoot, "tsconfig.json");
  if (!existsSync(projectTsconfigPath)) {
    console.error("Warning: No tsconfig.json found, skipping type checks");
    return [];
  }

  const tscBin = hasLocalTsc ? localTscPath : "tsc";
  const args = ["--noEmit", "--pretty", "false"];

  try {
    const output = await runCommandWithStderr(tscBin, args, projectRoot);
    return parseTscOutput(output, projectRoot);
  } catch (error) {
    if (error instanceof CommandErrorWithStderr) {
      // tsc outputs errors to stdout, not stderr
      return parseTscOutput(error.stdout + error.stderr, projectRoot);
    }
    return [];
  }
}

/**
 * Parse TypeScript compiler output into violations.
 * tsc output format: file(line,col): error TSxxxx: message
 */
function parseTscOutput(output: string, projectRoot: string): Violation[] {
  if (!output.trim()) return [];

  const violations: Violation[] = [];
  const lines = output.split("\n");

  // Match: file(line,col): error TSxxxx: message
  // or: file(line,col): error: message (for some errors)
  const errorPattern = /^(.+?)\((\d+),(\d+)\):\s*(error)\s+(TS\d+)?:?\s*(.+)$/;

  for (const line of lines) {
    const match = errorPattern.exec(line);
    if (match) {
      const [, filePath, lineNum, colNum, , errorCode, message] = match;
      if (filePath && lineNum && colNum && message) {
        violations.push({
          file: relative(projectRoot, filePath),
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          rule: errorCode ?? "tsc",
          message: message.trim(),
          linter: "tsc" as const,
        });
      }
    }
  }

  return violations;
}

class CommandErrorWithStderr extends Error {
  stdout: string;
  stderr: string;
  constructor(message: string, stdout: string, stderr: string) {
    super(message);
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

function runCommandWithStderr(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn(cmd, args, { cwd });

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (err) =>
      reject(new Error(`Failed to run ${cmd}: ${err.message}`)),
    );
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new CommandErrorWithStderr(
            `${cmd} exited with code ${code}`,
            stdout,
            stderr,
          ),
        );
      }
    });
  });
}

async function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, ["--version"], { stdio: "ignore" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

class CommandError extends Error {
  stdout: string;
  constructor(message: string, stdout: string) {
    super(message);
    this.stdout = stdout;
  }
}

function runCommand(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let _stderr = "";

    const proc = spawn(cmd, args, { cwd });

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data: Buffer) => {
      _stderr += data.toString();
    });

    proc.on("error", (err) =>
      reject(new Error(`Failed to run ${cmd}: ${err.message}`)),
    );
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new CommandError(`${cmd} exited with code ${code}`, stdout));
      }
    });
  });
}

/**
 * Run linters with --fix flag to auto-fix violations.
 * Returns the number of fixes applied and any remaining violations.
 */
export async function runLintersFix(
  projectRoot: string,
  files: string[],
): Promise<FixResult> {
  const pythonFiles = files.filter(
    (f) => f.endsWith(".py") || f.endsWith(".pyi"),
  );
  const jsFiles = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f));

  const filesModified: string[] = [];
  let totalFixed = 0;

  // Run fixes
  if (pythonFiles.length > 0) {
    const ruffResult = await runRuffFix(projectRoot, pythonFiles);
    totalFixed += ruffResult.fixedCount;
    filesModified.push(...ruffResult.filesModified);
  }

  if (jsFiles.length > 0) {
    const eslintResult = await runESLintFix(projectRoot, jsFiles);
    totalFixed += eslintResult.fixedCount;
    filesModified.push(...eslintResult.filesModified);
  }

  // Re-run linters to get remaining violations
  const remainingViolations = await runLinters(projectRoot, files);

  return {
    fixedCount: totalFixed,
    remainingViolations,
    filesModified: [...new Set(filesModified)], // Deduplicate
  };
}

async function runRuffFix(
  projectRoot: string,
  files: string[],
): Promise<{ fixedCount: number; filesModified: string[] }> {
  const hasRuff = await commandExists("ruff");
  if (!hasRuff) {
    return { fixedCount: 0, filesModified: [] };
  }

  // First, get the violations count before fix
  const absoluteFiles = files.map((f) => join(projectRoot, f));
  let beforeCount = 0;

  try {
    const beforeOutput = await runCommand(
      "ruff",
      ["check", "--output-format=json", ...absoluteFiles],
      projectRoot,
    );
    const beforeResults = JSON.parse(beforeOutput) as unknown[];
    beforeCount = beforeResults.length;
  } catch (error) {
    if (error instanceof CommandError && error.stdout) {
      try {
        const beforeResults = JSON.parse(error.stdout) as unknown[];
        beforeCount = beforeResults.length;
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Run fix
  try {
    await runCommand("ruff", ["check", "--fix", ...absoluteFiles], projectRoot);
  } catch {
    // Ruff exits with non-zero if there are unfixable violations, which is expected
  }

  // Get violations count after fix
  let afterCount = 0;
  try {
    const afterOutput = await runCommand(
      "ruff",
      ["check", "--output-format=json", ...absoluteFiles],
      projectRoot,
    );
    const afterResults = JSON.parse(afterOutput) as unknown[];
    afterCount = afterResults.length;
  } catch (error) {
    if (error instanceof CommandError && error.stdout) {
      try {
        const afterResults = JSON.parse(error.stdout) as unknown[];
        afterCount = afterResults.length;
      } catch {
        // Ignore parse errors
      }
    }
  }

  const fixedCount = Math.max(0, beforeCount - afterCount);

  return {
    fixedCount,
    filesModified: fixedCount > 0 ? files : [],
  };
}

async function runESLintFix(
  projectRoot: string,
  files: string[],
): Promise<{ fixedCount: number; filesModified: string[] }> {
  const localEslintPath = join(projectRoot, "node_modules", ".bin", "eslint");
  const hasLocalESLint = existsSync(localEslintPath);
  const hasGlobalESLint = await commandExists("eslint");

  if (!hasLocalESLint && !hasGlobalESLint) {
    return { fixedCount: 0, filesModified: [] };
  }

  const eslintBin = hasLocalESLint ? localEslintPath : "eslint";
  const absoluteFiles = files.map((f) => join(projectRoot, f));

  // Get violations count before fix
  let beforeCount = 0;
  try {
    const beforeOutput = await runCommand(
      eslintBin,
      [
        "--format=json",
        "--no-error-on-unmatched-pattern",
        "--no-ignore",
        "--no-warn-ignored",
        ...absoluteFiles,
      ],
      projectRoot,
    );
    const beforeResults = JSON.parse(beforeOutput) as {
      messages?: unknown[];
    }[];
    beforeCount = beforeResults.reduce(
      (sum, r) => sum + (r.messages?.length ?? 0),
      0,
    );
  } catch (error) {
    if (error instanceof CommandError && error.stdout) {
      try {
        const beforeResults = JSON.parse(error.stdout) as {
          messages?: unknown[];
        }[];
        beforeCount = beforeResults.reduce(
          (sum, r) => sum + (r.messages?.length ?? 0),
          0,
        );
      } catch {
        // Ignore parse errors
      }
    }
  }

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
  let afterCount = 0;
  try {
    const afterOutput = await runCommand(
      eslintBin,
      [
        "--format=json",
        "--no-error-on-unmatched-pattern",
        "--no-ignore",
        "--no-warn-ignored",
        ...absoluteFiles,
      ],
      projectRoot,
    );
    const afterResults = JSON.parse(afterOutput) as { messages?: unknown[] }[];
    afterCount = afterResults.reduce(
      (sum, r) => sum + (r.messages?.length ?? 0),
      0,
    );
  } catch (error) {
    if (error instanceof CommandError && error.stdout) {
      try {
        const afterResults = JSON.parse(error.stdout) as {
          messages?: unknown[];
        }[];
        afterCount = afterResults.reduce(
          (sum, r) => sum + (r.messages?.length ?? 0),
          0,
        );
      } catch {
        // Ignore parse errors
      }
    }
  }

  const fixedCount = Math.max(0, beforeCount - afterCount);

  return {
    fixedCount,
    filesModified: fixedCount > 0 ? files : [],
  };
}
