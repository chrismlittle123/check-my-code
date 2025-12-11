/**
 * Native code limits checking module.
 * Checks file and function limits for Python and TypeScript files.
 */

import path from "path";

import type { Config, Violation } from "../types.js";
import { analyzePythonFiles, isPythonAvailable } from "./python.js";
import {
  type FileAnalysis,
  type LimitsConfig,
  type LimitViolation,
} from "./types.js";
import { analyzeTypeScriptFiles } from "./typescript.js";

// Re-export types
export type {
  FileAnalysis,
  FunctionInfo,
  LimitsConfig,
  LimitViolation,
} from "./types.js";
export { LimitsError } from "./types.js";

// File extension patterns
const PYTHON_EXTENSIONS = [".py", ".pyi"];
const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

/**
 * Check if config has limits configured
 */
export function hasLimitsConfig(config: Config): boolean {
  const limits = config.rulesets?.limits;
  if (!limits) return false;

  return (
    limits.max_file_lines !== undefined ||
    limits.max_function_lines !== undefined ||
    limits.max_parameters !== undefined ||
    limits.max_nesting_depth !== undefined
  );
}

/**
 * Get the file extension for a file path
 */
function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  return lastDot >= 0 ? filePath.slice(lastDot) : "";
}

/**
 * Categorize files by language
 */
function categorizeFiles(files: string[]): {
  pythonFiles: string[];
  tsFiles: string[];
} {
  const pythonFiles: string[] = [];
  const tsFiles: string[] = [];

  for (const file of files) {
    const ext = getExtension(file);
    if (PYTHON_EXTENSIONS.includes(ext)) {
      pythonFiles.push(file);
    } else if (TYPESCRIPT_EXTENSIONS.includes(ext)) {
      tsFiles.push(file);
    }
  }

  return { pythonFiles, tsFiles };
}

/**
 * Check file-level limits (max file lines)
 */
function checkFileLevelLimits(
  analysis: FileAnalysis,
  limits: LimitsConfig,
): LimitViolation[] {
  if (
    limits.max_file_lines === undefined ||
    analysis.totalLines <= limits.max_file_lines
  ) {
    return [];
  }

  return [
    {
      file: analysis.filePath,
      line: 1,
      column: 1,
      message: `File has ${analysis.totalLines} lines (max: ${limits.max_file_lines})`,
      rule: "limits/max-file-lines" as const,
    },
  ];
}

/**
 * Check function-level limits for a single function
 */
function checkFunctionLimits(
  filePath: string,
  func: FileAnalysis["functions"][0],
  limits: LimitsConfig,
): LimitViolation[] {
  const violations: LimitViolation[] = [];

  if (
    limits.max_function_lines !== undefined &&
    func.lineCount > limits.max_function_lines
  ) {
    violations.push({
      file: filePath,
      line: func.startLine,
      column: 1,
      message: `Function '${func.name}' has ${func.lineCount} lines (max: ${limits.max_function_lines})`,
      rule: "limits/max-function-lines",
      functionName: func.name,
    });
  }

  if (
    limits.max_parameters !== undefined &&
    func.parameterCount > limits.max_parameters
  ) {
    violations.push({
      file: filePath,
      line: func.startLine,
      column: 1,
      message: `Function '${func.name}' has ${func.parameterCount} parameters (max: ${limits.max_parameters})`,
      rule: "limits/max-parameters",
      functionName: func.name,
    });
  }

  if (
    limits.max_nesting_depth !== undefined &&
    func.maxNestingDepth > limits.max_nesting_depth
  ) {
    violations.push({
      file: filePath,
      line: func.startLine,
      column: 1,
      message: `Function '${func.name}' has nesting depth ${func.maxNestingDepth} (max: ${limits.max_nesting_depth})`,
      rule: "limits/max-nesting-depth",
      functionName: func.name,
    });
  }

  return violations;
}

/**
 * Check a file analysis against limits configuration
 */
function checkFileAgainstLimits(
  analysis: FileAnalysis,
  limits: LimitsConfig,
): LimitViolation[] {
  const violations: LimitViolation[] = [];

  violations.push(...checkFileLevelLimits(analysis, limits));

  for (const func of analysis.functions) {
    violations.push(...checkFunctionLimits(analysis.filePath, func, limits));
  }

  return violations;
}

/**
 * Convert absolute path to relative path (cross-platform)
 */
function toRelativePath(filePath: string, projectRoot: string): string {
  return path.isAbsolute(filePath)
    ? path.relative(projectRoot, filePath)
    : filePath;
}

/**
 * Convert relative path to absolute path (cross-platform)
 */
function toAbsolutePath(filePath: string, projectRoot: string): string {
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(projectRoot, filePath);
}

/**
 * Analyze Python files and check against limits
 */
function checkPythonFiles(
  pythonFiles: string[],
  projectRoot: string,
  limits: LimitsConfig,
): LimitViolation[] {
  if (pythonFiles.length === 0) return [];

  if (!isPythonAvailable()) {
    console.warn(
      "Warning: Python 3 not found. Skipping limits check for .py files.",
    );
    return [];
  }

  const absolutePaths = pythonFiles.map((f) => toAbsolutePath(f, projectRoot));
  const analyses = analyzePythonFiles(absolutePaths);

  return analyses.flatMap((analysis) =>
    checkFileAgainstLimits(
      { ...analysis, filePath: toRelativePath(analysis.filePath, projectRoot) },
      limits,
    ),
  );
}

/**
 * Analyze TypeScript files and check against limits
 */
function checkTypeScriptFiles(
  tsFiles: string[],
  projectRoot: string,
  limits: LimitsConfig,
): LimitViolation[] {
  if (tsFiles.length === 0) return [];

  const absolutePaths = tsFiles.map((f) => toAbsolutePath(f, projectRoot));
  const analyses = analyzeTypeScriptFiles(absolutePaths);

  return analyses.flatMap((analysis) =>
    checkFileAgainstLimits(
      { ...analysis, filePath: toRelativePath(analysis.filePath, projectRoot) },
      limits,
    ),
  );
}

/**
 * Check files against code limits.
 * @param projectRoot Project root directory
 * @param files Array of relative file paths to check
 * @param limits Limits configuration
 * @returns Array of limit violations
 */
export function checkLimits(
  projectRoot: string,
  files: string[],
  limits: LimitsConfig,
): LimitViolation[] {
  const { pythonFiles, tsFiles } = categorizeFiles(files);

  const pythonViolations = checkPythonFiles(pythonFiles, projectRoot, limits);
  const tsViolations = checkTypeScriptFiles(tsFiles, projectRoot, limits);

  return [...pythonViolations, ...tsViolations];
}

/**
 * Convert limit violations to the standard Violation format
 */
export function limitsViolationsToViolations(
  limitViolations: LimitViolation[],
): Violation[] {
  return limitViolations.map((lv) => ({
    file: lv.file,
    line: lv.line,
    column: lv.column,
    rule: lv.rule,
    message: lv.message,
    linter: "limits" as const,
  }));
}
