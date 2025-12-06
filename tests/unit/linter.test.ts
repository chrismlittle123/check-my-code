/**
 * Unit tests for linter.ts
 * BUG-003: Tests for linter error propagation
 */

import { describe, expect, it } from "vitest";

import { LinterError } from "../../src/linter.js";

describe("LinterError", () => {
  it("is a proper Error subclass", () => {
    const error = new LinterError("test error");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(LinterError);
    expect(error.name).toBe("LinterError");
    expect(error.message).toBe("test error");
  });

  it("has a stack trace", () => {
    const error = new LinterError("test error");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("LinterError");
  });

  it("can be caught and identified", () => {
    const throwAndCatch = () => {
      try {
        throw new LinterError("linter failed");
      } catch (e: unknown) {
        if (e instanceof LinterError) {
          return "caught LinterError";
        }
        return "caught other error";
      }
    };

    expect(throwAndCatch()).toBe("caught LinterError");
  });
});
