/**
 * Types and error classes for remote ruleset handling.
 */

import { z } from "zod";

import {
  type ESLintRuleValue,
  type RuffConfig,
  type TscConfig,
} from "../types.js";

// Linter tool types
export type LinterTool = "eslint" | "ruff" | "tsc";

// Rulesets manifest schema
const rulesetVersionSchema = z.union([
  z.object({ file: z.string() }),
  z.string(), // For "latest" pointing to a version
]);

const rulesetEntrySchema = z.object({
  tier: z.enum(["prototype", "internal", "production"]).optional(),
  description: z.string().optional(),
  tool: z.enum(["eslint", "ruff", "tsc"]),
  format: z.enum(["toml"]).optional(),
  versions: z.record(z.string(), rulesetVersionSchema),
});

export const rulesetsManifestSchema = z.object({
  schema_version: z.string(),
  rulesets: z.record(z.string(), rulesetEntrySchema),
});

export type RulesetsManifest = z.infer<typeof rulesetsManifestSchema>;
export type RulesetEntry = z.infer<typeof rulesetEntrySchema>;

// Resolved ruleset from remote
export interface ResolvedRuleset {
  source: string;
  tool: LinterTool;
  eslintRules?: Record<string, ESLintRuleValue>;
  ruffConfig?: RuffConfig;
  tscConfig?: TscConfig;
}

// Inherited rules structure
export interface InheritedRules {
  eslint?: {
    source: string;
    rules: Record<string, ESLintRuleValue>;
  };
  ruff?: {
    source: string;
    config: RuffConfig;
  };
  tsc?: {
    source: string;
    config: TscConfig;
  };
}

/** Parameters for rule conflict error */
interface ConflictParams {
  tool: LinterTool;
  rule: string;
  inheritedValue: unknown;
  localValue: unknown;
  source: string;
}

function buildConflictMessage(p: ConflictParams): string {
  const rulesetPath = p.tool === "eslint" ? `${p.tool}.rules` : p.tool;
  return (
    `Config conflict detected\n\n` +
    `  Setting: "${p.rule}" (${p.tool})\n` +
    `  Inherited value: ${JSON.stringify(p.inheritedValue)}\n` +
    `  Local value: ${JSON.stringify(p.localValue)}\n` +
    `  Source: ${p.source}\n\n` +
    `Local config cannot override inherited config.\n` +
    `To resolve: remove "${p.rule}" from local [rulesets.${rulesetPath}]`
  );
}

// Error for rule conflicts
export class RuleConflictError extends Error {
  public readonly tool: LinterTool;
  public readonly rule: string;
  public readonly inheritedValue: unknown;
  public readonly localValue: unknown;
  public readonly source: string;

  constructor(params: ConflictParams) {
    super(buildConflictMessage(params));
    this.name = "RuleConflictError";
    this.tool = params.tool;
    this.rule = params.rule;
    this.inheritedValue = params.inheritedValue;
    this.localValue = params.localValue;
    this.source = params.source;
  }
}

// Error for remote ruleset issues
export class RulesetFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RulesetFetchError";
  }
}
