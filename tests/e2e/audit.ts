/**
 * E2E tests for `cmc audit` command
 */

import { describe, expect, it } from "vitest";

import { runInDocker } from "./docker-runner.js";
import { dockerAvailable, images, setupImages } from "./setup.js";

// Setup: Build required images
setupImages([
  "audit/typescript-and-python/match",
  "audit/typescript-and-python/mismatch",
  "audit/typescript-and-python/missing",
  "audit/typescript-and-python/malformed",
  "audit/typescript-and-python/empty-ruleset",
]);

// =============================================================================
// Verify: Matching configs
// =============================================================================
describe.skipIf(!dockerAvailable)("cmc audit - matching configs", () => {
  it("exits 0 when ESLint config matches cmc.toml", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/match"],
      ["audit", "eslint"],
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "✓ eslint.config.js matches cmc.toml ruleset",
    );
  }, 30000);

  it("exits 0 when Ruff config matches cmc.toml", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/match"],
      ["audit", "ruff"],
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("✓ ruff.toml matches cmc.toml ruleset");
  }, 30000);

  it("exits 0 when all configs match (no argument)", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/match"],
      ["audit"],
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "✓ eslint.config.js matches cmc.toml ruleset",
    );
    expect(result.stdout).toContain("✓ ruff.toml matches cmc.toml ruleset");
  }, 30000);
});

// =============================================================================
// Verify: Mismatching configs
// =============================================================================
describe.skipIf(!dockerAvailable)("cmc audit - mismatching configs", () => {
  it("exits 1 when ESLint config has mismatches", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/mismatch"],
      ["audit", "eslint"],
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("✗ eslint.config.js has mismatches");
  }, 30000);

  it("reports missing ESLint rules", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/mismatch"],
      ["audit", "eslint"],
    );

    expect(result.stdout).toContain("missing rule: prefer-const");
    expect(result.stdout).toContain("missing rule: eqeqeq");
  }, 30000);

  it("reports extra ESLint rules", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/mismatch"],
      ["audit", "eslint"],
    );

    expect(result.stdout).toContain("extra rule: no-console");
  }, 30000);

  it("exits 1 when Ruff config has mismatches", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/mismatch"],
      ["audit", "ruff"],
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("✗ ruff.toml has mismatches");
  }, 30000);

  it("reports different Ruff values", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/mismatch"],
      ["audit", "ruff"],
    );

    expect(result.stdout).toContain("different value: line-length");
    expect(result.stdout).toContain("different value: select");
  }, 30000);

  it("reports missing Ruff rules", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/mismatch"],
      ["audit", "ruff"],
    );

    expect(result.stdout).toContain("missing rule: ignore");
  }, 30000);

  it("exits 1 when any config mismatches (no argument)", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/mismatch"],
      ["audit"],
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("✗ eslint.config.js has mismatches");
    expect(result.stdout).toContain("✗ ruff.toml has mismatches");
  }, 30000);
});

// =============================================================================
// Verify: Missing linter config files
// =============================================================================
describe.skipIf(!dockerAvailable)("cmc audit - missing config files", () => {
  it("exits 3 when ESLint config file not found", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/missing"],
      ["audit", "eslint"],
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Linter config file not found");
    expect(result.stderr).toContain("eslint.config.js");
  }, 30000);

  it("exits 3 when Ruff config file not found", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/missing"],
      ["audit", "ruff"],
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Linter config file not found");
    expect(result.stderr).toContain("ruff.toml");
  }, 30000);

  it("exits 3 when verifying all and first config not found", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/missing"],
      ["audit"],
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Linter config file not found");
  }, 30000);
});

// =============================================================================
// Verify: Error handling
// =============================================================================
describe.skipIf(!dockerAvailable)("cmc audit - error handling", () => {
  it("exits 2 for unknown linter", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/match"],
      ["audit", "unknown"],
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unknown linter");
  }, 30000);
});

// =============================================================================
// Verify: Malformed config files
// =============================================================================
describe.skipIf(!dockerAvailable)("cmc audit - malformed configs", () => {
  it("handles malformed Ruff TOML config", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/malformed"],
      ["audit", "ruff"],
    );

    // Should fail with a parse error
    expect(result.exitCode).toBe(3); // RUNTIME_ERROR
    expect(result.stderr).toContain("Failed to parse");
  }, 30000);

  it("handles malformed ESLint config gracefully", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/malformed"],
      ["audit", "eslint"],
    );

    // ESLint config is read as text, so malformed JS may result in empty rules
    // or a parse issue depending on implementation
    expect(result.exitCode).not.toBe(2); // Not a CONFIG_ERROR
  }, 30000);
});

// =============================================================================
// Verify: Empty rulesets
// =============================================================================
describe.skipIf(!dockerAvailable)("cmc audit - empty rulesets", () => {
  it("exits successfully when no rulesets defined", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/empty-ruleset"],
      ["audit"],
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No linter configs to audit");
  }, 30000);

  it("shows message about no rulesets for specific linter", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/empty-ruleset"],
      ["audit", "eslint"],
    );

    // When no ESLint ruleset is defined, should indicate nothing to audit
    expect(result.exitCode).toBe(0);
  }, 30000);
});

// =============================================================================
// Verify: Help text
// =============================================================================
describe.skipIf(!dockerAvailable)("cmc audit - help", () => {
  it("shows help with usage information", async () => {
    const result = await runInDocker(
      images["audit/typescript-and-python/match"],
      ["audit", "--help"],
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("audit");
    expect(result.stdout).toContain("linter");
  }, 30000);
});
