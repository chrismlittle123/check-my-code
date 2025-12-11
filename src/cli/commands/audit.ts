import { Command } from "commander";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";

import {
  LinterConfigNotFoundError,
  type LinterTarget,
  type Mismatch,
  SUPPORTED_LINTERS,
  verifyLinterConfig,
  type VerifyResult,
} from "../../audit/index.js";
import {
  ConfigError,
  findProjectRoot,
  loadConfig,
} from "../../config/loader.js";
import { ConfigFetchError, fetchClaudeSettings } from "../../remote/configs.js";
import {
  checkRequirements,
  hasRequirements,
  type RequirementsCheckResult,
} from "../../requirements/index.js";
import {
  type ClaudeSettings,
  type Config,
  DEFAULT_CLAUDE_SETTINGS_SOURCE,
  ExitCode,
} from "../../types.js";
import { deepEqual } from "../../utils/deep-equal.js";
import { colors } from "../output.js";

interface AuditOptions {
  skipRequirements?: boolean;
}

export const auditCommand = new Command("audit")
  .description("Check that config files and requirements match cmc.toml")
  .argument(
    "[target]",
    "Target to audit (eslint, ruff, tsc, claude, requirements). If omitted, audits all.",
  )
  .option("--skip-requirements", "Skip requirements validation", false)
  .addHelpText(
    "after",
    `
Examples:
  $ cmc audit                    Audit all configs and requirements
  $ cmc audit eslint             Audit only ESLint config
  $ cmc audit ruff               Audit only Ruff config
  $ cmc audit tsc                Audit only TypeScript config
  $ cmc audit claude             Audit only Claude settings
  $ cmc audit requirements       Audit only requirements
  $ cmc audit --skip-requirements  Audit linter configs only

Use in CI to ensure configs haven't drifted from cmc.toml.`,
  )
  .action(async (target: string | undefined, options: AuditOptions) => {
    try {
      await runAudit(target, options);
    } catch (error) {
      handleAuditError(error);
    }
  });

/** Run linter audits and return results */
async function runLinterAudits(
  projectRoot: string,
  config: Config,
  target?: string,
): Promise<VerifyResult[]> {
  const linterTargets = target
    ? [validateLinterTarget(target)]
    : SUPPORTED_LINTERS;

  const allResults = await Promise.all(
    linterTargets.map((t) => verifyLinterConfig(projectRoot, config, t)),
  );
  return allResults.filter((r): r is VerifyResult => r !== null);
}

/** Check if requirements result has any configured requirements */
function hasConfiguredRequirements(
  result: RequirementsCheckResult | undefined,
): boolean {
  if (!result) return false;
  return result.files.required.length > 0 || result.tools.required.length > 0;
}

/** Claude audit result */
interface ClaudeAuditResult {
  filename: string;
  matches: boolean;
  mismatches: ClaudeMismatch[];
}

interface ClaudeMismatch {
  type: "missing" | "different" | "extra";
  path: string;
  expected?: unknown;
  actual?: unknown;
}

function hasAnyResults(
  linterResults: VerifyResult[],
  requirementsResult: RequirementsCheckResult | undefined,
  claudeResult?: ClaudeAuditResult,
): boolean {
  return (
    linterResults.length > 0 ||
    hasConfiguredRequirements(requirementsResult) ||
    claudeResult !== undefined
  );
}

function hasAnyErrors(
  linterResults: VerifyResult[],
  requirementsResult: RequirementsCheckResult | undefined,
  claudeResult?: ClaudeAuditResult,
): boolean {
  const hasLinterErrors = linterResults.some((r) => !r.matches);
  const hasReqErrors = requirementsResult ? !requirementsResult.passed : false;
  const hasClaudeErrors = claudeResult ? !claudeResult.matches : false;
  return hasLinterErrors || hasReqErrors || hasClaudeErrors;
}

