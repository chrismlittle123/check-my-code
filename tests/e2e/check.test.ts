/**
 * E2E tests for `cmc check` command
 */

import { symlink, unlink } from "fs/promises";
import { join } from "path";
import { describe, expect, it } from "vitest";

import { run } from "./runner.js";

const PROJECTS_DIR = join(process.cwd(), "tests", "e2e", "projects");

interface JsonOutput {
  violations: {
    file: string;
    line: number | null;
    column: number | null;
    rule: string;
    message: string;
    linter: "eslint" | "ruff" | "tsc";
  }[];
  summary: {
    files_checked: number;
    violations_count: number;
  };
}

type LinterId = JsonOutput["violations"][number]["linter"];

interface JsonOutputWithWarnings extends JsonOutput {
  warnings: {
    missing_configs: {
      linter: LinterId;
      filename: string;
      message: string;
    }[];
    mismatched_configs: {
      linter: LinterId;
      filename: string;
      message: string;
    }[];
  };
}

interface JsonOutputWithRequirements extends JsonOutput {
  requirements: {
    passed: boolean;
    files: {
      required: string[];
      missing: string[];
      passed: boolean;
    };
    tools: {
      required: string[];
      missing: { tool: string; reason: string }[];
      passed: boolean;
    };
  };
}

