import { describe, expect, it } from "vitest";

import {
  type InheritedRules,
  mergeRulesets,
  RuleConflictError,
} from "../../src/remote/rulesets.js";

describe("rulesets", () => {
  describe("mergeRulesets", () => {
    describe("ESLint rules", () => {
      it("should return inherited rules when no local rules", () => {
        const inherited: InheritedRules = {
          eslint: {
            source: "github:org/repo@v1.0.0",
            rules: {
              "no-var": "error",
              "prefer-const": "error",
            },
          },
        };

        const result = mergeRulesets(inherited, undefined);

        expect(result.eslint?.rules).toEqual({
          "no-var": "error",
          "prefer-const": "error",
        });
      });

      it("should return local rules when no inherited rules", () => {
        const inherited: InheritedRules = {};
        const local = {
          eslint: {
            rules: {
              "no-console": "warn",
            },
          },
        };

        const result = mergeRulesets(inherited, local);

        expect(result.eslint?.rules).toEqual({
          "no-console": "warn",
        });
      });

      it("should merge inherited and local rules without conflict", () => {
        const inherited: InheritedRules = {
          eslint: {
            source: "github:org/repo@v1.0.0",
            rules: {
              "no-var": "error",
            },
          },
        };
        const local = {
          eslint: {
            rules: {
              "no-console": "warn",
            },
          },
        };

        const result = mergeRulesets(inherited, local);

        expect(result.eslint?.rules).toEqual({
          "no-var": "error",
          "no-console": "warn",
        });
      });

      it("should allow same value for inherited and local rule", () => {
        const inherited: InheritedRules = {
          eslint: {
            source: "github:org/repo@v1.0.0",
            rules: {
              "no-var": "error",
            },
          },
        };
        const local = {
          eslint: {
            rules: {
              "no-var": "error", // Same value - no conflict
            },
          },
        };

        const result = mergeRulesets(inherited, local);

        expect(result.eslint?.rules).toEqual({
          "no-var": "error",
        });
      });

      it("should throw RuleConflictError when local conflicts with inherited", () => {
        const inherited: InheritedRules = {
          eslint: {
            source: "github:org/repo@v1.0.0",
            rules: {
              "no-var": "error",
            },
          },
        };
        const local = {
          eslint: {
            rules: {
              "no-var": "warn", // Different value - conflict!
            },
          },
        };

        expect(() => mergeRulesets(inherited, local)).toThrow(
          RuleConflictError,
        );
      });

      it("should include details in RuleConflictError", () => {
        const inherited: InheritedRules = {
          eslint: {
            source: "github:org/repo@v1.0.0",
            rules: {
              "no-console": "error",
            },
          },
        };
        const local = {
          eslint: {
            rules: {
              "no-console": "off",
            },
          },
        };

        try {
          mergeRulesets(inherited, local);
          expect.fail("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(RuleConflictError);
          const e = error as RuleConflictError;
          expect(e.tool).toBe("eslint");
          expect(e.rule).toBe("no-console");
          expect(e.inheritedValue).toBe("error");
          expect(e.localValue).toBe("off");
          expect(e.source).toBe("github:org/repo@v1.0.0");
        }
      });

      it("should handle array rule values", () => {
        const inherited: InheritedRules = {
          eslint: {
            source: "github:org/repo@v1.0.0",
            rules: {
              "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            },
          },
        };
        const local = {
          eslint: {
            rules: {
              "no-console": "warn",
            },
          },
        };

        const result = mergeRulesets(inherited, local);

        expect(result.eslint?.rules).toEqual({
          "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
          "no-console": "warn",
        });
      });

      it("should detect conflict with array rule values", () => {
        const inherited: InheritedRules = {
          eslint: {
            source: "github:org/repo@v1.0.0",
            rules: {
              "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            },
          },
        };
        const local = {
          eslint: {
            rules: {
              "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            },
          },
        };

        expect(() => mergeRulesets(inherited, local)).toThrow(
          RuleConflictError,
        );
      });
    });

    describe("TSC config", () => {
      it("should return inherited config when no local config", () => {
        const inherited: InheritedRules = {
          tsc: {
            source: "github:org/repo@v1.0.0",
            config: {
              strict: true,
              noUncheckedIndexedAccess: true,
            },
          },
        };

        const result = mergeRulesets(inherited, undefined);

        expect(result.tsc).toEqual({
          strict: true,
          noUncheckedIndexedAccess: true,
        });
      });

      it("should merge inherited and local TSC config without conflict", () => {
        const inherited: InheritedRules = {
          tsc: {
            source: "github:org/repo@v1.0.0",
            config: {
              strict: true,
            },
          },
        };
        const local = {
          tsc: {
            noUncheckedIndexedAccess: true,
          },
        };

        const result = mergeRulesets(inherited, local);

        expect(result.tsc).toEqual({
          strict: true,
          noUncheckedIndexedAccess: true,
        });
      });

      it("should throw RuleConflictError when TSC options conflict", () => {
        const inherited: InheritedRules = {
          tsc: {
            source: "github:org/repo@v1.0.0",
            config: {
              strict: true,
            },
          },
        };
        const local = {
          tsc: {
            strict: false, // Conflict!
          },
        };

        expect(() => mergeRulesets(inherited, local)).toThrow(
          RuleConflictError,
        );
      });
    });

    describe("Ruff config", () => {
      it("should return inherited config when no local config", () => {
        const inherited: InheritedRules = {
          ruff: {
            source: "github:org/repo@v1.0.0",
            config: {
              "line-length": 100,
              lint: {
                select: ["E", "F"],
              },
            },
          },
        };

        const result = mergeRulesets(inherited, undefined);

        expect(result.ruff).toEqual({
          "line-length": 100,
          lint: {
            select: ["E", "F"],
          },
        });
      });

      it("should merge inherited and local Ruff config without conflict", () => {
        const inherited: InheritedRules = {
          ruff: {
            source: "github:org/repo@v1.0.0",
            config: {
              "line-length": 100,
            },
          },
        };
        const local = {
          ruff: {
            lint: {
              select: ["E", "F"],
            },
          },
        };

        const result = mergeRulesets(inherited, local);

        expect(result.ruff).toEqual({
          "line-length": 100,
          lint: {
            select: ["E", "F"],
          },
        });
      });

      it("should throw RuleConflictError when line-length conflicts", () => {
        const inherited: InheritedRules = {
          ruff: {
            source: "github:org/repo@v1.0.0",
            config: {
              "line-length": 100,
            },
          },
        };
        const local = {
          ruff: {
            "line-length": 120, // Conflict!
          },
        };

        expect(() => mergeRulesets(inherited, local)).toThrow(
          RuleConflictError,
        );
      });

      it("should throw RuleConflictError when lint.select conflicts", () => {
        const inherited: InheritedRules = {
          ruff: {
            source: "github:org/repo@v1.0.0",
            config: {
              lint: {
                select: ["E", "F"],
              },
            },
          },
        };
        const local = {
          ruff: {
            lint: {
              select: ["E"], // Different value - conflict!
            },
          },
        };

        expect(() => mergeRulesets(inherited, local)).toThrow(
          RuleConflictError,
        );
      });
    });

    describe("Multiple linters", () => {
      it("should merge all linter configs", () => {
        const inherited: InheritedRules = {
          eslint: {
            source: "github:org/repo@v1.0.0",
            rules: { "no-var": "error" },
          },
          tsc: {
            source: "github:org/repo@v1.0.0",
            config: { strict: true },
          },
          ruff: {
            source: "github:org/repo@v1.0.0",
            config: { "line-length": 100 },
          },
        };
        const local = {
          eslint: { rules: { "no-console": "warn" } },
          tsc: { noUncheckedIndexedAccess: true },
          ruff: { lint: { select: ["E"] } },
        };

        const result = mergeRulesets(inherited, local);

        expect(result.eslint?.rules).toEqual({
          "no-var": "error",
          "no-console": "warn",
        });
        expect(result.tsc).toEqual({
          strict: true,
          noUncheckedIndexedAccess: true,
        });
        expect(result.ruff).toEqual({
          "line-length": 100,
          lint: { select: ["E"] },
        });
      });

      it("should return empty object when no configs", () => {
        const result = mergeRulesets({}, undefined);
        expect(result).toEqual({});
      });
    });
  });

  describe("RuleConflictError", () => {
    it("should have correct error name", () => {
      const error = new RuleConflictError({
        tool: "eslint",
        rule: "no-var",
        inheritedValue: "error",
        localValue: "warn",
        source: "github:org/repo@v1.0.0",
      });
      expect(error.name).toBe("RuleConflictError");
    });

    it("should include helpful message", () => {
      const error = new RuleConflictError({
        tool: "eslint",
        rule: "no-var",
        inheritedValue: "error",
        localValue: "warn",
        source: "github:org/repo@v1.0.0",
      });
      expect(error.message).toContain("Config conflict detected");
      expect(error.message).toContain("no-var");
      expect(error.message).toContain("eslint");
      expect(error.message).toContain('"error"');
      expect(error.message).toContain('"warn"');
      expect(error.message).toContain("github:org/repo@v1.0.0");
      expect(error.message).toContain("To resolve:");
    });
  });
});
