/**
 * E2E tests for `cmc audit` command
 */

import { describe, expect, it } from "vitest";

import { run } from "./runner.js";

// =============================================================================
// Audit: ESLint - multi-block configs
// =============================================================================
describe("cmc audit eslint - multi-block configs", () => {
  it("extracts rules from multiple config blocks", async () => {
    const result = await run("audit/eslint/multi-blocks", ["audit", "eslint"]);

    // Should pass because all required rules are present across the blocks
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("✓ eslint.config.js matches cmc.toml");
  });

  it("keeps stricter severity when rule appears in multiple blocks", async () => {
    // no-console is "error" in first block but "off" in second
    // audit should see "error" (the stricter one)
    const result = await run("audit/eslint/multi-blocks", ["audit", "eslint"]);

    expect(result.exitCode).toBe(0);
  });
});

// =============================================================================
// Audit: ESLint - extra rules allowed
// =============================================================================
describe("cmc audit eslint - extra rules", () => {
  it("allows extra rules beyond the required ruleset", async () => {
    const result = await run("audit/eslint/extra-rules", ["audit", "eslint"]);

    // Should pass - extra rules are allowed
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("✓ eslint.config.js matches cmc.toml");
  });

  it("does not report extra rules as mismatches", async () => {
    const result = await run("audit/eslint/extra-rules", ["audit", "eslint"]);

    expect(result.stdout).not.toContain("extra rule");
  });
});

// =============================================================================
// Audit: ESLint - severity matching
// =============================================================================
describe("cmc audit eslint - severity matching", () => {
  it("accepts array format when ruleset specifies string format", async () => {
    const result = await run("audit/eslint/severity-array", [
      "audit",
      "eslint",
    ]);

    // ["error", "always"] should satisfy "error"
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("✓ eslint.config.js matches cmc.toml");
  });

  it("accepts stricter severity (error instead of warn)", async () => {
    const result = await run("audit/eslint/severity-stricter", [
      "audit",
      "eslint",
    ]);

    // "error" should satisfy "warn" requirement
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("✓ eslint.config.js matches cmc.toml");
  });

  it("rejects weaker severity (warn instead of error)", async () => {
    const result = await run("audit/eslint/severity-weaker", [
      "audit",
      "eslint",
    ]);

    // "warn" should NOT satisfy "error" requirement
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("✗ eslint.config.js has mismatches");
    expect(result.stdout).toContain("different value: no-console");
  });
});

// =============================================================================
// Audit: ESLint - nested options parsing
// =============================================================================
describe("cmc audit eslint - nested options", () => {
  it("correctly parses rules with deeply nested options", async () => {
    const result = await run("audit/eslint/nested-options", [
      "audit",
      "eslint",
    ]);

    // Should pass - the brace matching should handle nested objects
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("✓ eslint.config.js matches cmc.toml");
  });
});

// =============================================================================
// Audit: ESLint - commented rules
// =============================================================================
describe("cmc audit eslint - commented rules", () => {
  it("detects missing rules when commented out with single-line comment", async () => {
    const result = await run("audit/eslint/commented-rules", [
      "audit",
      "eslint",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("✗ eslint.config.js has mismatches");
    expect(result.stdout).toContain("missing rule: no-console");
  });

  it("detects missing rules when commented out with multi-line comment", async () => {
    const result = await run("audit/eslint/multiline-comments", [
      "audit",
      "eslint",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("✗ eslint.config.js has mismatches");
    expect(result.stdout).toContain("missing rule: no-console");
    expect(result.stdout).toContain("missing rule: no-var");
  });
});

// =============================================================================
// Audit: TypeScript (tsc) - matching configs
// =============================================================================
describe("cmc audit tsc - matching configs", () => {
  it("exits 0 when tsconfig.json matches cmc.toml", async () => {
    const result = await run("audit/tsc/match", ["audit", "tsc"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("✓ tsconfig.json matches cmc.toml ruleset");
  });

  it("exits 0 when auditing all and tsc matches", async () => {
    const result = await run("audit/tsc/match", ["audit"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("✓ tsconfig.json matches cmc.toml ruleset");
  });
});

// =============================================================================
// Audit: TypeScript (tsc) - mismatching configs
// =============================================================================
describe("cmc audit tsc - mismatching configs", () => {
  it("exits 1 when tsconfig.json has different values", async () => {
    const result = await run("audit/tsc/mismatch", ["audit", "tsc"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("✗ tsconfig.json has mismatches");
  });

  it("reports different tsc values", async () => {
    const result = await run("audit/tsc/mismatch", ["audit", "tsc"]);

    expect(result.stdout).toContain("different value: strict");
    expect(result.stdout).toContain(
      "different value: noUncheckedIndexedAccess",
    );
  });

  it("reports missing tsc options", async () => {
    const result = await run("audit/tsc/mismatch", ["audit", "tsc"]);

    expect(result.stdout).toContain("missing rule: noImplicitReturns");
  });
});

// =============================================================================
// Audit: TypeScript (tsc) - missing config file
// =============================================================================
describe("cmc audit tsc - missing config file", () => {
  it("exits 3 when tsconfig.json not found", async () => {
    const result = await run("audit/tsc/missing", ["audit", "tsc"]);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Linter config file not found");
    expect(result.stderr).toContain("tsconfig.json");
  });
});

// =============================================================================
// Audit: Help and error handling
// =============================================================================
describe("cmc audit - error handling", () => {
  it("exits 2 for unknown linter", async () => {
    const result = await run("audit/tsc/match", ["audit", "unknown"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unknown linter");
    expect(result.stderr).toContain("eslint, ruff, tsc");
  });

  it("shows tsc in help text", async () => {
    const result = await run("audit/tsc/match", ["audit", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("tsc");
  });
});
