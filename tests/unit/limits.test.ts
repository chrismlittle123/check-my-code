import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  checkLimits,
  hasLimitsConfig,
  limitsViolationsToViolations,
} from "../../src/limits/index.js";
import { analyzeTypeScriptFile } from "../../src/limits/typescript.js";
import type { Config } from "../../src/types.js";

describe("limits", () => {
  describe("hasLimitsConfig", () => {
    it("returns false when no rulesets", () => {
      const config: Config = {
        project: { name: "test" },
      };
      expect(hasLimitsConfig(config)).toBe(false);
    });

    it("returns false when no limits in rulesets", () => {
      const config: Config = {
        project: { name: "test" },
        rulesets: {
          eslint: { rules: { "no-console": "error" } },
        },
      };
      expect(hasLimitsConfig(config)).toBe(false);
    });

    it("returns false when limits is empty", () => {
      const config: Config = {
        project: { name: "test" },
        rulesets: {
          limits: {},
        },
      };
      expect(hasLimitsConfig(config)).toBe(false);
    });

    it("returns true when max_file_lines is set", () => {
      const config: Config = {
        project: { name: "test" },
        rulesets: {
          limits: { max_file_lines: 500 },
        },
      };
      expect(hasLimitsConfig(config)).toBe(true);
    });

    it("returns true when max_function_lines is set", () => {
      const config: Config = {
        project: { name: "test" },
        rulesets: {
          limits: { max_function_lines: 50 },
        },
      };
      expect(hasLimitsConfig(config)).toBe(true);
    });

    it("returns true when max_parameters is set", () => {
      const config: Config = {
        project: { name: "test" },
        rulesets: {
          limits: { max_parameters: 5 },
        },
      };
      expect(hasLimitsConfig(config)).toBe(true);
    });

    it("returns true when max_nesting_depth is set", () => {
      const config: Config = {
        project: { name: "test" },
        rulesets: {
          limits: { max_nesting_depth: 4 },
        },
      };
      expect(hasLimitsConfig(config)).toBe(true);
    });
  });

  describe("limitsViolationsToViolations", () => {
    it("converts limit violations to standard violations", () => {
      const limitViolations = [
        {
          file: "src/test.ts",
          line: 10,
          column: 1,
          message: "Function 'foo' has 60 lines (max: 50)",
          rule: "limits/max-function-lines" as const,
          functionName: "foo",
        },
      ];

      const violations = limitsViolationsToViolations(limitViolations);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toEqual({
        file: "src/test.ts",
        line: 10,
        column: 1,
        message: "Function 'foo' has 60 lines (max: 50)",
        rule: "limits/max-function-lines",
        linter: "limits",
      });
    });

    it("handles empty array", () => {
      const violations = limitsViolationsToViolations([]);
      expect(violations).toHaveLength(0);
    });
  });
});

describe("TypeScript analyzer", () => {
  describe("analyzeTypeScriptFile", () => {
    it("counts total lines", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "limits-test-"));
      const filePath = join(tmpDir, "test.ts");

      writeFileSync(
        filePath,
        `// Line 1
// Line 2
// Line 3
function foo() {
  return 1;
}
// Line 7
`,
      );

      const result = analyzeTypeScriptFile(filePath);
      expect(result.totalLines).toBe(8);

      rmSync(tmpDir, { recursive: true });
    });

    it("extracts function info", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "limits-test-"));
      const filePath = join(tmpDir, "test.ts");

      writeFileSync(
        filePath,
        `function foo(a: string, b: number) {
  return a + b;
}
`,
      );

      const result = analyzeTypeScriptFile(filePath);
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]?.name).toBe("foo");
      expect(result.functions[0]?.parameterCount).toBe(2);
      expect(result.functions[0]?.lineCount).toBe(3);

      rmSync(tmpDir, { recursive: true });
    });

    it("handles arrow functions assigned to variables", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "limits-test-"));
      const filePath = join(tmpDir, "test.ts");

      writeFileSync(
        filePath,
        `const bar = (x: number, y: number, z: number) => {
  return x + y + z;
};
`,
      );

      const result = analyzeTypeScriptFile(filePath);
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]?.name).toBe("bar");
      expect(result.functions[0]?.parameterCount).toBe(3);

      rmSync(tmpDir, { recursive: true });
    });

    it("calculates nesting depth", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "limits-test-"));
      const filePath = join(tmpDir, "test.ts");

      writeFileSync(
        filePath,
        `function nested(a: boolean, b: boolean) {
  if (a) {
    if (b) {
      console.log("deep");
    }
  }
}
`,
      );

      const result = analyzeTypeScriptFile(filePath);
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]?.maxNestingDepth).toBe(2);

      rmSync(tmpDir, { recursive: true });
    });

    it("excludes this parameter from count", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "limits-test-"));
      const filePath = join(tmpDir, "test.ts");

      writeFileSync(
        filePath,
        `class Foo {
  method(this: Foo, a: string) {
    return a;
  }
}
`,
      );

      const result = analyzeTypeScriptFile(filePath);
      const method = result.functions.find((f) => f.name === "method");
      expect(method?.parameterCount).toBe(1);

      rmSync(tmpDir, { recursive: true });
    });
  });
});

