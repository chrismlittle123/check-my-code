/**
 * Centralized output utilities for colored terminal output.
 *
 * Features:
 * - Color formatting functions (red, green, yellow, cyan, dim)
 * - TTY detection to disable colors when output is piped
 * - Respects NO_COLOR environment variable (https://no-color.org/)
 * - Respects FORCE_COLOR environment variable to force colors
 */

// ANSI color codes
const CODES = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[90m",
  reset: "\x1b[0m",
} as const;

/**
 * Determines if colors should be enabled based on:
 * 1. FORCE_COLOR env var (forces colors on)
 * 2. NO_COLOR env var (forces colors off)
 * 3. TTY detection (colors on if stdout is a TTY)
 */
function shouldUseColors(): boolean {
  // FORCE_COLOR takes highest priority
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== "") {
    return true;
  }

  // NO_COLOR disables colors (any value counts)
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }

  // Default to TTY detection
  return process.stdout.isTTY === true;
}

/**
 * Creates a color function that wraps text with ANSI codes when colors are enabled.
 */
function createColorFn(code: string): (text: string) => string {
  return (text: string): string => {
    if (!shouldUseColors()) {
      return text;
    }
    return `${code}${text}${CODES.reset}`;
  };
}

/**
 * Color formatting functions for terminal output.
 * Each function wraps text with the appropriate ANSI color code.
 * Colors are automatically disabled when:
 * - Output is piped (not a TTY)
 * - NO_COLOR environment variable is set
 */
export const colors = {
  /** Red - for errors, violations */
  red: createColorFn(CODES.red),
  /** Green - for success messages */
  green: createColorFn(CODES.green),
  /** Yellow - for warnings */
  yellow: createColorFn(CODES.yellow),
  /** Cyan - for file paths */
  cyan: createColorFn(CODES.cyan),
  /** Dim/gray - for linter/rule names */
  dim: createColorFn(CODES.dim),
} as const;

/**
 * Check if colors are currently enabled.
 * Useful for testing or conditional logic.
 */
export function colorsEnabled(): boolean {
  return shouldUseColors();
}
