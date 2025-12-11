/**
 * Type definitions for native code limits checking.
 */

/**
 * Configuration for code limits from cmc.toml [rulesets.limits]
 */
export interface LimitsConfig {
  max_file_lines?: number;
  max_function_lines?: number;
  max_parameters?: number;
  max_nesting_depth?: number;
}

/**
 * Limit violation rules
 */
export type LimitRule =
  | "limits/max-file-lines"
  | "limits/max-function-lines"
  | "limits/max-parameters"
  | "limits/max-nesting-depth";

/**
 * A violation of a code limit
 */
export interface LimitViolation {
  file: string;
  line: number;
  column: number;
  message: string;
  rule: LimitRule;
  functionName?: string;
}

/**
 * Information about a function/method extracted from AST
 */
export interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  lineCount: number;
  parameterCount: number;
  maxNestingDepth: number;
}

/**
 * Analysis result for a single file
 */
export interface FileAnalysis {
  filePath: string;
  totalLines: number;
  functions: FunctionInfo[];
}

/**
 * Error thrown when limits analysis fails
 */
export class LimitsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitsError";
  }
}
