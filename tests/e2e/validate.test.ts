/**
 * E2E tests for `cmc validate` command
 */

import { describe, expect, it } from "vitest";

import { run } from "./runner.js";

// Types for cmc validate --json output
interface ValidationError {
  keyword?: string;
  message?: string;
}

interface ValidateJsonOutput {
  valid: boolean;
  errors: ValidationError[];
  configPath?: string;
}

describe("cmc validate - valid configs", () => {
  it("validates minimal valid config and exits 0", async () => {
    const result = await run("validate/valid-minimal", ["validate"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("is valid");
  });

  it("validates full config with all sections and exits 0", async () => {
    const result = await run("validate/valid-full", ["validate"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("is valid");
  });

  it("outputs JSON when --json flag is used", async () => {
    const result = await run("validate/valid-minimal", ["validate", "--json"]);
    const output = JSON.parse(result.stdout) as ValidateJsonOutput;

    expect(result.exitCode).toBe(0);
    expect(output.valid).toBe(true);
    expect(output.errors).toHaveLength(0);
    expect(output.configPath).toContain("cmc.toml");
  });
});

describe("cmc validate - invalid configs", () => {
  it("rejects invalid TOML syntax and exits 2", async () => {
    const result = await run("validate/invalid-toml", ["validate"]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain("validation error");
  });

  it("rejects schema violations and exits 2", async () => {
    const result = await run("validate/invalid-schema", ["validate"]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain("validation error");
  });

  it("outputs JSON errors for invalid config", async () => {
    const result = await run("validate/invalid-schema", ["validate", "--json"]);
    const output = JSON.parse(result.stdout) as ValidateJsonOutput;

    expect(result.exitCode).toBe(2);
    expect(output.valid).toBe(false);
    expect(output.errors.length).toBeGreaterThan(0);
  });

  it("shows verbose error details with --verbose flag", async () => {
    const result = await run("validate/invalid-schema", [
      "validate",
      "--verbose",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain("Path:");
    expect(result.stdout).toContain("Error:");
  });
});

describe("cmc validate - specific path", () => {
  it("validates config at specific path", async () => {
    const result = await run("validate/valid-minimal", [
      "validate",
      "cmc.toml",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("is valid");
  });
});

describe("cmc validate - extends validation", () => {
  it("rejects unknown keys in extends section", async () => {
    const result = await run("validate/invalid-extends-keys", ["validate"]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain("validation error");
  });

  it("outputs JSON errors for unknown extends keys", async () => {
    const result = await run("validate/invalid-extends-keys", [
      "validate",
      "--json",
    ]);
    const output = JSON.parse(result.stdout) as ValidateJsonOutput;

    expect(result.exitCode).toBe(2);
    expect(output.valid).toBe(false);
    expect(output.errors.length).toBeGreaterThan(0);
    // Should have additionalProperties errors for unknown keys
    const hasExpectedError = output.errors.some(
      (e) =>
        e.keyword === "additionalProperties" ||
        e.message?.includes("unknown property"),
    );
    expect(hasExpectedError).toBe(true);
  });
});
