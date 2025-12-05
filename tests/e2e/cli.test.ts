/**
 * E2E tests for CLI basics (--help, --version)
 */

import { describe, it, expect } from "vitest";
import { run } from "./runner.js";

describe("CLI basics", () => {
  it("--version outputs version number", async () => {
    const result = await run("check/typescript/default", ["--version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it("--help outputs usage information", async () => {
    const result = await run("check/typescript/default", ["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("check");
    expect(result.stdout).toContain("generate");
  });
});
