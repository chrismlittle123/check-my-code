/**
 * Unit tests for cli/output.ts
 * Tests color formatting functions and environment variable handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We need to reset modules between tests to pick up env var changes
describe("colors", () => {
  const originalEnv = { ...process.env };
  const originalIsTTY = process.stdout.isTTY;

  beforeEach(() => {
    // Reset modules to pick up fresh env vars
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
    });
  });

  describe("when colors are enabled (TTY)", () => {
    beforeEach(() => {
      delete process.env.NO_COLOR;
      delete process.env.FORCE_COLOR;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
      });
    });

    it("red() wraps text with red ANSI code", async () => {
      const { colors } = await import("../../src/cli/output.js");
      expect(colors.red("error")).toBe("\x1b[31merror\x1b[0m");
    });

    it("green() wraps text with green ANSI code", async () => {
      const { colors } = await import("../../src/cli/output.js");
      expect(colors.green("success")).toBe("\x1b[32msuccess\x1b[0m");
    });

    it("yellow() wraps text with yellow ANSI code", async () => {
      const { colors } = await import("../../src/cli/output.js");
      expect(colors.yellow("warning")).toBe("\x1b[33mwarning\x1b[0m");
    });

    it("cyan() wraps text with cyan ANSI code", async () => {
      const { colors } = await import("../../src/cli/output.js");
      expect(colors.cyan("file.ts")).toBe("\x1b[36mfile.ts\x1b[0m");
    });

    it("dim() wraps text with dim/gray ANSI code", async () => {
      const { colors } = await import("../../src/cli/output.js");
      expect(colors.dim("linter/rule")).toBe("\x1b[90mlinter/rule\x1b[0m");
    });
  });

  describe("when NO_COLOR is set", () => {
    beforeEach(() => {
      process.env.NO_COLOR = "1";
      delete process.env.FORCE_COLOR;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
      });
    });

    it("returns plain text without ANSI codes", async () => {
      const { colors } = await import("../../src/cli/output.js");
      expect(colors.red("error")).toBe("error");
      expect(colors.green("success")).toBe("success");
      expect(colors.yellow("warning")).toBe("warning");
      expect(colors.cyan("file.ts")).toBe("file.ts");
      expect(colors.dim("linter/rule")).toBe("linter/rule");
    });

    it("colorsEnabled() returns false", async () => {
      const { colorsEnabled } = await import("../../src/cli/output.js");
      expect(colorsEnabled()).toBe(false);
    });
  });

  describe("when NO_COLOR is empty string", () => {
    beforeEach(() => {
      process.env.NO_COLOR = "";
      delete process.env.FORCE_COLOR;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
      });
    });

    it("still disables colors (any value counts)", async () => {
      const { colors } = await import("../../src/cli/output.js");
      // Per no-color.org spec: "When set, regardless of the value, it should disable colors"
      // But the code checks for `!== undefined`, so empty string still disables
      expect(colors.red("error")).toBe("error");
    });
  });

  describe("when FORCE_COLOR is set", () => {
    beforeEach(() => {
      process.env.FORCE_COLOR = "1";
      delete process.env.NO_COLOR;
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        writable: true,
      });
    });

    it("enables colors even when not a TTY", async () => {
      const { colors } = await import("../../src/cli/output.js");
      expect(colors.red("error")).toBe("\x1b[31merror\x1b[0m");
    });

    it("colorsEnabled() returns true", async () => {
      const { colorsEnabled } = await import("../../src/cli/output.js");
      expect(colorsEnabled()).toBe(true);
    });
  });

  describe("when FORCE_COLOR takes precedence over NO_COLOR", () => {
    beforeEach(() => {
      process.env.FORCE_COLOR = "1";
      process.env.NO_COLOR = "1";
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        writable: true,
      });
    });

    it("enables colors when both are set", async () => {
      const { colors } = await import("../../src/cli/output.js");
      expect(colors.red("error")).toBe("\x1b[31merror\x1b[0m");
    });
  });

  describe("when not a TTY (piped output)", () => {
    beforeEach(() => {
      delete process.env.NO_COLOR;
      delete process.env.FORCE_COLOR;
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        writable: true,
      });
    });

    it("returns plain text without ANSI codes", async () => {
      const { colors } = await import("../../src/cli/output.js");
      expect(colors.red("error")).toBe("error");
    });

    it("colorsEnabled() returns false", async () => {
      const { colorsEnabled } = await import("../../src/cli/output.js");
      expect(colorsEnabled()).toBe(false);
    });
  });

  describe("when TTY is undefined", () => {
    beforeEach(() => {
      delete process.env.NO_COLOR;
      delete process.env.FORCE_COLOR;
      Object.defineProperty(process.stdout, "isTTY", {
        value: undefined,
        writable: true,
      });
    });

    it("returns plain text (defaults to no colors)", async () => {
      const { colors } = await import("../../src/cli/output.js");
      expect(colors.red("error")).toBe("error");
    });
  });
});
