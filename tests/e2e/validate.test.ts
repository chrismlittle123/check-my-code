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

describe("cmc validate - rulesets validation", () => {
  it("rejects unknown linter names in rulesets section", async () => {
    const result = await run("validate/invalid-rulesets-keys", ["validate"]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain("validation error");
  });

  it("outputs JSON errors for unknown linter names", async () => {
    const result = await run("validate/invalid-rulesets-keys", [
      "validate",
      "--json",
    ]);
    const output = JSON.parse(result.stdout) as ValidateJsonOutput;

    expect(result.exitCode).toBe(2);
    expect(output.valid).toBe(false);
    expect(output.errors.length).toBeGreaterThan(0);
    // Should have additionalProperties errors for unknown linter
    const hasExpectedError = output.errors.some(
      (e) =>
        e.keyword === "additionalProperties" ||
        e.message?.includes("unknown property") ||
        e.message?.includes("invalidlinter"),
    );
    expect(hasExpectedError).toBe(true);
  });
});

describe("cmc validate - files validation", () => {
  it("accepts valid files section with include/exclude", async () => {
    const result = await run("validate/valid-files", ["validate"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("is valid");
  });

  it("rejects unknown keys in files section", async () => {
    const result = await run("validate/invalid-files-keys", ["validate"]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain("validation error");
  });

  it("outputs JSON errors for unknown files keys", async () => {
    const result = await run("validate/invalid-files-keys", [
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

describe("cmc validate - prompts template validation", () => {
  it("rejects invalid template format", async () => {
    const result = await run("validate/invalid-prompts-format", ["validate"]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain("validation error");
    expect(result.stdout).toContain("pattern");
  });

  it("accepts valid template format", async () => {
    const result = await run("validate/valid-prompts", ["validate"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("is valid");
  });

  it("provides helpful error message for invalid template", async () => {
    const result = await run("validate/invalid-prompts-format", [
      "validate",
      "--json",
    ]);
    const output = JSON.parse(result.stdout) as ValidateJsonOutput;

    expect(result.exitCode).toBe(2);
    expect(output.valid).toBe(false);
    expect(output.errors.length).toBeGreaterThan(0);
    // Should have pattern error for invalid template format
    const hasPatternError = output.errors.some(
      (e) => e.keyword === "pattern" || e.message?.includes("pattern"),
    );
    expect(hasPatternError).toBe(true);
  });
});

// =============================================================================
// Validate: Requirements configuration
// =============================================================================
describe("cmc validate - requirements configuration", () => {
  it("accepts valid requirements configuration", async () => {
    const result = await run("validate/valid-requirements", ["validate"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("is valid");
  });

  it("rejects invalid tool name in requirements.tools", async () => {
    const result = await run("validate/invalid-requirements-tool", [
      "validate",
      "--json",
    ]);
    const output = JSON.parse(result.stdout) as ValidateJsonOutput;

    expect(result.exitCode).toBe(2);
    expect(output.valid).toBe(false);
    // Should have enum error for invalid tool name
    const hasEnumError = output.errors.some(
      (e) => e.keyword === "enum" || e.message?.includes("enum"),
    );
    expect(hasEnumError).toBe(true);
  });
});
