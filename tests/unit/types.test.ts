/**
 * Unit tests for types.ts
 *
 * This file contains type definitions and constants.
 * We test the constants to ensure they are correctly defined.
 */

import { describe, expect, it } from "vitest";

import {
  AI_TARGET_FILES,
  DEFAULT_AI_CONTEXT_SOURCE,
  ExitCode,
} from "../../src/types.js";

describe("ExitCode", () => {
  it("defines SUCCESS as 0", () => {
    expect(ExitCode.SUCCESS).toBe(0);
  });

  it("defines VIOLATIONS as 1", () => {
    expect(ExitCode.VIOLATIONS).toBe(1);
  });

  it("defines CONFIG_ERROR as 2", () => {
    expect(ExitCode.CONFIG_ERROR).toBe(2);
  });

  it("defines RUNTIME_ERROR as 3", () => {
    expect(ExitCode.RUNTIME_ERROR).toBe(3);
  });

  it("has exactly 4 exit codes", () => {
    const codes = Object.keys(ExitCode);
    expect(codes).toHaveLength(4);
  });

  it("all exit codes are unique", () => {
    const values = Object.values(ExitCode);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

describe("AI_TARGET_FILES", () => {
  it("defines claude target file", () => {
    expect(AI_TARGET_FILES.claude).toBe("CLAUDE.md");
  });

  it("defines cursor target file", () => {
    expect(AI_TARGET_FILES.cursor).toBe(".cursorrules");
  });

  it("defines copilot target file", () => {
    expect(AI_TARGET_FILES.copilot).toBe(".github/copilot-instructions.md");
  });

  it("has exactly 3 targets", () => {
    const targets = Object.keys(AI_TARGET_FILES);
    expect(targets).toHaveLength(3);
    expect(targets).toContain("claude");
    expect(targets).toContain("cursor");
    expect(targets).toContain("copilot");
  });
});

describe("DEFAULT_AI_CONTEXT_SOURCE", () => {
  it("is a valid github remote reference", () => {
    expect(DEFAULT_AI_CONTEXT_SOURCE).toMatch(/^github:[^/]+\/[^/@]+/);
  });

  it("points to the community repository", () => {
    expect(DEFAULT_AI_CONTEXT_SOURCE).toContain("check-my-code-community");
  });

  it("includes the prompts path", () => {
    expect(DEFAULT_AI_CONTEXT_SOURCE).toContain("/prompts@");
  });

  it("uses @latest version", () => {
    expect(DEFAULT_AI_CONTEXT_SOURCE.endsWith("@latest")).toBe(true);
  });
});
