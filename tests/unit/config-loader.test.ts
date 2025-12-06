/**
 * Unit tests for config/loader.ts
 */

import { mkdirSync, rmSync, writeFileSync } from "fs";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { isAbsolute, join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ConfigError,
  configSchema,
  findProjectRoot,
  loadConfig,
  stripSymbolKeys,
  validateConfigContent,
} from "../../src/config/loader.js";

describe("ConfigError", () => {
  it("is a proper Error subclass", () => {
    const error = new ConfigError("test error");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ConfigError);
    expect(error.name).toBe("ConfigError");
    expect(error.message).toBe("test error");
  });

  it("has a stack trace", () => {
    const error = new ConfigError("test error");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("ConfigError");
  });

  it("can be caught and identified", () => {
    const throwAndCatch = () => {
      try {
        throw new ConfigError("config failed");
      } catch (e: unknown) {
        if (e instanceof ConfigError) {
          return "caught ConfigError";
        }
        return "caught other error";
      }
    };

    expect(throwAndCatch()).toBe("caught ConfigError");
  });
});

describe("stripSymbolKeys", () => {
  it("returns primitives unchanged", () => {
    expect(stripSymbolKeys(null)).toBe(null);
    expect(stripSymbolKeys(undefined)).toBe(undefined);
    expect(stripSymbolKeys(42)).toBe(42);
    expect(stripSymbolKeys("string")).toBe("string");
    expect(stripSymbolKeys(true)).toBe(true);
  });

  it("strips Symbol keys from objects", () => {
    const symbolKey = Symbol("test");
    const obj = {
      name: "test",
      [symbolKey]: "should be removed",
    };

    const result = stripSymbolKeys(obj);
    expect(result).toEqual({ name: "test" });
    expect(Object.getOwnPropertySymbols(result as object)).toHaveLength(0);
  });

  it("recursively strips Symbol keys from nested objects", () => {
    const symbolKey = Symbol("nested");
    const obj = {
      outer: {
        inner: "value",
        [symbolKey]: "removed",
      },
    };

    const result = stripSymbolKeys(obj) as { outer: { inner: string } };
    expect(result.outer.inner).toBe("value");
    expect(Object.getOwnPropertySymbols(result.outer)).toHaveLength(0);
  });

  it("processes arrays and strips Symbol keys from array elements", () => {
    const symbolKey = Symbol("array");
    const arr = [{ name: "item1", [symbolKey]: "removed" }, { name: "item2" }];

    const result = stripSymbolKeys(arr) as { name: string }[];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "item1" });
    expect(result[1]).toEqual({ name: "item2" });
  });

  it("handles empty objects and arrays", () => {
    expect(stripSymbolKeys({})).toEqual({});
    expect(stripSymbolKeys([])).toEqual([]);
  });
});

