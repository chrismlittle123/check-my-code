/**
 * Type definitions for registry commands.
 */

export interface VersionEntry {
  file: string;
}

export interface PromptEntry {
  tier: "prototype" | "internal" | "production";
  description: string;
  format: string;
  language_version: string;
  runtime_version?: string;
  versions: Record<string, string | VersionEntry>;
}

export interface RulesetEntry {
  tier: "prototype" | "internal" | "production";
  description: string;
  tool: string;
  format: string;
  target_version?: string;
  language_version?: string;
  runtime_version?: string;
  versions: Record<string, string | VersionEntry>;
}

export interface PromptsRegistry {
  schema_version: string;
  prompts: Record<string, PromptEntry>;
}

export interface RulesetsRegistry {
  schema_version: string;
  rulesets: Record<string, RulesetEntry>;
}

export type RegistryType = "prompts" | "rulesets";

export type RegistryEntries = Record<string, PromptEntry | RulesetEntry>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
