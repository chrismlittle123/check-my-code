export interface CheckOptions {
  paths?: string[];
  all?: boolean;
  ai?: boolean;
  cache?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  json?: boolean;
  config?: string;
}

export interface Violation {
  file: string;
  line: number | null;
  column: number | null;
  rule: string;
  message: string;
  ruleset?: string;
}

export interface CheckResult {
  violations: Violation[];
  filesChecked: number;
  filesCached: number;
  durationMs: number;
}

export interface FileCheckResult {
  file: string;
  hash: string;
  violations: Violation[];
  checkedAt: string;
}

export interface RunnerResult {
  violations: Violation[];
  fileResults: Map<string, FileCheckResult>;
}

export interface ProjectConfig {
  projectRoot: string;
  project: {
    name: string;
    category: string;
  };
  rulesets: {
    default?: string[];
    [language: string]:
      | {
          paths?: string[];
          rules?: string[];
        }
      | string[]
      | undefined;
  };
  ai?: {
    enabled: boolean;
  };
  agents?: {
    supported?: string[];
  };
}

export interface RulesetConfig {
  meta: {
    name: string;
    version: string;
    description?: string;
    languages?: string[];
    extends?: string[];
  };
  rules: Record<string, RuleConfig>;
}

export interface RuleConfig {
  type: 'simple' | 'linter' | 'script' | 'ai';
  check?: string;
  message: string;
  // Simple check params
  max?: number;
  scope?: string;
  // Linter params
  linter?: string;
  config?: Record<string, unknown>;
  // Script params
  command?: string;
  // AI params
  prompt?: string;
  extractor?: string;
}

export interface StateData {
  last_check: string;
  files: Record<
    string,
    {
      hash: string;
      checked_at: string;
      violations: Array<{
        rule: string;
        line: number | null;
        message: string;
      }>;
    }
  >;
  ruleset_versions: Record<string, string>;
}
