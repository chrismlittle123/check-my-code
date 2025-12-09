/**
 * Shared types for the audit command.
 */

export type LinterTarget = "eslint" | "ruff" | "tsc";

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

export const LINTER_CONFIGS: Record<LinterTarget, string> = {
  eslint: "eslint.config.js",
  ruff: "ruff.toml",
  tsc: "tsconfig.json",
};
