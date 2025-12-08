import { Command } from "commander";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";

import {
  ConfigError,
  findProjectRoot,
  loadConfig,
} from "../../config/loader.js";
import {
  type Config,
  type ESLintRuleValue,
  ExitCode,
  type RuffConfig,
  type TscConfig,
} from "../../types.js";
import { deepEqual } from "../../utils/deep-equal.js";
import { colors } from "../output.js";

type LinterTarget = "eslint" | "ruff" | "tsc";

interface Mismatch {
  type: "missing" | "different" | "extra";
  rule: string;
  expected?: unknown;
  actual?: unknown;
}

interface VerifyResult {
  linter: LinterTarget;
  filename: string;
  matches: boolean;
  mismatches: Mismatch[];
}

const LINTER_CONFIGS: Record<LinterTarget, string> = {
  eslint: "eslint.config.js",
  ruff: "ruff.toml",
  tsc: "tsconfig.json",
};

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

export const auditCommand = new Command("audit")
  .description(
    "Check that linter config files match the ruleset defined in cmc.toml",
  )
  .argument(
    "[linter]",
    "Linter to audit (eslint, ruff, tsc). If omitted, audits all.",
  )
  .addHelpText(
    "after",
    `
Examples:
  $ cmc audit           Audit all linter configs
  $ cmc audit eslint    Audit only ESLint config
  $ cmc audit ruff      Audit only Ruff config
  $ cmc audit tsc       Audit only TypeScript config

Use in CI to ensure configs haven't drifted from cmc.toml.`,
  )
  .action(async (linter?: string) => {
    try {
      await runAudit(linter);
    } catch (error) {
      handleAuditError(error);
    }
  });

/** Main audit logic */
async function runAudit(linter?: string): Promise<void> {
  const projectRoot = findProjectRoot();
  const config = await loadConfig(projectRoot);

  const targets = linter
    ? [validateLinterTarget(linter)]
    : (["eslint", "ruff", "tsc"] as LinterTarget[]);

  const allResults = await Promise.all(
    targets.map((target) => verifyLinterConfig(projectRoot, config, target)),
  );
  const results = allResults.filter((r): r is VerifyResult => r !== null);

  if (results.length === 0) {
    console.log("No linter configs to audit (no rulesets defined in cmc.toml)");
    process.exit(ExitCode.SUCCESS);
  }

  outputResults(results);
  const hasErrors = results.some((r) => !r.matches);
  process.exit(hasErrors ? ExitCode.VIOLATIONS : ExitCode.SUCCESS);
}

/** Output audit results */
function outputResults(results: VerifyResult[]): void {
  for (const result of results) {
    if (result.matches) {
      console.log(
        colors.green(`✓ ${result.filename} matches cmc.toml ruleset`),
      );
    } else {
      console.log(colors.red(`✗ ${result.filename} has mismatches:`));
      for (const mismatch of result.mismatches) {
        console.log(formatMismatch(mismatch));
      }
    }
  }
}

/** Handle audit errors */
function handleAuditError(error: unknown): void {
  if (error instanceof ConfigError) {
    console.error(colors.red(`Error: ${error.message}`));
    process.exit(ExitCode.CONFIG_ERROR);
  }
  if (error instanceof LinterConfigNotFoundError) {
    console.error(colors.red(`Error: ${error.message}`));
    process.exit(ExitCode.RUNTIME_ERROR);
  }
  console.error(
    colors.red(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    ),
  );
  process.exit(ExitCode.RUNTIME_ERROR);
}

class LinterConfigNotFoundError extends Error {
  constructor(filename: string) {
    super(`Linter config file not found: ${filename}`);
    this.name = "LinterConfigNotFoundError";
  }
}

function validateLinterTarget(linter: string): LinterTarget {
  const normalized = linter.toLowerCase();
  if (!["eslint", "ruff", "tsc"].includes(normalized)) {
    throw new ConfigError(
      `Unknown linter: ${linter}. Supported linters: eslint, ruff, tsc`,
    );
  }
  return normalized as LinterTarget;
}

function formatMismatch(mismatch: Mismatch): string {
  switch (mismatch.type) {
    case "missing":
      return `  - missing rule: ${mismatch.rule} = ${JSON.stringify(mismatch.expected)}`;
    case "different":
      return `  - different value: ${mismatch.rule} (expected ${JSON.stringify(mismatch.expected)}, got ${JSON.stringify(mismatch.actual)})`;
    case "extra":
      return `  - extra rule: ${mismatch.rule} = ${JSON.stringify(mismatch.actual)}`;
  }
}

