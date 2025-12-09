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
  ExitCode,
  type RuffConfig,
  type TscConfig,
} from "../../types.js";
import { deepEqual } from "../../utils/deep-equal.js";
import { colors } from "../output.js";
import { compareESLintRules, extractESLintRules } from "./audit-eslint.js";
import {
  LINTER_CONFIGS,
  type LinterTarget,
  type Mismatch,
  SUPPORTED_LINTERS,
  type VerifyResult,
} from "./audit-types.js";

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

  const targets = linter ? [validateLinterTarget(linter)] : SUPPORTED_LINTERS;

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
  if (!SUPPORTED_LINTERS.includes(normalized as LinterTarget)) {
    throw new ConfigError(
      `Unknown linter: ${linter}. Supported linters: ${SUPPORTED_LINTERS.join(", ")}`,
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
