/**
 * E2E tests for `cmc check` command
 */

import { describe, it, expect } from "vitest";
import { symlink, unlink } from "fs/promises";
import { join } from "path";
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