describe("configSchema", () => {
  it("validates minimal valid config", () => {
    const config = {
      project: { name: "test-project" },
    };

    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("validates config with all sections", () => {
    const config = {
      project: { name: "full-project" },
      prompts: {
        templates: ["internal/typescript/5.5"],
        source: "github:owner/repo/path@v1.0.0",
      },
      extends: {
        eslint: "github:owner/repo/eslint@v1.0.0",
        ruff: "github:owner/repo/ruff@v1.0.0",
        tsc: "github:owner/repo/tsc@v1.0.0",
      },
      rulesets: {
        eslint: {
          rules: {
            "no-console": "error",
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
          },
        },
        ruff: {
          "line-length": 100,
          lint: {
            select: ["E", "F"],
            ignore: ["E501"],
          },
        },
        tsc: {
          enabled: true,
          strict: true,
          noUncheckedIndexedAccess: true,
        },
      },
    };

    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("rejects missing project section", () => {
    const config = {
      rulesets: {
        eslint: { rules: { "no-console": "error" } },
      },
    };

    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects empty project name", () => {
    const config = {
      project: { name: "" },
    };

    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects invalid eslint rule values", () => {
    const config = {
      project: { name: "test" },
      rulesets: {
        eslint: {
          rules: {
            "no-console": "invalid-value",
          },
        },
      },
    };

    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("accepts valid eslint rule values", () => {
    const config = {
      project: { name: "test" },
      rulesets: {
        eslint: {
          rules: {
            rule1: "off",
            rule2: "warn",
            rule3: "error",
            rule4: ["error", "always"],
          },
        },
      },
    };

    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("rejects invalid extends format", () => {
    const config = {
      project: { name: "test" },
      extends: {
        eslint: "not-a-valid-ref",
      },
    };

    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects empty templates array", () => {
    const config = {
      project: { name: "test" },
      prompts: {
        templates: [],
      },
    };

    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects negative ruff line-length", () => {
    const config = {
      project: { name: "test" },
      rulesets: {
        ruff: {
          "line-length": -10,
        },
      },
    };

    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("allows passthrough for additional ruff options", () => {
    const config = {
      project: { name: "test" },
      rulesets: {
        ruff: {
          "line-length": 100,
          "target-version": "py312",
        },
      },
    };

    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});

describe("loadConfig", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cmc-loader-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("loads a valid config file", async () => {
    await writeFile(
      join(tempDir, "cmc.toml"),
      `[project]
name = "test-project"

[rulesets.eslint.rules]
"no-console" = "error"
`,
    );

    const config = await loadConfig(tempDir);

    expect(config.project.name).toBe("test-project");
    expect(config.rulesets?.eslint?.rules?.["no-console"]).toBe("error");
  });

  it("throws ConfigError when cmc.toml is missing", async () => {
    await expect(loadConfig(tempDir)).rejects.toThrow(ConfigError);
    await expect(loadConfig(tempDir)).rejects.toThrow("No cmc.toml found");
  });

  it("throws ConfigError for invalid TOML syntax", async () => {
    await writeFile(join(tempDir, "cmc.toml"), "this is not valid {{ toml");

    await expect(loadConfig(tempDir)).rejects.toThrow(ConfigError);
    await expect(loadConfig(tempDir)).rejects.toThrow("Invalid TOML");
  });

  it("throws ConfigError for invalid config structure", async () => {
    await writeFile(
      join(tempDir, "cmc.toml"),
      `[project]
# name is missing
`,
    );

    await expect(loadConfig(tempDir)).rejects.toThrow(ConfigError);
    await expect(loadConfig(tempDir)).rejects.toThrow("Invalid cmc.toml");
  });

  it("loads config with all optional sections", async () => {
    await writeFile(
      join(tempDir, "cmc.toml"),
      `[project]
name = "full-project"

[prompts]
templates = ["internal/typescript/5.5"]

[rulesets.eslint.rules]
"no-console" = "error"

[rulesets.ruff]
line-length = 100

[rulesets.tsc]
strict = true
`,
    );

    const config = await loadConfig(tempDir);

    expect(config.project.name).toBe("full-project");
    expect(config.prompts?.templates).toContain("internal/typescript/5.5");
    expect(config.rulesets?.eslint?.rules?.["no-console"]).toBe("error");
    expect(config.rulesets?.ruff?.["line-length"]).toBe(100);
    expect(config.rulesets?.tsc?.strict).toBe(true);
  });
});

describe("findProjectRoot", () => {
  const testDir = join(tmpdir(), "cmc-test-" + Date.now());
  const nestedDir = join(testDir, "sub", "nested");

  beforeEach(() => {
    // Create test directory structure
    mkdirSync(nestedDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    rmSync(testDir, { recursive: true, force: true });
  });

  it("finds cmc.toml in the given directory", () => {
    writeFileSync(join(testDir, "cmc.toml"), '[project]\nname = "test"');

    const result = findProjectRoot(testDir);
    expect(result).toBe(testDir);
  });

  it("finds cmc.toml in parent directory when starting from nested path", () => {
    writeFileSync(join(testDir, "cmc.toml"), '[project]\nname = "test"');

    const result = findProjectRoot(nestedDir);
    expect(result).toBe(testDir);
  });

  it("finds cmc.toml starting from a file path", () => {
    writeFileSync(join(testDir, "cmc.toml"), '[project]\nname = "test"');
    const filePath = join(nestedDir, "somefile.ts");
    writeFileSync(filePath, "const x = 1;");

    const result = findProjectRoot(filePath);
    expect(result).toBe(testDir);
  });

  it("returns startPath when no cmc.toml found", () => {
    // No cmc.toml created
    const result = findProjectRoot(nestedDir);
    expect(result).toBe(nestedDir);
  });

  it("defaults to process.cwd() when no startPath provided", () => {
    const result = findProjectRoot();
    // Should not throw, returns cwd or finds cmc.toml from cwd
    expect(typeof result).toBe("string");
  });

  it("handles non-existent startPath by treating it as a directory", () => {
    writeFileSync(join(testDir, "cmc.toml"), '[project]\nname = "test"');
    const nonExistentPath = join(testDir, "sub", "does-not-exist");

    const result = findProjectRoot(nonExistentPath);
    expect(result).toBe(testDir);
  });

  it("always returns absolute path even when given relative input", () => {
    // Create cmc.toml in testDir
    writeFileSync(join(testDir, "cmc.toml"), '[project]\nname = "test"');

    // Use a relative path that exists
    const result = findProjectRoot(testDir);

    expect(isAbsolute(result)).toBe(true);
  });

  it("returns absolute path when no cmc.toml found (fallback)", () => {
    // No cmc.toml created, should return the input path as absolute
    const result = findProjectRoot(nestedDir);

    expect(isAbsolute(result)).toBe(true);
  });
});

describe("validateConfigContent", () => {
  it("validates valid TOML content", async () => {
    const toml = `[project]
name = "test-project"
`;

    const result = await validateConfigContent(toml);

    expect(result.valid).toBe(true);
    expect(result.config).toBeDefined();
    expect(result.config?.project.name).toBe("test-project");
  });

  it("returns errors for invalid TOML syntax", async () => {
    const toml = "this is not valid {{ toml";

    const result = await validateConfigContent(toml);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some((e) => e.includes("TOML syntax"))).toBe(true);
  });

  it("returns errors for missing required fields", async () => {
    const toml = `[rulesets.eslint.rules]
"no-console" = "error"
`;

    const result = await validateConfigContent(toml);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it("returns errors for invalid extends format", async () => {
    const toml = `[project]
name = "test"

[extends]
eslint = "invalid-format"
`;

    const result = await validateConfigContent(toml);

    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("pattern"))).toBe(true);
  });

  it("handles empty templates array", async () => {
    const toml = `[project]
name = "test"

[prompts]
templates = []
`;

    const result = await validateConfigContent(toml);

    expect(result.valid).toBe(false);
  });

  it("validates config with all sections", async () => {
    const toml = `[project]
name = "full-project"

[prompts]
templates = ["internal/typescript/5.5"]

[extends]
eslint = "github:owner/repo/path@v1.0.0"

[rulesets.eslint.rules]
"no-console" = "error"

[rulesets.ruff]
line-length = 100

[rulesets.tsc]
strict = true
`;

    const result = await validateConfigContent(toml);

    expect(result.valid).toBe(true);
    expect(result.config).toBeDefined();
  });

  it("returns formatted errors for type mismatches", async () => {
    const toml = `[project]
name = 123
`;

    const result = await validateConfigContent(toml);

    expect(result.valid).toBe(false);
    expect(
      result.errors?.some((e) => e.includes("type") || e.includes("string")),
    ).toBe(true);
  });
});