describe("checkLimits", () => {
  it("detects max_file_lines violation", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "limits-test-"));
    const filePath = join(tmpDir, "large.ts");

    const lines = Array(15).fill("// line").join("\n");
    writeFileSync(filePath, lines);

    const violations = await checkLimits(tmpDir, ["large.ts"], {
      max_file_lines: 10,
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe("limits/max-file-lines");
    expect(violations[0]?.message).toContain("15 lines");
    expect(violations[0]?.message).toContain("max: 10");

    rmSync(tmpDir, { recursive: true });
  });

  it("detects max_function_lines violation", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "limits-test-"));
    const filePath = join(tmpDir, "long-func.ts");

    writeFileSync(
      filePath,
      `function longFunction() {
  const a = 1;
  const b = 2;
  const c = 3;
  const d = 4;
  const e = 5;
  const f = 6;
  return a + b + c + d + e + f;
}
`,
    );

    const violations = await checkLimits(tmpDir, ["long-func.ts"], {
      max_function_lines: 5,
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe("limits/max-function-lines");
    expect(violations[0]?.functionName).toBe("longFunction");

    rmSync(tmpDir, { recursive: true });
  });

  it("detects max_parameters violation", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "limits-test-"));
    const filePath = join(tmpDir, "many-params.ts");

    writeFileSync(
      filePath,
      `function manyParams(a: number, b: number, c: number, d: number, e: number, f: number) {
  return a + b + c + d + e + f;
}
`,
    );

    const violations = await checkLimits(tmpDir, ["many-params.ts"], {
      max_parameters: 4,
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe("limits/max-parameters");
    expect(violations[0]?.message).toContain("6 parameters");
    expect(violations[0]?.message).toContain("max: 4");

    rmSync(tmpDir, { recursive: true });
  });

  it("detects max_nesting_depth violation", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "limits-test-"));
    const filePath = join(tmpDir, "deep-nest.ts");

    writeFileSync(
      filePath,
      `function deepNesting(a: boolean, b: boolean, c: boolean, d: boolean) {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          console.log("too deep");
        }
      }
    }
  }
}
`,
    );

    const violations = await checkLimits(tmpDir, ["deep-nest.ts"], {
      max_nesting_depth: 3,
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe("limits/max-nesting-depth");
    expect(violations[0]?.message).toContain("depth 4");
    expect(violations[0]?.message).toContain("max: 3");

    rmSync(tmpDir, { recursive: true });
  });

  it("returns no violations when within limits", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "limits-test-"));
    const filePath = join(tmpDir, "clean.ts");

    writeFileSync(
      filePath,
      `function clean(a: number, b: number) {
  return a + b;
}
`,
    );

    const violations = await checkLimits(tmpDir, ["clean.ts"], {
      max_file_lines: 100,
      max_function_lines: 50,
      max_parameters: 5,
      max_nesting_depth: 4,
    });

    expect(violations).toHaveLength(0);

    rmSync(tmpDir, { recursive: true });
  });

  it("detects multiple violations in single file", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "limits-test-"));
    const filePath = join(tmpDir, "multi.ts");

    writeFileSync(
      filePath,
      `function longWithManyParams(a: number, b: number, c: number, d: number, e: number, f: number) {
  const x = 1;
  const y = 2;
  const z = 3;
  const w = 4;
  return a + b + c + d + e + f + x + y + z + w;
}
`,
    );

    const violations = await checkLimits(tmpDir, ["multi.ts"], {
      max_function_lines: 5,
      max_parameters: 4,
    });

    expect(violations).toHaveLength(2);
    const rules = violations.map((v) => v.rule);
    expect(rules).toContain("limits/max-function-lines");
    expect(rules).toContain("limits/max-parameters");

    rmSync(tmpDir, { recursive: true });
  });

  it("ignores non-TS/Python files", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "limits-test-"));
    const filePath = join(tmpDir, "readme.md");

    const lines = Array(1000).fill("# line").join("\n");
    writeFileSync(filePath, lines);

    const violations = await checkLimits(tmpDir, ["readme.md"], {
      max_file_lines: 10,
    });

    expect(violations).toHaveLength(0);

    rmSync(tmpDir, { recursive: true });
  });
});
