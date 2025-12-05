/**
 * E2E tests for `cmc audit` command (tsc)
 */

import { describe, it, expect } from "vitest";
import { run } from "./runner.js";

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