// =============================================================================
// Check: ESLint (TypeScript/JavaScript)
// =============================================================================
describe("cmc check - ESLint", () => {
  it("detects ESLint violations and exits 1", async () => {
    const result = await run("check/typescript/default", ["check", "--json"]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(output.violations.some((v) => v.rule === "no-var")).toBe(true);
    expect(output.violations.every((v) => v.linter === "eslint")).toBe(true);
  });

  it("includes line and column in violations", async () => {
    const result = await run("check/typescript/default", [
      "check",
      "violation.ts",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.violations.length).toBeGreaterThan(0);
    expect(output.violations[0].line).toBeTypeOf("number");
    expect(output.violations[0].column).toBeTypeOf("number");
  });

  it("exits 0 for clean files", async () => {
    const result = await run("check/typescript/default", [
      "check",
      "clean.ts",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.violations.length).toBe(0);
    expect(output.summary.files_checked).toBe(1);
  });
});

// =============================================================================
// Check: Ruff (Python)
// =============================================================================
describe("cmc check - Ruff", () => {
  it("detects Ruff violations and exits 1", async () => {
    const result = await run("check/python/default", ["check", "--json"]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(output.violations.some((v) => v.rule === "F401")).toBe(true);
    expect(output.violations.every((v) => v.linter === "ruff")).toBe(true);
  });

  it("exits 0 for clean Python files", async () => {
    const result = await run("check/python/default", [
      "check",
      "clean.py",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.violations.length).toBe(0);
  });
});

// =============================================================================
// Check: Mixed-language projects
// =============================================================================
describe("cmc check - mixed language", () => {
  it("detects violations from both ESLint and Ruff", async () => {
    const result = await run("check/typescript-and-python/default", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    const ruffViolations = output.violations.filter((v) => v.linter === "ruff");
    const eslintViolations = output.violations.filter(
      (v) => v.linter === "eslint",
    );

    expect(ruffViolations.length).toBeGreaterThan(0);
    expect(eslintViolations.length).toBeGreaterThan(0);
  });

  it("checks all files in project", async () => {
    const result = await run("check/typescript-and-python/default", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.summary.files_checked).toBe(4);
  });
});

// =============================================================================
// Check: Output formats
// =============================================================================
describe("cmc check - output formats", () => {
  it("outputs valid JSON with required fields", async () => {
    const result = await run("check/typescript/default", ["check", "--json"]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output).toHaveProperty("violations");
    expect(output).toHaveProperty("summary");
    expect(output.summary).toHaveProperty("files_checked");
    expect(output.summary).toHaveProperty("violations_count");
    expect(output.violations.length).toBe(output.summary.violations_count);
  });

  it("shows success message when no violations", async () => {
    const result = await run("check/typescript/default", ["check", "clean.ts"]);

    expect(result.stdout).toContain("No violations found");
    expect(result.stdout).toContain("1 files checked");
  });

  it("shows violation details with file:line format", async () => {
    const result = await run("check/typescript/default", [
      "check",
      "violation.ts",
    ]);

    expect(result.stdout).toMatch(/violation\.ts:\d+ \[eslint\/no-var\]/);
  });
});

// =============================================================================
// Check: Configuration errors (exit code 2)
// =============================================================================
describe("cmc check - configuration errors", () => {
  it("exits with code 2 for invalid TOML syntax", async () => {
    const result = await run("check/config-errors/invalid-toml", ["check"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid TOML");
  });

  it("exits with code 2 when project name is missing", async () => {
    const result = await run("check/config-errors/missing-name", ["check"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid cmc.toml");
  });
});

// =============================================================================
// Check: Edge cases
// =============================================================================
describe("cmc check - edge cases", () => {
  it("handles empty projects with no source files", async () => {
    const result = await run("check/typescript/empty-project", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.violations.length).toBe(0);
    expect(output.summary.files_checked).toBe(0);
  });

  it("handles files with special characters in names", async () => {
    const result = await run("check/typescript/special-chars", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(
      output.violations.some((v) => v.file.includes("file-with-dashes.ts")),
    ).toBe(true);
    expect(
      output.violations.some((v) =>
        v.file.includes("file_with_underscores.ts"),
      ),
    ).toBe(true);
  });

  it("detects multiple violations per file", async () => {
    const result = await run("check/typescript/multi-violations", [
      "check",
      "file-a.ts",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.violations.length).toBeGreaterThan(1);
    const rules = new Set(output.violations.map((v) => v.rule));
    expect(rules.has("no-var")).toBe(true);
    expect(rules.has("eqeqeq")).toBe(true);
  });

  it("follows symlinks to files", async () => {
    // Create symlink for this test (not tracked in git due to prettier issues)
    const symlinkDir = join(PROJECTS_DIR, "check", "typescript", "symlinks");
    const linkPath = join(symlinkDir, "linked.ts");

    // Create symlink (cleanup first in case it exists)
    try {
      await unlink(linkPath);
    } catch {
      // Ignore if doesn't exist
    }
    await symlink("actual.ts", linkPath);

    try {
      const result = await run("check/typescript/symlinks", [
        "check",
        "--json",
      ]);
      const output: JsonOutput = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(1);
      expect(output.violations.length).toBeGreaterThan(0);
      // Should find violations in both actual.ts and linked.ts (symlink)
      expect(output.summary.files_checked).toBe(2);
    } finally {
      // Cleanup symlink
      await unlink(linkPath);
    }
  });
});

// =============================================================================
// Check: Path argument (subdirectories and specific paths)
// =============================================================================
describe("cmc check - path argument", () => {
  it("checks only files in specified subdirectory", async () => {
    const result = await run("check/typescript/nested-dirs", [
      "check",
      "src/",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(output.summary.files_checked).toBe(2); // src/index.ts and src/utils/helpers.ts
    expect(output.violations.every((v) => v.file.startsWith("src/"))).toBe(
      true,
    );
  });

  it("checks nested subdirectory", async () => {
    const result = await run("check/typescript/nested-dirs", [
      "check",
      "src/utils/",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(output.summary.files_checked).toBe(1); // only src/utils/helpers.ts
    expect(output.violations[0].file).toBe("src/utils/helpers.ts");
  });

  it("checks all files without path argument", async () => {
    const result = await run("check/typescript/nested-dirs", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(output.summary.files_checked).toBe(4); // root.ts, src/index.ts, src/utils/helpers.ts, lib/legacy.ts
  });
});

// =============================================================================
// Check: Clean project (no violations)
// =============================================================================
describe("cmc check - clean projects", () => {
  it("exits 0 for project with no violations", async () => {
    const result = await run("check/typescript/clean-project", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.violations.length).toBe(0);
    expect(output.summary.files_checked).toBe(2);
  });

  it("shows success message for clean project", async () => {
    const result = await run("check/typescript/clean-project", ["check"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No violations found");
    expect(result.stdout).toContain("2 files checked");
  });
});

// =============================================================================
// Check: Ignored directories (build is ignored by default)
// =============================================================================
describe("cmc check - ignored directories", () => {
  it("ignores build directory and only checks src", async () => {
    const result = await run("check/typescript/with-ignored-dirs", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    // build/ has violations but should be ignored
    expect(result.exitCode).toBe(0);
    expect(output.violations.length).toBe(0);
    expect(output.violations.some((v) => v.file.includes("build/"))).toBe(
      false,
    );
  });

  it("only checks files in src directory", async () => {
    const result = await run("check/typescript/with-ignored-dirs", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(output.summary.files_checked).toBe(1); // only src/main.ts
  });
});

// =============================================================================
// BUG-003: Linter execution errors
// =============================================================================
describe("cmc check - linter execution errors", () => {
  it("exits with code 3 when ESLint config is broken", async () => {
    const result = await run("check/config-errors/broken-eslint", ["check"]);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("ESLint failed");
  });
});

// =============================================================================
// Check: TypeScript type checking (tsc)
// =============================================================================
describe("cmc check - TypeScript type checking", () => {
  it("detects type errors when tsc is enabled", async () => {
    const result = await run("check/typescript/with-tsc-enabled", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    // Should have tsc violations
    const tscViolations = output.violations.filter((v) => v.linter === "tsc");
    expect(tscViolations.length).toBeGreaterThan(0);
    // Should include TS error code
    expect(tscViolations.some((v) => v.rule.startsWith("TS"))).toBe(true);
  });

  it("includes line and column in tsc violations", async () => {
    const result = await run("check/typescript/with-tsc-enabled", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    const tscViolations = output.violations.filter((v) => v.linter === "tsc");
    expect(tscViolations.length).toBeGreaterThan(0);
    expect(tscViolations[0].line).toBeTypeOf("number");
    expect(tscViolations[0].column).toBeTypeOf("number");
  });

  it("does not run tsc when not configured", async () => {
    const result = await run("check/typescript/without-tsc", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    // Should exit 0 because only ESLint runs (no lint violations in test file)
    expect(result.exitCode).toBe(0);
    // Should have no tsc violations even though file has type errors
    const tscViolations = output.violations.filter((v) => v.linter === "tsc");
    expect(tscViolations.length).toBe(0);
  });

  it("runs both ESLint and tsc when both configured", async () => {
    const result = await run("check/typescript/with-tsc-enabled", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    const tscViolations = output.violations.filter((v) => v.linter === "tsc");

    // Should have tsc violations from type-error.ts
    expect(tscViolations.length).toBeGreaterThan(0);
    // ESLint also runs but may not have violations in these clean files
    expect(output.summary.files_checked).toBeGreaterThan(0);
  });

  it("shows tsc violations in human-readable output", async () => {
    const result = await run("check/typescript/with-tsc-enabled", ["check"]);

    expect(result.stdout).toMatch(/\[tsc\/TS\d+\]/);
    expect(result.stdout).toContain("type");
  });
});

// =============================================================================
// Check: Multiple file arguments
// =============================================================================
describe("cmc check - multiple file arguments", () => {
  it("checks multiple files when provided as arguments", async () => {
    const result = await run("check/typescript/multi-violations", [
      "check",
      "file-a.ts",
      "file-b.ts",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(output.summary.files_checked).toBe(2);
    // Should have violations from both files
    const filesWithViolations = new Set(output.violations.map((v) => v.file));
    expect(filesWithViolations.has("file-a.ts")).toBe(true);
    expect(filesWithViolations.has("file-b.ts")).toBe(true);
  });

  it("deduplicates overlapping paths", async () => {
    const result = await run("check/typescript/nested-dirs", [
      "check",
      "src/",
      "src/index.ts",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    // src/ includes src/index.ts, so should not double-count
    expect(output.summary.files_checked).toBe(2); // src/index.ts and src/utils/helpers.ts
  });

  it("checks mix of files and directories", async () => {
    const result = await run("check/typescript/nested-dirs", [
      "check",
      "root.ts",
      "src/",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    // root.ts + src/index.ts + src/utils/helpers.ts
    expect(output.summary.files_checked).toBe(3);
  });
});

// =============================================================================
// Check: Nonexistent paths
// =============================================================================
describe("cmc check - nonexistent paths", () => {
  it("exits with code 2 for nonexistent file", async () => {
    const result = await run("check/typescript/default", [
      "check",
      "does-not-exist.ts",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Path not found");
    expect(result.stderr).toContain("does-not-exist.ts");
  });

  it("exits with code 2 for nonexistent directory", async () => {
    const result = await run("check/typescript/default", [
      "check",
      "nonexistent-dir/",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Path not found");
  });

  it("lists all nonexistent paths in error", async () => {
    const result = await run("check/typescript/default", [
      "check",
      "missing1.ts",
      "missing2.ts",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("missing1.ts");
    expect(result.stderr).toContain("missing2.ts");
  });

  it("outputs error as JSON when --json flag is used", async () => {
    const result = await run("check/typescript/default", [
      "check",
      "--json",
      "does-not-exist.ts",
    ]);

    expect(result.exitCode).toBe(2);
    const output = JSON.parse(result.stdout) as {
      error: { code: string; message: string };
    };
    expect(output.error).toBeDefined();
    expect(output.error.code).toBe("CONFIG_ERROR");
    expect(output.error.message).toContain("Path not found");
    expect(output.error.message).toContain("does-not-exist.ts");
  });

  it("still checks valid files if some exist", async () => {
    const result = await run("check/typescript/default", [
      "check",
      "violation.ts",
      "nonexistent.ts",
      "--json",
    ]);

    // Should check the valid file and report violations
    expect(result.exitCode).toBe(1);
    const output: JsonOutput = JSON.parse(result.stdout);
    expect(output.summary.files_checked).toBe(1);
    expect(output.violations.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Check: --quiet flag
// =============================================================================
describe("cmc check - --quiet flag", () => {
  it("suppresses all output when --quiet is set", async () => {
    const result = await run("check/typescript/default", ["check", "--quiet"]);

    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(1); // Still has violations
  });

  it("suppresses output with -q short flag", async () => {
    const result = await run("check/typescript/default", ["check", "-q"]);

    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(1);
  });

  it("returns exit code 0 for clean project in quiet mode", async () => {
    const result = await run("check/typescript/clean-project", [
      "check",
      "--quiet",
    ]);

    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("--json takes precedence over --quiet (outputs JSON)", async () => {
    const result = await run("check/typescript/default", [
      "check",
      "--quiet",
      "--json",
    ]);

    // --json should produce JSON output even when --quiet is also set
    // This is useful for CI pipelines that want machine-readable output with no extra logs
    expect(result.stdout).not.toBe("");
    const output: JsonOutput = JSON.parse(result.stdout);
    expect(output.violations).toBeDefined();
    expect(output.summary).toBeDefined();
    expect(result.exitCode).toBe(1);
  });

  it("--json --quiet produces JSON for clean project", async () => {
    const result = await run("check/typescript/clean-project", [
      "check",
      "--quiet",
      "--json",
    ]);

    expect(result.stdout).not.toBe("");
    const output: JsonOutput = JSON.parse(result.stdout);
    expect(output.violations).toHaveLength(0);
    expect(result.exitCode).toBe(0);
  });

  it("works with path argument", async () => {
    const result = await run("check/typescript/default", [
      "check",
      "violation.ts",
      "--quiet",
    ]);

    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(1);
  });
});

// =============================================================================
// Check: [tools] section - disable specific linters
// =============================================================================
describe("cmc check - [tools] section", () => {
  it("disables ESLint when tools.eslint = false", async () => {
    const result = await run("check/typescript/with-tools-disabled", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    // Should have no violations because ESLint is disabled
    expect(result.exitCode).toBe(0);
    expect(output.violations).toHaveLength(0);
  });

  it("disables Ruff when tools.ruff = false", async () => {
    const result = await run("check/python/with-tools-disabled", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    // Should have no violations because Ruff is disabled
    expect(result.exitCode).toBe(0);
    expect(output.violations).toHaveLength(0);
  });
});

// =============================================================================
// Check: [files] section - include/exclude patterns
// =============================================================================
describe("cmc check - [files] section", () => {
  it("only checks files matching include patterns", async () => {
    const result = await run("check/typescript/with-files-config", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    // Config: include = ["src/**/*.ts"], exclude = ["vendor/**/*"]
    // Should only check src/app.ts (clean file)
    // root.ts is excluded because it doesn't match include pattern "src/**/*.ts"
    // vendor/lib.ts would match via default patterns but is explicitly excluded
    expect(result.exitCode).toBe(0);
    expect(output.summary.files_checked).toBe(1);
    expect(output.violations).toHaveLength(0);
  });

  it("excludes files matching exclude patterns", async () => {
    const result = await run("check/typescript/with-files-config", [
      "check",
      "--json",
    ]);
    const output: JsonOutput = JSON.parse(result.stdout);

    // vendor/lib.ts has a no-var violation but is excluded by the exclude pattern
    const vendorViolations = output.violations.filter((v) =>
      v.file.includes("vendor"),
    );
    expect(vendorViolations).toHaveLength(0);
  });
});

// =============================================================================
// Check: file count accuracy
// =============================================================================
describe("cmc check - file count accuracy", () => {
  it("only counts lintable files in files_checked", async () => {
    // This project has .ts, .py, .json, and .md files with all linters disabled
    // Since eslint and ruff are both disabled, no files should be counted
    const result = await run("check/mixed-extensions", ["check", "--json"]);
    const output: JsonOutput = JSON.parse(result.stdout);

    // With both eslint and ruff disabled, no files should be counted
    expect(result.exitCode).toBe(0);
    expect(output.summary.files_checked).toBe(0);
  });
});

// =============================================================================
// Check: audit warnings for config mismatches
// =============================================================================
describe("cmc check - audit warnings", () => {
  it("warns when eslint.config.js has different rules than cmc.toml", async () => {
    const result = await run("check/audit-warnings/eslint-mismatch", ["check"]);

    // Should still run and show no violations, but with a warning
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("⚠");
    expect(result.stdout).toContain("eslint.config.js");
    expect(result.stdout).toContain("mismatch");
    expect(result.stdout).toContain("cmc generate eslint --force");
  });

  it("includes audit warnings in JSON output", async () => {
    const result = await run("check/audit-warnings/eslint-mismatch", [
      "check",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout) as JsonOutputWithWarnings;
    expect(output.warnings).toBeDefined();
    expect(output.warnings.mismatched_configs).toHaveLength(1);
    expect(output.warnings.mismatched_configs[0].linter).toBe("eslint");
  });

  it("suppresses audit warnings in quiet mode", async () => {
    const result = await run("check/audit-warnings/eslint-mismatch", [
      "check",
      "--quiet",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });
});

// =============================================================================
// Check: Requirements enforcement
// =============================================================================
describe("cmc check - requirements enforcement", () => {
  it("passes when all required files and tools exist", async () => {
    const result = await run("check/requirements-pass", ["check"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("All requirements met");
    expect(result.stdout).toContain("2 files");
    expect(result.stdout).toContain("1 tool");
  });

  it("includes requirements in JSON output when passing", async () => {
    const result = await run("check/requirements-pass", ["check", "--json"]);
    const output: JsonOutputWithRequirements = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output.requirements).toBeDefined();
    expect(output.requirements.passed).toBe(true);
    expect(output.requirements.files.required).toContain("CLAUDE.md");
    expect(output.requirements.tools.required).toContain("npm-audit");
  });

  it("fails when required files are missing", async () => {
    const result = await run("check/requirements-missing-files", ["check"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Missing required files");
    expect(result.stdout).toContain("MISSING.md");
  });

  it("includes missing files in JSON output", async () => {
    const result = await run("check/requirements-missing-files", [
      "check",
      "--json",
    ]);
    const output: JsonOutputWithRequirements = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(output.requirements.passed).toBe(false);
    expect(output.requirements.files.missing).toContain("MISSING.md");
  });

  it("fails when required tools are not configured", async () => {
    const result = await run("check/requirements-missing-tools", ["check"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Missing tool configurations");
    expect(result.stdout).toContain("gitleaks");
    expect(result.stdout).toContain("knip");
  });

  it("includes missing tools in JSON output", async () => {
    const result = await run("check/requirements-missing-tools", [
      "check",
      "--json",
    ]);
    const output: JsonOutputWithRequirements = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(output.requirements.passed).toBe(false);
    expect(output.requirements.tools.missing).toHaveLength(2);
    // Use order-independent assertion
    const missingTools = output.requirements.tools.missing.map((t) => t.tool);
    expect(missingTools).toEqual(expect.arrayContaining(["gitleaks", "knip"]));
  });

  it("skips requirements with --skip-requirements flag", async () => {
    const result = await run("check/requirements-skip", [
      "check",
      "--skip-requirements",
    ]);

    // Should pass because requirements are skipped, even though MISSING.md doesn't exist
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("Missing required files");
    expect(result.stdout).toContain("No violations found");
  });

  it("does not output requirements message in quiet mode", async () => {
    const result = await run("check/requirements-pass", ["check", "--quiet"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });
});