/** Output all audit results and return appropriate exit code */
function outputAndExit(
  linterResults: VerifyResult[],
  requirementsResult: RequirementsCheckResult | undefined,
  claudeResult?: ClaudeAuditResult,
): void {
  if (!hasAnyResults(linterResults, requirementsResult, claudeResult)) {
    console.log(
      "No configs or requirements to audit (none defined in cmc.toml)",
    );
    process.exit(ExitCode.SUCCESS);
  }

  if (requirementsResult) outputRequirementsResult(requirementsResult);
  if (linterResults.length > 0) outputLinterResults(linterResults);
  if (claudeResult) outputClaudeResult(claudeResult);

  process.exit(
    hasAnyErrors(linterResults, requirementsResult, claudeResult)
      ? ExitCode.VIOLATIONS
      : ExitCode.SUCCESS,
  );
}

async function getClaudeResult(
  projectRoot: string,
  config: Config,
  target?: string,
): Promise<ClaudeAuditResult | undefined> {
  if (!target && config.ai?.claude?.extends) {
    return auditClaudeSettings(projectRoot, config);
  }
  return undefined;
}

function getRequirementsResult(
  projectRoot: string,
  config: Config,
  options: AuditOptions,
  target?: string,
): RequirementsCheckResult | undefined {
  const skipReq = options.skipRequirements ?? false;
  const shouldCheck = !skipReq && !target && hasRequirements(config);
  return shouldCheck ? checkRequirements(projectRoot, config) : undefined;
}

/** Main audit logic */
async function runAudit(
  target?: string,
  options: AuditOptions = {},
): Promise<void> {
  const projectRoot = findProjectRoot();
  const config = await loadConfig(projectRoot);

  if (target === "requirements") {
    auditRequirementsOnly(projectRoot, config);
    return;
  }

  if (target === "claude") {
    await auditClaudeOnly(projectRoot, config);
    return;
  }

  const linterResults = await runLinterAudits(projectRoot, config, target);
  const claudeResult = await getClaudeResult(projectRoot, config, target);
  const requirementsResult = getRequirementsResult(
    projectRoot,
    config,
    options,
    target,
  );

  outputAndExit(linterResults, requirementsResult, claudeResult);
}

/** Audit only requirements */
function auditRequirementsOnly(projectRoot: string, config: Config): void {
  if (!hasRequirements(config)) {
    console.log("No requirements defined in cmc.toml");
    process.exit(ExitCode.SUCCESS);
  }

  const result = checkRequirements(projectRoot, config);
  outputRequirementsResult(result);
  process.exit(result.passed ? ExitCode.SUCCESS : ExitCode.VIOLATIONS);
}

/** Output requirements audit result */
function outputRequirementsResult(result: RequirementsCheckResult): void {
  // Files
  if (result.files.required.length > 0) {
    if (result.files.passed) {
      console.log(
        colors.green(
          `✓ All required files present (${result.files.required.length} files)`,
        ),
      );
    } else {
      console.log(colors.red("✗ Missing required files:"));
      for (const file of result.files.missing) {
        console.log(colors.red(`  - ${file}`));
      }
    }
  }

  // Tools
  if (result.tools.required.length > 0) {
    if (result.tools.passed) {
      console.log(
        colors.green(
          `✓ All required tools configured (${result.tools.required.length} tools)`,
        ),
      );
    } else {
      console.log(colors.red("✗ Missing tool configurations:"));
      for (const tool of result.tools.missing) {
        console.log(colors.red(`  - ${tool.tool}: ${tool.reason}`));
      }
    }
  }
}

