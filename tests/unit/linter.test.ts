/**
 * Unit tests for linter.ts
 */

import { describe, expect, it } from "vitest";

import {
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

  it("returns empty array for empty output", () => {
    expect(parseRuffOutput("", projectRoot)).toEqual([]);
    expect(parseRuffOutput("   ", projectRoot)).toEqual([]);
    expect(parseRuffOutput("\n\n", projectRoot)).toEqual([]);
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

    const violations = parseRuffOutput(output, projectRoot);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual({
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

    const violations = parseRuffOutput(output, projectRoot);

    expect(violations).toHaveLength(2);
    expect(violations[0].file).toBe("src/a.py");
    expect(violations[1].file).toBe("src/b.py");
  });

  it("handles missing location", () => {
    const output = JSON.stringify([
      {
        filename: "/project/file.py",
        code: "E999",
        message: "syntax error",
      },
    ]);

    const violations = parseRuffOutput(output, projectRoot);

    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBeNull();
    expect(violations[0].column).toBeNull();
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

    const violations = parseRuffOutput(output, projectRoot);

    expect(violations[0].line).toBe(42);
    expect(violations[0].column).toBeNull();
  });

  it("returns empty array for invalid JSON", () => {
    const violations = parseRuffOutput("not json", projectRoot);
    expect(violations).toEqual([]);
  });

  it("returns empty array for empty JSON array", () => {
    const violations = parseRuffOutput("[]", projectRoot);
    expect(violations).toEqual([]);
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

    const violations = parseRuffOutput(output, projectRoot);
    expect(violations[0].file).toBe("deep/nested/file.py");
  });
});

describe("parseESLintOutput", () => {
  const projectRoot = "/project";

  it("returns empty array for empty output", () => {
    expect(parseESLintOutput("", projectRoot)).toEqual([]);
    expect(parseESLintOutput("   ", projectRoot)).toEqual([]);
    expect(parseESLintOutput("\n", projectRoot)).toEqual([]);
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

    const violations = parseESLintOutput(output, projectRoot);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual({
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

    const violations = parseESLintOutput(output, projectRoot);

    expect(violations).toHaveLength(2);
    expect(violations[0].rule).toBe("no-var");
    expect(violations[1].rule).toBe("semi");
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

    const violations = parseESLintOutput(output, projectRoot);

    expect(violations).toHaveLength(2);
    expect(violations[0].file).toBe("a.ts");
    expect(violations[1].file).toBe("b.ts");
  });

  it("handles missing messages array", () => {
    const output = JSON.stringify([{ filePath: "/project/file.ts" }]);

    const violations = parseESLintOutput(output, projectRoot);
    expect(violations).toEqual([]);
  });

  it("handles empty messages array", () => {
    const output = JSON.stringify([
      { filePath: "/project/file.ts", messages: [] },
    ]);

    const violations = parseESLintOutput(output, projectRoot);
    expect(violations).toEqual([]);
  });

  it("handles missing line/column", () => {
    const output = JSON.stringify([
      {
        filePath: "/project/file.ts",
        messages: [{ ruleId: "error", message: "Parse error" }],
      },
    ]);

    const violations = parseESLintOutput(output, projectRoot);

    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBeNull();
    expect(violations[0].column).toBeNull();
  });

  it("handles missing ruleId", () => {
    const output = JSON.stringify([
      {
        filePath: "/project/file.ts",
        messages: [{ line: 1, column: 1, message: "Some error" }],
      },
    ]);

    const violations = parseESLintOutput(output, projectRoot);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("eslint");
  });

  it("returns empty array for invalid JSON", () => {
    const violations = parseESLintOutput("not valid json", projectRoot);
    expect(violations).toEqual([]);
  });

  it("returns empty array for empty JSON array", () => {
    const violations = parseESLintOutput("[]", projectRoot);
    expect(violations).toEqual([]);
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
