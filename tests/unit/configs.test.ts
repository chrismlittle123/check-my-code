import { describe, expect, it } from "vitest";

import {
  ConfigFetchError,
  type ConfigsManifest,
  getConfigEntry,
  getVersionFilePath,
  parseManifestJson,
  resolveLatestVersion,
  validateClaudeSettings,
  validateManifest,
} from "../../src/remote/configs.js";

describe("configs", () => {
  describe("ConfigFetchError", () => {
    it("should have correct error name", () => {
      const error = new ConfigFetchError("Test error");
      expect(error.name).toBe("ConfigFetchError");
    });

    it("should include error message", () => {
      const error = new ConfigFetchError("Failed to fetch configs");
      expect(error.message).toBe("Failed to fetch configs");
    });

    it("should be instanceof Error", () => {
      const error = new ConfigFetchError("Test");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("parseManifestJson", () => {
    it("should parse valid JSON", () => {
      const result = parseManifestJson('{"key": "value"}');
      expect(result).toEqual({ key: "value" });
    });

    it("should throw ConfigFetchError for invalid JSON", () => {
      expect(() => parseManifestJson("invalid json")).toThrow(ConfigFetchError);
      expect(() => parseManifestJson("invalid json")).toThrow(
        "Invalid configs.json manifest: JSON parse error",
      );
    });
  });

  describe("validateManifest", () => {
    it("should validate a correct manifest", () => {
      const manifest = {
        schema_version: "1.0.0",
        configs: {
          "claude-code": {
            tool: "claude",
            versions: {
              latest: "1.0.0",
              "1.0.0": { file: "claude-code/1.0.0.json" },
            },
          },
        },
      };
      const result = validateManifest(manifest);
      expect(result.schema_version).toBe("1.0.0");
      expect(result.configs["claude-code"]).toBeDefined();
    });

    it("should throw ConfigFetchError for invalid manifest", () => {
      const invalid = { not_valid: true };
      expect(() => validateManifest(invalid)).toThrow(ConfigFetchError);
      expect(() => validateManifest(invalid)).toThrow(
        "Invalid configs.json manifest",
      );
    });
  });

  describe("getConfigEntry", () => {
    const manifest: ConfigsManifest = {
      schema_version: "1.0.0",
      configs: {
        "claude-code": {
          tool: "claude",
          versions: {
            latest: "1.0.0",
            "1.0.0": { file: "claude-code/1.0.0.json" },
          },
        },
      },
    };

    it("should return config entry when found", () => {
      const entry = getConfigEntry(manifest, "claude-code");
      expect(entry.tool).toBe("claude");
    });

    it("should throw ConfigFetchError when config not found", () => {
      expect(() => getConfigEntry(manifest, "nonexistent")).toThrow(
        ConfigFetchError,
      );
      expect(() => getConfigEntry(manifest, "nonexistent")).toThrow(
        "Config not found in manifest: nonexistent",
      );
    });

    it("should list available configs in error message", () => {
      try {
        getConfigEntry(manifest, "nonexistent");
      } catch (error) {
        expect((error as Error).message).toContain("claude-code");
      }
    });
  });

  describe("resolveLatestVersion", () => {
    it("should resolve latest version pointer", () => {
      const entry = {
        tool: "claude",
        versions: {
          latest: "1.0.0",
          "1.0.0": { file: "claude-code/1.0.0.json" },
        },
      };
      const result = resolveLatestVersion(entry, "claude-code");
      expect(result).toBe("1.0.0");
    });

    it("should throw when no latest version defined", () => {
      const entry = {
        tool: "claude",
        versions: {
          "1.0.0": { file: "claude-code/1.0.0.json" },
        },
      };
      expect(() => resolveLatestVersion(entry, "claude-code")).toThrow(
        ConfigFetchError,
      );
      expect(() => resolveLatestVersion(entry, "claude-code")).toThrow(
        'No "latest" version defined',
      );
    });

    it("should throw when latest is not a string pointer", () => {
      const entry = {
        tool: "claude",
        versions: {
          latest: { file: "wrong.json" },
          "1.0.0": { file: "claude-code/1.0.0.json" },
        },
      };
      expect(() => resolveLatestVersion(entry, "claude-code")).toThrow(
        ConfigFetchError,
      );
    });
  });

  describe("getVersionFilePath", () => {
    const entry = {
      tool: "claude",
      versions: {
        latest: "1.0.0",
        "1.0.0": { file: "claude-code/1.0.0.json" },
        "0.9.0": "invalid-string-pointer",
      },
    };

    it("should return file path for valid version", () => {
      const result = getVersionFilePath(entry, "1.0.0", "claude-code");
      expect(result).toBe("claude-code/1.0.0.json");
    });

    it("should throw when version not found", () => {
      expect(() => getVersionFilePath(entry, "2.0.0", "claude-code")).toThrow(
        ConfigFetchError,
      );
      expect(() => getVersionFilePath(entry, "2.0.0", "claude-code")).toThrow(
        "Version not found: 2.0.0",
      );
    });

    it("should throw when version entry is string (invalid)", () => {
      expect(() => getVersionFilePath(entry, "0.9.0", "claude-code")).toThrow(
        ConfigFetchError,
      );
      expect(() => getVersionFilePath(entry, "0.9.0", "claude-code")).toThrow(
        "Invalid version entry for 0.9.0",
      );
    });
  });

  describe("validateClaudeSettings", () => {
    it("should validate valid Claude settings", () => {
      const settings = {
        permissions: {
          allow: ["Bash(npm run build:*)"],
          deny: ["Bash(rm -rf *)"],
        },
        env: {
          NODE_ENV: "development",
        },
      };
      const result = validateClaudeSettings(settings);
      expect(result.permissions?.allow).toEqual(["Bash(npm run build:*)"]);
      expect(result.permissions?.deny).toEqual(["Bash(rm -rf *)"]);
      expect(result.env).toEqual({ NODE_ENV: "development" });
    });

    it("should validate settings with only permissions", () => {
      const settings = {
        permissions: {
          allow: ["WebSearch"],
        },
      };
      const result = validateClaudeSettings(settings);
      expect(result.permissions?.allow).toEqual(["WebSearch"]);
      expect(result.env).toBeUndefined();
    });

    it("should validate settings with $schema", () => {
      const settings = {
        $schema: "https://example.com/schema.json",
        permissions: {
          allow: [],
        },
      };
      const result = validateClaudeSettings(settings);
      expect(result.$schema).toBe("https://example.com/schema.json");
    });

    it("should validate empty settings object", () => {
      const result = validateClaudeSettings({});
      expect(result).toEqual({});
    });

    it("should throw ConfigFetchError for invalid permissions type", () => {
      const invalid = {
        permissions: "not-an-object",
      };
      expect(() => validateClaudeSettings(invalid)).toThrow(ConfigFetchError);
      expect(() => validateClaudeSettings(invalid)).toThrow(
        "Invalid Claude settings",
      );
    });

    it("should throw ConfigFetchError for invalid allow array type", () => {
      const invalid = {
        permissions: {
          allow: [123, 456],
        },
      };
      expect(() => validateClaudeSettings(invalid)).toThrow(ConfigFetchError);
    });

    it("should throw ConfigFetchError for invalid env type", () => {
      const invalid = {
        env: ["not", "an", "object"],
      };
      expect(() => validateClaudeSettings(invalid)).toThrow(ConfigFetchError);
    });
  });
});
