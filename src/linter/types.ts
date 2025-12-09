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
export interface LinterOptions {
  /** Enable TypeScript type checking */
  tscEnabled?: boolean;
  /** Suppress warning messages (e.g., when linters are not found) */
  quiet?: boolean;
  /** Disable ESLint */
  eslintDisabled?: boolean;
  /** Disable Ruff */
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
