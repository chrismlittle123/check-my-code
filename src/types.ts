// Tools configuration - enable/disable specific linters
export interface ToolsConfig {
  eslint?: boolean;
  ruff?: boolean;
  tsc?: boolean;
}

// Files configuration - control which files to check
export interface FilesConfig {
  include?: string[];
  exclude?: string[];
}

export interface Config {
  project: {
    name: string;
  };
  extends?: ExtendsConfig;
  tools?: ToolsConfig;
  files?: FilesConfig;
  prompts?: AiContextConfig;
  rulesets?: {
    eslint?: {
      rules?: Record<string, ESLintRuleValue>;
    };
    ruff?: RuffConfig;
    tsc?: TscConfig;
  };
}

// Remote config inheritance (v2)
// Format: github:owner/repo/path@version
export interface ExtendsConfig {
  eslint?: string;
  ruff?: string;
  tsc?: string;
}

// AI context configuration for `cmc context` command
export interface AiContextConfig {
  // Template names to load (e.g., ["typescript-strict", "python-prod"])
  templates: string[];
  // Optional: custom source repository (defaults to community repo)
  // Format: github:owner/repo/path@version
  source?: string;
}

// Default community repository for AI context templates
export const DEFAULT_AI_CONTEXT_SOURCE =
  "github:chrismlittle123/check-my-code-community/prompts@latest";

// Supported AI tool targets for context output
export type AiTarget = "claude" | "cursor" | "copilot";

// Map of AI targets to their config file paths
export const AI_TARGET_FILES: Record<AiTarget, string> = {
  claude: "CLAUDE.md",
  cursor: ".cursorrules",
  copilot: ".github/copilot-instructions.md",
};

// ESLint rule values can be: "off", "warn", "error", or array like ["error", "always"]
export type ESLintRuleValue = "off" | "warn" | "error" | [string, ...unknown[]];

// Ruff configuration matching ruff.toml structure
export interface RuffConfig {
  "line-length"?: number;
  lint?: {
    select?: string[];
    ignore?: string[];
  };
}

// TypeScript compiler configuration for type checking
// Defines required tsconfig.json settings - audited via `cmc audit tsc`
// When enabled, `cmc check` runs `tsc --noEmit` using the project's tsconfig.json
export interface TscConfig {
  enabled?: boolean;
  // Strict type-checking options
  strict?: boolean;
  noImplicitAny?: boolean;
  strictNullChecks?: boolean;
  strictFunctionTypes?: boolean;
  strictBindCallApply?: boolean;
  strictPropertyInitialization?: boolean;
  noImplicitThis?: boolean;
  alwaysStrict?: boolean;
  // Additional strictness
  noUncheckedIndexedAccess?: boolean;
  noImplicitReturns?: boolean;
  noFallthroughCasesInSwitch?: boolean;
  noUnusedLocals?: boolean;
  noUnusedParameters?: boolean;
  exactOptionalPropertyTypes?: boolean;
  noImplicitOverride?: boolean;
  // Permissive options (usually false for strict projects)
  allowUnusedLabels?: boolean;
  allowUnreachableCode?: boolean;
}

export interface Violation {
  file: string;
  line: number | null;
  column: number | null;
  rule: string;
  message: string;
  linter: "eslint" | "ruff" | "tsc";
}

export interface CheckResult {
  violations: Violation[];
  filesChecked: number;
}

// Exit codes as defined in PRD Section 6.4.2
export const ExitCode = {
  SUCCESS: 0, // No violations
  VIOLATIONS: 1, // Violations found
  CONFIG_ERROR: 2, // Configuration error (invalid cmc.toml, missing config)
  RUNTIME_ERROR: 3, // Runtime error (linter failed)
} as const;

// Type for exit code values (for internal use)
type _ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
