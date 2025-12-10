import { Command } from "commander";

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
import {
  checkRequirements,
  hasRequirements,
  type RequirementsCheckResult,
} from "../../requirements/index.js";
import { type Config, ExitCode } from "../../types.js";
import { colors } from "../output.js";

interface AuditOptions {
  skipRequirements?: boolean;
}

export const auditCommand = new Command("audit")
  .description("Check that linter config files and requirements match cmc.toml")
  .argument(
    "[target]",
    "Target to audit (eslint, ruff, tsc, requirements). If omitted, audits all.",
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

/** Output all audit results and return appropriate exit code */
function outputAndExit(
  linterResults: VerifyResult[],
  requirementsResult: RequirementsCheckResult | undefined,
): void {
  const hasLinterResults = linterResults.length > 0;
  const hasReqResults = hasConfiguredRequirements(requirementsResult);

  if (!hasLinterResults && !hasReqResults) {
    console.log(
      "No linter configs or requirements to audit (none defined in cmc.toml)",
    );
    process.exit(ExitCode.SUCCESS);
  }

  if (requirementsResult) outputRequirementsResult(requirementsResult);
  if (hasLinterResults) outputLinterResults(linterResults);

  const hasLinterErrors = linterResults.some((r) => !r.matches);
  const hasReqErrors = requirementsResult && !requirementsResult.passed;
  process.exit(
    hasLinterErrors || hasReqErrors ? ExitCode.VIOLATIONS : ExitCode.SUCCESS,
  );
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

  const linterResults = await runLinterAudits(projectRoot, config, target);

  const skipReq = options.skipRequirements ?? false;
  const shouldCheckReq = !skipReq && !target && hasRequirements(config);
  const requirementsResult = shouldCheckReq
    ? checkRequirements(projectRoot, config)
    : undefined;

  outputAndExit(linterResults, requirementsResult);
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
