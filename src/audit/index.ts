/**
 * Core audit functionality for verifying linter configs match cmc.toml.
 * This module is used by both the audit command and the check command.
 */

import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import stripJsonComments from "strip-json-comments";

import { type Config, type RuffConfig, type TscConfig } from "../types.js";
import { deepEqual } from "../utils/deep-equal.js";
import {
  compareESLintRules,
  extractESLintRules,
  type Mismatch,
} from "./eslint.js";

export type { Mismatch } from "./eslint.js";

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

export interface VerifyResult {
  linter: LinterTarget;
  filename: string;
  matches: boolean;
  mismatches: Mismatch[];
}

/** Result of checking if config files exist and match cmc.toml */
export interface AuditCheckResult {
  /** Config files that don't exist but are required by cmc.toml rulesets */
  missingConfigs: { linter: LinterTarget; filename: string }[];
  /** Config files that exist but don't match cmc.toml rulesets */
  mismatchedConfigs: VerifyResult[];
}

export class LinterConfigNotFoundError extends Error {
  constructor(filename: string) {
    super(`Linter config file not found: ${filename}`);
    this.name = "LinterConfigNotFoundError";
  }
}

// TypeScript compiler options to check
const TSC_OPTIONS: (keyof TscConfig)[] = [
  "strict",
  "noImplicitAny",
  "strictNullChecks",
  "strictFunctionTypes",
  "strictBindCallApply",
  "strictPropertyInitialization",
  "noImplicitThis",
  "alwaysStrict",
  "noUncheckedIndexedAccess",
  "noImplicitReturns",
  "noFallthroughCasesInSwitch",
  "noUnusedLocals",
  "noUnusedParameters",
  "exactOptionalPropertyTypes",
  "noImplicitOverride",
  "allowUnusedLabels",
  "allowUnreachableCode",
];

/** Check if ruleset is defined for target */
export function isRulesetDefined(
  config: Config,
  target: LinterTarget,
): boolean {
  if (target === "eslint") return !!config.rulesets?.eslint?.rules;
  if (target === "ruff") return !!config.rulesets?.ruff;
  return !!config.rulesets?.tsc;
}

/**
 * Perform a quick audit check to see if config files exist and match cmc.toml.
 * This is used by `cmc check` to warn users when configs are out of sync.
 * Unlike the full audit, this doesn't throw on missing configs - it reports them.
 */
export async function quickAuditCheck(
  projectRoot: string,
  config: Config,
): Promise<AuditCheckResult> {
  const missingConfigs: AuditCheckResult["missingConfigs"] = [];

  // Check which linters have rulesets and existing configs
  const lintersToVerify: LinterTarget[] = [];
  for (const target of SUPPORTED_LINTERS) {
    if (!isRulesetDefined(config, target)) {
      continue;
    }

    const filename = LINTER_CONFIGS[target];
    const configPath = join(projectRoot, filename);

    if (!existsSync(configPath)) {
      missingConfigs.push({ linter: target, filename });
    } else {
      lintersToVerify.push(target);
    }
  }

  // Verify all configs in parallel
  const verifyResults = await Promise.all(
    lintersToVerify.map(async (target) => {
      try {
        return await verifyLinterConfig(projectRoot, config, target);
      } catch {
        // Ignore parse errors during quick check - they'll be caught during linting
        return null;
      }
    }),
  );

  const mismatchedConfigs = verifyResults.filter(
    (r): r is VerifyResult => r !== null && !r.matches,
  );

  return { missingConfigs, mismatchedConfigs };
}

/**
 * Verify a single linter config against cmc.toml.
 * Returns null if no ruleset is defined for this linter.
 * Throws LinterConfigNotFoundError if config file doesn't exist.
 */
export async function verifyLinterConfig(
  projectRoot: string,
  config: Config,
  target: LinterTarget,
): Promise<VerifyResult | null> {
  const filename = LINTER_CONFIGS[target];
  const configPath = join(projectRoot, filename);

  if (!isRulesetDefined(config, target)) {
    return null;
  }

  if (!existsSync(configPath)) {
    throw new LinterConfigNotFoundError(filename);
  }

  const verifiers = {
    eslint: verifyESLintConfig,
    ruff: verifyRuffConfig,
    tsc: verifyTscConfig,
  };

  return verifiers[target](projectRoot, config, filename);
}

