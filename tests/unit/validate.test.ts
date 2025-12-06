/**
 * Unit tests for validate command
 */

import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock process.exit to prevent test process from exiting
vi.mock("process", async () => {
  const actual = await vi.importActual("process");
  return {
    ...actual,
    exit: vi.fn(),
  };
});

describe("validate command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cmc-validate-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("valid configs", () => {
    it("validates minimal valid config", async () => {
      const configPath = join(tempDir, "cmc.toml");
      await writeFile(
        configPath,
        `[project]
name = "test-project"
`,
      );

      const { validateConfig } = await import("./validate-helpers.js");
      const result = await validateConfig(configPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates config with all sections", async () => {
      const configPath = join(tempDir, "cmc.toml");
      await writeFile(
        configPath,
        `[project]
name = "full-project"

[prompts]
templates = ["typescript/5.5"]

[rulesets.eslint.rules]
"no-console" = "error"

[rulesets.ruff]
line-length = 100
`,
      );

      const { validateConfig } = await import("./validate-helpers.js");
      const result = await validateConfig(configPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates config with extends", async () => {
      const configPath = join(tempDir, "cmc.toml");
      await writeFile(
        configPath,
        `[project]
name = "extended-project"

[extends]
eslint = "github:owner/repo/path@v1.0.0"
`,
      );

      const { validateConfig } = await import("./validate-helpers.js");
      const result = await validateConfig(configPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("invalid configs", () => {
    it("rejects missing project section", async () => {
      const configPath = join(tempDir, "cmc.toml");
      await writeFile(
        configPath,
        `[rulesets.eslint.rules]
"no-console" = "error"
`,
      );

      const { validateConfig } = await import("./validate-helpers.js");
      const result = await validateConfig(configPath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes("project"))).toBe(
        true,
      );
    });

    it("rejects missing project name", async () => {
      const configPath = join(tempDir, "cmc.toml");
      await writeFile(
        configPath,
        `[project]
# name is missing
`,
      );

      const { validateConfig } = await import("./validate-helpers.js");
      const result = await validateConfig(configPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("name"))).toBe(true);
    });

    it("rejects empty project name", async () => {
      const configPath = join(tempDir, "cmc.toml");
      await writeFile(
        configPath,
        `[project]
name = ""
`,
      );

      const { validateConfig } = await import("./validate-helpers.js");
      const result = await validateConfig(configPath);

      expect(result.valid).toBe(false);
    });

    it("rejects invalid extends format", async () => {
      const configPath = join(tempDir, "cmc.toml");
      await writeFile(
        configPath,
        `[project]
name = "test"

[extends]
eslint = "invalid-format"
`,
      );

      const { validateConfig } = await import("./validate-helpers.js");
      const result = await validateConfig(configPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("pattern"))).toBe(
        true,
      );
    });

    it("rejects invalid TOML syntax", async () => {
      const configPath = join(tempDir, "cmc.toml");
      await writeFile(configPath, `this is not valid toml {{{{`);

      const { validateConfig } = await import("./validate-helpers.js");
      const result = await validateConfig(configPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("TOML syntax"))).toBe(
        true,
      );
    });

    it("rejects empty templates array", async () => {
      const configPath = join(tempDir, "cmc.toml");
      await writeFile(
        configPath,
        `[project]
name = "test"

[prompts]
templates = []
`,
      );

      const { validateConfig } = await import("./validate-helpers.js");
      const result = await validateConfig(configPath);

      expect(result.valid).toBe(false);
    });

    it("rejects invalid prompts source format", async () => {
      const configPath = join(tempDir, "cmc.toml");
      await writeFile(
        configPath,
        `[project]
name = "test"

[prompts]
templates = ["typescript"]
source = "not-a-valid-source"
`,
      );

      const { validateConfig } = await import("./validate-helpers.js");
      const result = await validateConfig(configPath);

      expect(result.valid).toBe(false);
    });

    it("rejects negative line-length", async () => {
      const configPath = join(tempDir, "cmc.toml");
      await writeFile(
        configPath,
        `[project]
name = "test"

[rulesets.ruff]
line-length = -10
`,
      );

      const { validateConfig } = await import("./validate-helpers.js");
      const result = await validateConfig(configPath);

      expect(result.valid).toBe(false);
    });
  });

  describe("file not found", () => {
    it("throws error for non-existent file", async () => {
      const { validateConfig } = await import("./validate-helpers.js");

      await expect(
        validateConfig("/nonexistent/path/cmc.toml"),
      ).rejects.toThrow("not found");
    });
  });
});
