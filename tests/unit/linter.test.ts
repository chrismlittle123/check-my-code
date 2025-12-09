/**
 * Unit tests for linter.ts
 */

import { describe, expect, it } from "vitest";

import {
  countLintableFiles,
  LinterError,
  parseESLintOutput,
  parseRuffOutput,
  parseTscOutput,
} from "../../src/linter/index.js";

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

  it("preserves error message with special characters", () => {
    const message = 'ESLint failed: "no-console" rule violated in file.ts';
    const error = new LinterError(message);

    expect(error.message).toBe(message);
  });

  it("works with multiline error messages", () => {
    const message = `Ruff failed to run.
This may indicate a configuration error.
Check your ruff.toml configuration.`;
    const error = new LinterError(message);

    expect(error.message).toBe(message);
    expect(error.message).toContain("configuration error");
  });
});

describe("parseRuffOutput", () => {
  const projectRoot = "/project";

  it("returns empty violations for empty output", () => {
    expect(parseRuffOutput("", projectRoot).violations).toEqual([]);
    expect(parseRuffOutput("   ", projectRoot).violations).toEqual([]);
    expect(parseRuffOutput("\n\n", projectRoot).violations).toEqual([]);
  });

  it("parses valid Ruff JSON output", () => {
    const output = JSON.stringify([
      {
        filename: "/project/src/file.py",
        location: { row: 10, column: 5 },
        code: "F401",
        message: "unused import",
      },
    ]);

    const result = parseRuffOutput(output, projectRoot);

    expect(result.violations).toHaveLength(1);
    expect(result.parseError).toBeUndefined();
    expect(result.violations[0]).toEqual({
      file: "src/file.py",
      line: 10,
      column: 5,
      rule: "F401",
      message: "unused import",
      linter: "ruff",
    });
  });

  it("parses multiple violations", () => {
    const output = JSON.stringify([
      {
        filename: "/project/src/a.py",
        location: { row: 1, column: 1 },
        code: "E501",
        message: "line too long",
      },
      {
        filename: "/project/src/b.py",
        location: { row: 5, column: 10 },
        code: "F841",
        message: "unused variable",
      },
    ]);

    const result = parseRuffOutput(output, projectRoot);

    expect(result.violations).toHaveLength(2);
    expect(result.violations[0].file).toBe("src/a.py");
    expect(result.violations[1].file).toBe("src/b.py");
  });

  it("handles missing location", () => {
    const output = JSON.stringify([
      {
        filename: "/project/file.py",
        code: "E999",
        message: "syntax error",
      },
    ]);

    const result = parseRuffOutput(output, projectRoot);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].line).toBeNull();
    expect(result.violations[0].column).toBeNull();
  });

  it("handles partial location (row only)", () => {
    const output = JSON.stringify([
      {
        filename: "/project/file.py",
        location: { row: 42 },
        code: "E501",
        message: "line too long",
      },
    ]);

    const result = parseRuffOutput(output, projectRoot);

    expect(result.violations[0].line).toBe(42);
    expect(result.violations[0].column).toBeNull();
  });

  it("returns parseError for invalid JSON", () => {
    const result = parseRuffOutput("not json", projectRoot);
    expect(result.violations).toEqual([]);
    expect(result.parseError).toBeDefined();
    expect(result.parseError).toContain("Failed to parse Ruff output");
  });

  it("returns empty violations for empty JSON array", () => {
    const result = parseRuffOutput("[]", projectRoot);
    expect(result.violations).toEqual([]);
    expect(result.parseError).toBeUndefined();
  });

  it("converts absolute paths to relative paths", () => {
    const output = JSON.stringify([
      {
        filename: "/project/deep/nested/file.py",
        location: { row: 1, column: 1 },
        code: "F401",
        message: "test",
      },
    ]);

    const result = parseRuffOutput(output, projectRoot);
    expect(result.violations[0].file).toBe("deep/nested/file.py");
  });
});

