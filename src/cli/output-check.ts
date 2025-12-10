import type { AuditCheckResult, Mismatch } from "../audit/index.js";
import type { RequirementsCheckResult } from "../requirements/index.js";
import type { CheckResult, Violation } from "../types.js";
import { colors } from "./output.js";

/** Convert Mismatch object to string for JSON output */
function formatMismatch(m: Mismatch): string {
  if (m.type === "missing") {
    return `${m.rule}: expected ${JSON.stringify(m.expected)}, not found`;
  }
  if (m.type === "extra") {
    return `${m.rule}: unexpected rule found`;
  }
  return `${m.rule}: expected ${JSON.stringify(m.expected)}, got ${JSON.stringify(m.actual)}`;
}

export interface ExtendedCheckResult extends CheckResult {
  auditWarnings?: AuditCheckResult;
  requirementsResult?: RequirementsCheckResult;
}

interface JsonViolation {
  file: string;
  line: number | null;
  rule: string;
  message: string;
  linter: string;
}

interface JsonOutput {
  violations: JsonViolation[];
  summary: { files_checked: number; violations_count: number };
  requirements?: {
    files: { required: string[]; missing: string[]; passed: boolean };
    tools: {
      required: string[];
      missing: { tool: string; reason: string }[];
      passed: boolean;
    };
    passed: boolean;
  };
  warnings?: {
    missing_configs: {
      linter: string;
      filename: string;
      message: string;
    }[];
    mismatched_configs: {
      linter: string;
      filename: string;
      mismatches: string[];
      message: string;
    }[];
  };
}

function formatViolation(v: Violation): JsonViolation {
  return {
    file: v.file,
    line: v.line,
    rule: v.rule,
    message: v.message,
    linter: v.linter,
  };
}

export function buildJsonOutput(result: ExtendedCheckResult): JsonOutput {
  const jsonOutput: JsonOutput = {
    violations: result.violations.map(formatViolation),
    summary: {
      files_checked: result.filesChecked,
      violations_count: result.violations.length,
    },
  };

  if (result.requirementsResult) {
    jsonOutput.requirements = {
      files: result.requirementsResult.files,
      tools: {
        required: result.requirementsResult.tools.required,
        missing: result.requirementsResult.tools.missing,
        passed: result.requirementsResult.tools.passed,
      },
      passed: result.requirementsResult.passed,
    };
  }

  if (result.auditWarnings) {
    jsonOutput.warnings = {
      missing_configs: result.auditWarnings.missingConfigs.map((m) => ({
        linter: m.linter,
        filename: m.filename,
        message: `Run 'cmc generate ${m.linter}' to create from cmc.toml`,
      })),
      mismatched_configs: result.auditWarnings.mismatchedConfigs.map((m) => ({
        linter: m.linter,
        filename: m.filename,
        mismatches: m.mismatches.map(formatMismatch),
        message: `Run 'cmc generate ${m.linter} --force' to sync`,
      })),
    };
  }

  return jsonOutput;
}

function outputTextResults(result: ExtendedCheckResult): void {
  if (result.violations.length === 0) {
    console.log(
      colors.green(
        `✓ No violations found (${result.filesChecked} files checked)`,
      ),
    );
    return;
  }

  for (const v of result.violations) {
    const location = v.line ? `:${v.line}` : "";
    const filePath = colors.cyan(`${v.file}${location}`);
    const rule = colors.dim(`[${v.linter}/${v.rule}]`);
    console.log(`${filePath} ${rule} ${v.message}`);
  }

  const s = result.violations.length === 1 ? "" : "s";
  console.log(
    colors.red(`\n✗ ${result.violations.length} violation${s} found`),
  );
}

export function outputResults(
  result: ExtendedCheckResult,
  json: boolean,
  quiet: boolean,
): void {
  if (json) {
    console.log(JSON.stringify(buildJsonOutput(result), null, 2));
    return;
  }

  if (quiet) {
    return;
  }

  outputTextResults(result);
}