/** Output linter audit results */
function outputLinterResults(results: VerifyResult[]): void {
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
  if (error instanceof ConfigError || error instanceof ConfigFetchError) {
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

/** Audit only Claude settings */
async function auditClaudeOnly(
  projectRoot: string,
  config: Config,
): Promise<void> {
  if (!config.ai?.claude?.extends) {
    throw new ConfigError(
      `No [ai.claude] configuration found in cmc.toml.\n\n` +
        `Add the following to enable Claude settings auditing:\n` +
        `  [ai.claude]\n` +
        `  extends = "${DEFAULT_CLAUDE_SETTINGS_SOURCE}"`,
    );
  }

  const result = await auditClaudeSettings(projectRoot, config);
  outputClaudeResult(result);
  process.exit(result.matches ? ExitCode.SUCCESS : ExitCode.VIOLATIONS);
}

const CLAUDE_SETTINGS_FILENAME = ".claude/settings.json";

function parseClaudeSettingsFile(content: string): ClaudeSettings {
  try {
    return JSON.parse(content);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Parse error";
    throw new ConfigError(
      `Failed to parse ${CLAUDE_SETTINGS_FILENAME}: ${msg}`,
    );
  }
}

/** Audit Claude settings and return result */
async function auditClaudeSettings(
  projectRoot: string,
  config: Config,
): Promise<ClaudeAuditResult> {
  const extendsRef = config.ai?.claude?.extends;
  if (!extendsRef) {
    return {
      filename: CLAUDE_SETTINGS_FILENAME,
      matches: true,
      mismatches: [],
    };
  }

  const settingsPath = join(projectRoot, CLAUDE_SETTINGS_FILENAME);
  if (!existsSync(settingsPath)) {
    throw new LinterConfigNotFoundError(CLAUDE_SETTINGS_FILENAME);
  }

  const expectedSettings = await fetchClaudeSettings(extendsRef);
  const actualContent = await readFile(settingsPath, "utf-8");
  const actualSettings = parseClaudeSettingsFile(actualContent);
  const mismatches = compareClaudeSettings(expectedSettings, actualSettings);

  return {
    filename: CLAUDE_SETTINGS_FILENAME,
    matches: mismatches.length === 0,
    mismatches,
  };
}

function compareField(
  mismatches: ClaudeMismatch[],
  path: string,
  expectedVal: unknown,
  actualVal: unknown,
): void {
  if (expectedVal === undefined) return;

  if (actualVal === undefined) {
    mismatches.push({ type: "missing", path, expected: expectedVal });
  } else if (!deepEqual(expectedVal, actualVal)) {
    mismatches.push({
      type: "different",
      path,
      expected: expectedVal,
      actual: actualVal,
    });
  }
}

/** Compare Claude settings and return mismatches */
function compareClaudeSettings(
  expected: ClaudeSettings,
  actual: ClaudeSettings,
): ClaudeMismatch[] {
  const mismatches: ClaudeMismatch[] = [];

  compareField(
    mismatches,
    "permissions.allow",
    expected.permissions?.allow,
    actual.permissions?.allow,
  );
  compareField(
    mismatches,
    "permissions.deny",
    expected.permissions?.deny,
    actual.permissions?.deny,
  );

  // Only compare env if expected has values
  const hasExpectedEnv = expected.env && Object.keys(expected.env).length > 0;
  if (hasExpectedEnv) {
    compareField(mismatches, "env", expected.env, actual.env);
  }

  return mismatches;
}

/** Output Claude audit result */
function outputClaudeResult(result: ClaudeAuditResult): void {
  if (result.matches) {
    console.log(colors.green(`✓ ${result.filename} matches remote settings`));
  } else {
    console.log(colors.red(`✗ ${result.filename} has mismatches:`));
    for (const mismatch of result.mismatches) {
      console.log(formatClaudeMismatch(mismatch));
    }
  }
}

/** Format a Claude mismatch for display */
function formatClaudeMismatch(mismatch: ClaudeMismatch): string {
  switch (mismatch.type) {
    case "missing":
      return `  - missing: ${mismatch.path} = ${JSON.stringify(mismatch.expected)}`;
    case "different":
      return `  - different: ${mismatch.path} (expected ${JSON.stringify(mismatch.expected)}, got ${JSON.stringify(mismatch.actual)})`;
    case "extra":
      return `  - extra: ${mismatch.path} = ${JSON.stringify(mismatch.actual)}`;
  }
}