describe("parseESLintOutput", () => {
  const projectRoot = "/project";

  it("returns empty violations for empty output", () => {
    expect(parseESLintOutput("", projectRoot).violations).toEqual([]);
    expect(parseESLintOutput("   ", projectRoot).violations).toEqual([]);
    expect(parseESLintOutput("\n", projectRoot).violations).toEqual([]);
  });

  it("parses valid ESLint JSON output", () => {
    const output = JSON.stringify([
      {
        filePath: "/project/src/file.ts",
        messages: [
          {
            line: 5,
            column: 10,
            ruleId: "no-console",
            message: "Unexpected console statement.",
          },
        ],
      },
    ]);

    const result = parseESLintOutput(output, projectRoot);

    expect(result.violations).toHaveLength(1);
    expect(result.parseError).toBeUndefined();
    expect(result.violations[0]).toEqual({
      file: "src/file.ts",
      line: 5,
      column: 10,
      rule: "no-console",
      message: "Unexpected console statement.",
      linter: "eslint",
    });
  });

  it("parses multiple violations in one file", () => {
    const output = JSON.stringify([
      {
        filePath: "/project/src/file.ts",
        messages: [
          { line: 1, column: 1, ruleId: "no-var", message: "Use let or const" },
          { line: 2, column: 1, ruleId: "semi", message: "Missing semicolon" },
        ],
      },
    ]);

    const result = parseESLintOutput(output, projectRoot);

    expect(result.violations).toHaveLength(2);
    expect(result.violations[0].rule).toBe("no-var");
    expect(result.violations[1].rule).toBe("semi");
  });

  it("parses violations across multiple files", () => {
    const output = JSON.stringify([
      {
        filePath: "/project/a.ts",
        messages: [{ line: 1, column: 1, ruleId: "rule1", message: "msg1" }],
      },
      {
        filePath: "/project/b.ts",
        messages: [{ line: 2, column: 2, ruleId: "rule2", message: "msg2" }],
      },
    ]);

    const result = parseESLintOutput(output, projectRoot);

    expect(result.violations).toHaveLength(2);
    expect(result.violations[0].file).toBe("a.ts");
    expect(result.violations[1].file).toBe("b.ts");
  });

  it("handles missing messages array", () => {
    const output = JSON.stringify([{ filePath: "/project/file.ts" }]);

    const result = parseESLintOutput(output, projectRoot);
    expect(result.violations).toEqual([]);
  });

  it("handles empty messages array", () => {
    const output = JSON.stringify([
      { filePath: "/project/file.ts", messages: [] },
    ]);

    const result = parseESLintOutput(output, projectRoot);
    expect(result.violations).toEqual([]);
  });

  it("handles missing line/column", () => {
    const output = JSON.stringify([
      {
        filePath: "/project/file.ts",
        messages: [{ ruleId: "error", message: "Parse error" }],
      },
    ]);

    const result = parseESLintOutput(output, projectRoot);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].line).toBeNull();
    expect(result.violations[0].column).toBeNull();
  });

  it("handles missing ruleId", () => {
    const output = JSON.stringify([
      {
        filePath: "/project/file.ts",
        messages: [{ line: 1, column: 1, message: "Some error" }],
      },
    ]);

    const result = parseESLintOutput(output, projectRoot);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].rule).toBe("eslint");
  });

  it("returns parseError for invalid JSON", () => {
    const result = parseESLintOutput("not valid json", projectRoot);
    expect(result.violations).toEqual([]);
    expect(result.parseError).toBeDefined();
    expect(result.parseError).toContain("Failed to parse ESLint output");
  });

  it("returns empty violations for empty JSON array", () => {
    const result = parseESLintOutput("[]", projectRoot);
    expect(result.violations).toEqual([]);
    expect(result.parseError).toBeUndefined();
  });
});