async function verifyESLintConfig(
  projectRoot: string,
  config: Config,
  filename: string,
): Promise<VerifyResult> {
  const configPath = join(projectRoot, filename);
  const content = await readFile(configPath, "utf-8");

  const expectedRules = config.rulesets?.eslint?.rules ?? {};
  const actualRules = extractESLintRules(content);

  const mismatches = compareESLintRules(expectedRules, actualRules);

  return {
    linter: "eslint",
    filename,
    matches: mismatches.length === 0,
    mismatches,
  };
}

async function verifyRuffConfig(
  projectRoot: string,
  config: Config,
  filename: string,
): Promise<VerifyResult> {
  const configPath = join(projectRoot, filename);
  const content = await readFile(configPath, "utf-8");

  const TOML = await import("@iarna/toml");
  let actualConfig: RuffConfig;
  try {
    actualConfig = TOML.parse(content) as RuffConfig;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Parse error";
    throw new Error(`Failed to parse ${filename}: ${msg}`);
  }

  const expectedConfig = config.rulesets?.ruff ?? {};
  const mismatches = compareRuffConfig(expectedConfig, actualConfig);

  return {
    linter: "ruff",
    filename,
    matches: mismatches.length === 0,
    mismatches,
  };
}

/** Compare Ruff configurations */
function compareRuffConfig(
  expected: RuffConfig,
  actual: RuffConfig,
): Mismatch[] {
  const mismatches: Mismatch[] = [];

  compareOption(
    mismatches,
    "line-length",
    expected["line-length"],
    actual["line-length"],
  );
  compareOption(
    mismatches,
    "select",
    expected.lint?.select,
    actual.lint?.select,
  );
  compareOption(
    mismatches,
    "ignore",
    expected.lint?.ignore,
    actual.lint?.ignore,
  );

  return mismatches;
}

async function verifyTscConfig(
  projectRoot: string,
  config: Config,
  filename: string,
): Promise<VerifyResult> {
  const configPath = join(projectRoot, filename);
  const content = await readFile(configPath, "utf-8");

  const actualConfig = parseTscConfig(content, filename);
  const expectedConfig = config.rulesets?.tsc ?? {};
  const actualCompilerOptions = actualConfig.compilerOptions ?? {};

  const mismatches = compareTscOptions(expectedConfig, actualCompilerOptions);

  return {
    linter: "tsc",
    filename,
    matches: mismatches.length === 0,
    mismatches,
  };
}

/** Parse tsconfig.json content (supports JSONC with comments and trailing commas) */
function parseTscConfig(
  content: string,
  filename: string,
): { compilerOptions?: Record<string, unknown> } {
  try {
    // Strip JSON comments and trailing commas before parsing (tsconfig.json supports JSONC)
    const sanitized = stripJsonComments(content, { trailingCommas: true });
    return JSON.parse(sanitized);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Parse error";
    throw new Error(`Failed to parse ${filename}: ${msg}`);
  }
}

/** Compare TSC compiler options */
function compareTscOptions(
  expected: TscConfig,
  actual: Record<string, unknown>,
): Mismatch[] {
  const mismatches: Mismatch[] = [];

  for (const option of TSC_OPTIONS) {
    const expectedVal = expected[option];
    const actualVal = actual[option];

    if (expectedVal === undefined) continue;

    if (actualVal === undefined) {
      mismatches.push({ type: "missing", rule: option, expected: expectedVal });
    } else if (!deepEqual(expectedVal, actualVal)) {
      mismatches.push({
        type: "different",
        rule: option,
        expected: expectedVal,
        actual: actualVal,
      });
    }
  }

  return mismatches;
}

/** Compare a single config option and add mismatches if found.
 * Only reports missing or different values - extra options in actual are allowed.
 * This is consistent with ESLint behavior which allows additional rules.
 */
function compareOption(
  mismatches: Mismatch[],
  rule: string,
  expected: unknown,
  actual: unknown,
): void {
  if (expected === undefined) {
    // If expected is not defined in cmc.toml, we don't care what actual has
    return;
  }

  if (actual === undefined) {
    mismatches.push({ type: "missing", rule, expected });
  } else if (!deepEqual(expected, actual)) {
    mismatches.push({ type: "different", rule, expected, actual });
  }
}
