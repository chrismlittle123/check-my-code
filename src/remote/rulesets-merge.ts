/**
 * Rule merging logic for remote config inheritance.
 */

import {
  type ESLintRuleValue,
  type RuffConfig,
  type TscConfig,
} from "../types.js";
import { deepEqual } from "../utils/deep-equal.js";
import {
  type InheritedRules,
  type LinterTool,
  RuleConflictError,
} from "./rulesets-types.js";

interface ConflictCheck {
  tool: LinterTool;
  rule: string;
  inheritedValue: unknown;
  localValue: unknown;
  source: string;
}

/** Check and throw conflict for a single option */
function throwIfConflict(c: ConflictCheck): void {
  if (
    c.inheritedValue !== undefined &&
    c.localValue !== undefined &&
    !deepEqual(c.inheritedValue, c.localValue)
  ) {
    throw new RuleConflictError(c);
  }
}

/**
 * Merge ESLint rules from inherited and local configs.
 * Throws RuleConflictError if a local rule conflicts with an inherited rule.
 */
export function mergeEslintRules(
  inherited: Record<string, ESLintRuleValue>,
  local: Record<string, ESLintRuleValue> | undefined,
  source: string,
): Record<string, ESLintRuleValue> {
  const merged = { ...inherited };
  if (!local) return merged;

  for (const [rule, localValue] of Object.entries(local)) {
    const inheritedValue = inherited[rule];
    throwIfConflict({
      tool: "eslint",
      rule,
      inheritedValue,
      localValue,
      source,
    });
    if (inheritedValue === undefined) merged[rule] = localValue;
  }

  return merged;
}

/**
 * Merge Ruff configs from inherited and local configs.
 */
export function mergeRuffConfig(
  inherited: RuffConfig,
  local: RuffConfig | undefined,
  source: string,
): RuffConfig {
  if (!local) return { ...inherited };

  // Check for conflicts
  throwIfConflict({
    tool: "ruff",
    rule: "line-length",
    inheritedValue: inherited["line-length"],
    localValue: local["line-length"],
    source,
  });
  throwIfConflict({
    tool: "ruff",
    rule: "lint.select",
    inheritedValue: inherited.lint?.select,
    localValue: local.lint?.select,
    source,
  });
  throwIfConflict({
    tool: "ruff",
    rule: "lint.ignore",
    inheritedValue: inherited.lint?.ignore,
    localValue: local.lint?.ignore,
    source,
  });

  // Build merged config
  return buildMergedRuffConfig(inherited, local);
}

function buildMergedRuffConfig(
  inherited: RuffConfig,
  local: RuffConfig,
): RuffConfig {
  const merged: RuffConfig = { ...inherited };
  if (local["line-length"] !== undefined)
    merged["line-length"] = local["line-length"];

  if (local.lint) {
    merged.lint = merged.lint ?? {};
    if (local.lint.select !== undefined) merged.lint.select = local.lint.select;
    if (local.lint.ignore !== undefined) merged.lint.ignore = local.lint.ignore;
  }
  return merged;
}

// TSC options to check
const TSC_OPTIONS = [
  "enabled",
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
] as const;

/**
 * Merge TSC configs from inherited and local configs.
 */
export function mergeTscConfig(
  inherited: TscConfig,
  local: TscConfig | undefined,
  source: string,
): TscConfig {
  if (!local) return { ...inherited };

  const merged: TscConfig = { ...inherited };

  for (const option of TSC_OPTIONS) {
    const localValue = local[option];
    const inheritedValue = inherited[option];

    if (localValue !== undefined) {
      throwIfConflict({
        tool: "tsc",
        rule: option,
        inheritedValue,
        localValue,
        source,
      });
      merged[option] = localValue;
    }
  }

  return merged;
}

interface LocalRulesets {
  eslint?: { rules?: Record<string, ESLintRuleValue> };
  ruff?: RuffConfig;
  tsc?: TscConfig;
}

interface MergedRulesets {
  eslint?: { rules: Record<string, ESLintRuleValue> };
  ruff?: RuffConfig;
  tsc?: TscConfig;
}

function mergeEslint(
  inherited: InheritedRules,
  local?: LocalRulesets,
): MergedRulesets["eslint"] {
  if (inherited.eslint) {
    return {
      rules: mergeEslintRules(
        inherited.eslint.rules,
        local?.eslint?.rules,
        inherited.eslint.source,
      ),
    };
  }
  return local?.eslint?.rules ? { rules: local.eslint.rules } : undefined;
}

function mergeRuff(
  inherited: InheritedRules,
  local?: LocalRulesets,
): RuffConfig | undefined {
  if (inherited.ruff)
    return mergeRuffConfig(
      inherited.ruff.config,
      local?.ruff,
      inherited.ruff.source,
    );
  return local?.ruff;
}

function mergeTsc(
  inherited: InheritedRules,
  local?: LocalRulesets,
): TscConfig | undefined {
  if (inherited.tsc)
    return mergeTscConfig(
      inherited.tsc.config,
      local?.tsc,
      inherited.tsc.source,
    );
  return local?.tsc;
}

/**
 * Merge inherited rules with local rulesets configuration.
 */
export function mergeRulesets(
  inherited: InheritedRules,
  localRulesets?: LocalRulesets,
): MergedRulesets {
  const eslint = mergeEslint(inherited, localRulesets);
  const ruff = mergeRuff(inherited, localRulesets);
  const tsc = mergeTsc(inherited, localRulesets);

  const merged: MergedRulesets = {};
  if (eslint) merged.eslint = eslint;
  if (ruff) merged.ruff = ruff;
  if (tsc) merged.tsc = tsc;

  return merged;
}