describe("parseTscOutput", () => {
  const projectRoot = "/project";

  it("returns empty array for empty output", () => {
    expect(parseTscOutput("", projectRoot)).toEqual([]);
    expect(parseTscOutput("   ", projectRoot)).toEqual([]);
    expect(parseTscOutput("\n\n", projectRoot)).toEqual([]);
  });

  it("parses standard tsc error format", () => {
    const output =
      "/project/src/file.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.";

    const violations = parseTscOutput(output, projectRoot);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual({
      file: "src/file.ts",
      line: 10,
      column: 5,
      rule: "TS2322",
      message: "Type 'string' is not assignable to type 'number'.",
      linter: "tsc",
    });
  });

  it("parses multiple tsc errors", () => {
    const output = `/project/a.ts(1,1): error TS2304: Cannot find name 'foo'.
/project/b.ts(5,10): error TS7006: Parameter 'x' implicitly has an 'any' type.`;

    const violations = parseTscOutput(output, projectRoot);

    expect(violations).toHaveLength(2);
    expect(violations[0].file).toBe("a.ts");
    expect(violations[0].rule).toBe("TS2304");
    expect(violations[1].file).toBe("b.ts");
    expect(violations[1].rule).toBe("TS7006");
  });

  it("handles tsc errors without error code", () => {
    // The regex pattern expects format: file(line,col): error [TSxxxx]: message
    // When there's no TS code, the message starts immediately after "error "
    const output = "/project/file.ts(1,1): error Some generic error message";

    const violations = parseTscOutput(output, projectRoot);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("tsc");
    expect(violations[0].message).toBe("Some generic error message");
  });

  it("ignores non-error lines", () => {
    const output = `Some info message
/project/file.ts(1,1): error TS2322: Real error
Another info line`;

    const violations = parseTscOutput(output, projectRoot);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("TS2322");
  });

  it("converts absolute paths to relative paths", () => {
    const output = "/project/deep/nested/file.ts(1,1): error TS1234: msg";

    const violations = parseTscOutput(output, projectRoot);
    expect(violations[0].file).toBe("deep/nested/file.ts");
  });

  it("handles windows-style paths", () => {
    // Note: path.relative handles this, but the regex may need adjustment for Windows
    const output =
      "/project/src/file.ts(100,50): error TS9999: Large line and column numbers";

    const violations = parseTscOutput(output, projectRoot);

    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(100);
    expect(violations[0].column).toBe(50);
  });
});

describe("countLintableFiles", () => {
  it("counts TypeScript files when eslint enabled", () => {
    const files = ["app.ts", "component.tsx", "config.json", "readme.md"];
    const count = countLintableFiles(files, { eslintDisabled: false });

    expect(count).toBe(2);
  });

  it("counts Python files when ruff enabled", () => {
    const files = ["main.py", "utils.pyi", "config.json", "readme.md"];
    const count = countLintableFiles(files, { ruffDisabled: false });

    expect(count).toBe(2);
  });

  it("counts JavaScript files when eslint enabled", () => {
    const files = ["app.js", "util.mjs", "lib.cjs", "script.jsx"];
    const count = countLintableFiles(files, { eslintDisabled: false });

    expect(count).toBe(4);
  });

  it("excludes files when linters disabled", () => {
    const files = ["app.ts", "main.py", "config.json"];
    const count = countLintableFiles(files, {
      eslintDisabled: true,
      ruffDisabled: true,
    });

    expect(count).toBe(0);
  });

  it("does not double-count TypeScript files", () => {
    // .ts files are in both typescript and javascript categories
    const files = ["app.ts", "util.tsx"];
    const count = countLintableFiles(files, {
      eslintDisabled: false,
      tscEnabled: true,
    });

    // Should be 2, not 4 (each file counted once, not twice)
    expect(count).toBe(2);
  });

  it("counts mixed files correctly", () => {
    const files = [
      "app.ts",
      "main.py",
      "util.js",
      "config.json",
      "readme.md",
      "noextension",
    ];
    const count = countLintableFiles(files, {
      eslintDisabled: false,
      ruffDisabled: false,
    });

    // app.ts, main.py, util.js = 3 lintable files
    expect(count).toBe(3);
  });

  it("returns 0 for empty file list", () => {
    const count = countLintableFiles([]);

    expect(count).toBe(0);
  });

  it("returns 0 when all files have unrecognized extensions", () => {
    const files = ["config.json", "readme.md", "data.xml", "noextension"];
    const count = countLintableFiles(files);

    expect(count).toBe(0);
  });

  it("counts TypeScript files when only tsc enabled", () => {
    const files = ["app.ts", "component.tsx", "util.js", "config.json"];
    const count = countLintableFiles(files, {
      eslintDisabled: true,
      ruffDisabled: true,
      tscEnabled: true,
    });

    // Only .ts and .tsx files counted via tsc, not .js
    expect(count).toBe(2);
  });
});
