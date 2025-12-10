import type { RequirementsCheckResult } from "../requirements/index.js";
import { colors } from "./output.js";

/** Build JSON output for failed requirements */
export function buildRequirementsFailureJson(
  result: RequirementsCheckResult,
): object {
  return {
    requirements: {
      files: result.files,
      tools: {
        required: result.tools.required,
        missing: result.tools.missing,
        passed: result.tools.passed,
      },
      passed: result.passed,
    },
    violations: [],
    summary: { files_checked: 0, violations_count: 0 },
  };
}

/** Output missing files and tools to console */
function outputMissingRequirements(result: RequirementsCheckResult): void {
  if (result.files.missing.length > 0) {
    console.log(colors.red("✗ Missing required files:"));
    result.files.missing.forEach((f) => console.log(colors.red(`  - ${f}`)));
  }
  if (result.tools.missing.length > 0) {
    console.log(colors.red("✗ Missing tool configurations:"));
    result.tools.missing.forEach((t) =>
      console.log(colors.red(`  - ${t.tool}: ${t.reason}`)),
    );
  }
  const totalMissing =
    result.files.missing.length + result.tools.missing.length;
  const s = totalMissing === 1 ? "" : "s";
  console.log(colors.red(`\n${totalMissing} requirement${s} failed`));
}

/** Output requirements failure */
export function outputRequirementsFailure(
  result: RequirementsCheckResult,
  json: boolean,
  quiet: boolean,
): void {
  if (json) {
    console.log(JSON.stringify(buildRequirementsFailureJson(result), null, 2));
    return;
  }
  if (!quiet) {
    outputMissingRequirements(result);
  }
}

/** Output requirements success message */
export function outputRequirementsSuccess(
  result: RequirementsCheckResult,
): void {
  const fileCount = result.files.required.length;
  const toolCount = result.tools.required.length;
  const parts: string[] = [];

  if (fileCount > 0) {
    parts.push(`${fileCount} file${fileCount === 1 ? "" : "s"}`);
  }
  if (toolCount > 0) {
    parts.push(`${toolCount} tool${toolCount === 1 ? "" : "s"}`);
  }

  if (parts.length > 0) {
    console.log(colors.green(`✓ All requirements met (${parts.join(", ")})`));
  }
}
