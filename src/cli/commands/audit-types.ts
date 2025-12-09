/**
 * Shared types for the audit command.
 */

/** Map of linter targets to their config filenames - single source of truth */
export const LINTER_CONFIGS = {
  eslint: "eslint.config.js",
  ruff: "ruff.toml",
  tsc: "tsconfig.json",
} as const;

/** Valid linter targets derived from LINTER_CONFIGS */
export type LinterTarget = keyof typeof LINTER_CONFIGS;

/** All supported linter targets as an array */
export const SUPPORTED_LINTERS = Object.keys(LINTER_CONFIGS) as LinterTarget[];

export interface Mismatch {
  type: "missing" | "different" | "extra";
  rule: string;
  expected?: unknown;
  actual?: unknown;
}

export interface VerifyResult {
  linter: LinterTarget;
  filename: string;
  matches: boolean;
  mismatches: Mismatch[];
}
