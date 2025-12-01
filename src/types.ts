export interface Config {
  project: {
    name: string;
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
