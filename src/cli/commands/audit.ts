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
import { ExitCode } from "../../types.js";
import { colors } from "../output.js";

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
