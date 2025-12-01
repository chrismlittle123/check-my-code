export interface Config {
  project: {
    name: string;
  };
  rulesets?: {
    eslint?: {
      rules?: Record<string, ESLintRuleValue>;
    };
    ruff?: RuffConfig;
  };
}

// ESLint rule values can be: "off", "warn", "error", or array like ["error", "always"]
export type ESLintRuleValue = 'off' | 'warn' | 'error' | [string, ...unknown[]];

// Ruff configuration matching ruff.toml structure
export interface RuffConfig {
  'line-length'?: number;
  lint?: {
    select?: string[];
    ignore?: string[];
  };
}

export interface Violation {
  file: string;
  line: number | null;
  column: number | null;
  rule: string;
  message: string;
  linter: 'eslint' | 'ruff';
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

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
