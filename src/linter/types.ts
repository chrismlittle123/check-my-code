/**
 * Type definitions for linter module.
 */

import { type Violation } from "../types.js";

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
// Note: eslint/ruff use "disabled" flags because they're enabled by default.
// tsc uses "enabled" flag because it's disabled by default (requires explicit config).
export interface LinterOptions {
  /** Enable TypeScript type checking (disabled by default, requires [rulesets.tsc] config) */
  tscEnabled?: boolean;
  /** Suppress warning messages (e.g., when linters are not found) */
  quiet?: boolean;
  /** Disable ESLint (enabled by default) */
  eslintDisabled?: boolean;
  /** Disable Ruff (enabled by default) */
  ruffDisabled?: boolean;
}

// Internal error types for command execution
export class CommandError extends Error {
  stdout: string;
  constructor(message: string, stdout: string) {
    super(message);
    this.stdout = stdout;
  }
}

export class CommandErrorWithStderr extends Error {
  stdout: string;
  stderr: string;
  constructor(message: string, stdout: string, stderr: string) {
    super(message);
    this.stdout = stdout;
    this.stderr = stderr;
  }
}