/** Check if ruleset is defined for target */
function isRulesetDefined(config: Config, target: LinterTarget): boolean {
  if (target === "eslint") return !!config.rulesets?.eslint?.rules;
  if (target === "ruff") return !!config.rulesets?.ruff;
  return !!config.rulesets?.tsc;
}

async function verifyLinterConfig(
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

/** Compare expected vs actual ESLint rules */
function compareESLintRules(
  expected: Record<string, ESLintRuleValue>,
  actual: Record<string, ESLintRuleValue>,
): Mismatch[] {
  const mismatches: Mismatch[] = [];

  for (const [rule, expectedValue] of Object.entries(expected)) {
    if (!(rule in actual)) {
      mismatches.push({ type: "missing", rule, expected: expectedValue });
    } else if (!deepEqual(expectedValue, actual[rule])) {
      mismatches.push({
        type: "different",
        rule,
        expected: expectedValue,
        actual: actual[rule],
      });
    }
  }

  for (const [rule, actualValue] of Object.entries(actual)) {
    if (!(rule in expected)) {
      mismatches.push({ type: "extra", rule, actual: actualValue });
    }
  }

  return mismatches;
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

/** Parse tsconfig.json content */
function parseTscConfig(
  content: string,
  filename: string,
): { compilerOptions?: Record<string, unknown> } {
  try {
    return JSON.parse(content);
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

/** Compare a single config option and add mismatches if found */
function compareOption(
  mismatches: Mismatch[],
  rule: string,
  expected: unknown,
  actual: unknown,
): void {
  if (expected !== undefined) {
    if (actual === undefined) {
      mismatches.push({ type: "missing", rule, expected });
    } else if (!deepEqual(expected, actual)) {
      mismatches.push({ type: "different", rule, expected, actual });
    }
  } else if (actual !== undefined) {
    mismatches.push({ type: "extra", rule, actual });
  }
}

/**
 * Strip JavaScript comments from content.
 * Uses a simple regex-based approach that handles most cases correctly.
 * Note: This may have edge cases with complex string literals containing comment-like patterns,
 * but works reliably for typical ESLint config files.
 */
function stripJsComments(content: string): string {
  // First, temporarily replace string literals to avoid matching comments inside strings
  const stringPlaceholders: string[] = [];
  const contentWithPlaceholders = content.replace(
    /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
    (match) => {
      const placeholder = `__STRING_${stringPlaceholders.length}__`;
      stringPlaceholders.push(match);
      return placeholder;
    },
  );

  // Remove single-line comments
  const withoutSingleLine = contentWithPlaceholders.replace(/\/\/[^\n]*/g, "");

  // Remove multi-line comments
  const withoutComments = withoutSingleLine.replace(/\/\*[\s\S]*?\*\//g, "");

  // Restore string literals
  return withoutComments.replace(/__STRING_(\d+)__/g, (_, index) => {
    return stringPlaceholders[parseInt(index, 10)] ?? "";
  });
}

/** Extract rules from ESLint config file content. */
function extractESLintRules(content: string): Record<string, ESLintRuleValue> {
  // Strip JavaScript comments before parsing to avoid matching commented-out rules
  const strippedContent = stripJsComments(content);
  const rulesMatch = /rules\s*:\s*(\{[\s\S]*?\})\s*[,}]/.exec(strippedContent);

  if (!rulesMatch?.[1]) {
    return {};
  }

  try {
    return parseRulesAsJson(rulesMatch[1]);
  } catch {
    return parseRulesManually(rulesMatch[1]);
  }
}

/** Parse rules block as JSON */
function parseRulesAsJson(rulesBlock: string): Record<string, ESLintRuleValue> {
  let jsonStr = rulesBlock
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, "$1")
    .replace(/(\w+):/g, '"$1":')
    .replace(/"@/g, '"@')
    .replace(/""/g, '"');

  jsonStr = jsonStr.replace(/"+"([^"]+)"+:/g, '"$1":');
  return JSON.parse(jsonStr);
}

/** Manual parser for ESLint rules when JSON parsing fails. */
function parseRulesManually(
  rulesBlock: string,
): Record<string, ESLintRuleValue> {
  const rules: Record<string, ESLintRuleValue> = {};
  const rulePattern = /['"]([^'"]+)['"]\s*:\s*(['"][^'"]+['"]|\[[^\]]+\])/g;
  let match;

  while ((match = rulePattern.exec(rulesBlock)) !== null) {
    const ruleName = match[1];
    const ruleValue = match[2];
    if (!ruleName || !ruleValue) continue;

    try {
      const normalizedValue = ruleValue.replace(/'/g, '"');
      rules[ruleName] = JSON.parse(normalizedValue);
    } catch {
      rules[ruleName] = ruleValue.replace(/['"]/g, "") as ESLintRuleValue;
    }
  }

  return rules;
}
