/**
 * Output parsers for linter results.
 */

import { relative } from "path";

import { type Violation } from "../types.js";

/** Result of parsing linter output */
export interface ParseResult {
  violations: Violation[];
  parseError?: string;
}

/**
 * Parse Ruff JSON output into violations.
 * Returns parseError if the output is not valid JSON.
 */
export function parseRuffOutput(
  output: string,
  projectRoot: string,
): ParseResult {
  if (!output.trim()) return { violations: [] };

  try {
    const results = JSON.parse(output) as {
      filename: string;
      location?: { row?: number; column?: number };
      code: string;
      message: string;
    }[];

    return {
      violations: results.map((r) => ({
        file: relative(projectRoot, r.filename),
        line: r.location?.row ?? null,
        column: r.location?.column ?? null,
        rule: r.code,
        message: r.message,
        linter: "ruff" as const,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      violations: [],
      parseError: `Failed to parse Ruff output: ${message}`,
    };
  }
}

/**
 * Parse ESLint JSON output into violations.
 * Returns parseError if the output is not valid JSON.
 */
export function parseESLintOutput(
  output: string,
  projectRoot: string,
): ParseResult {
  if (!output.trim()) return { violations: [] };

  try {
    const results = JSON.parse(output) as {
      filePath: string;
      messages?: {
        line?: number;
        column?: number;
        ruleId?: string;
        message: string;
      }[];
    }[];

    const violations: Violation[] = [];
    for (const file of results) {
      for (const msg of file.messages ?? []) {
        violations.push({
          file: relative(projectRoot, file.filePath),
          line: msg.line ?? null,
          column: msg.column ?? null,
          rule: msg.ruleId ?? "eslint",
          message: msg.message,
          linter: "eslint" as const,
        });
      }
    }
    return { violations };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      violations: [],
      parseError: `Failed to parse ESLint output: ${message}`,
    };
  }
}

/**
 * Parse TypeScript compiler output into violations.
 * tsc output format: file(line,col): error TSxxxx: message
 */
export function parseTscOutput(
  output: string,
  projectRoot: string,
): Violation[] {
  if (!output.trim()) return [];

  const violations: Violation[] = [];
  const lines = output.split("\n");

  // Match: file(line,col): error TSxxxx: message
  // or: file(line,col): error: message (for some errors)
  const errorPattern = /^(.+?)\((\d+),(\d+)\):\s*(error)\s+(TS\d+)?:?\s*(.+)$/;

  for (const line of lines) {
    const match = errorPattern.exec(line);
    if (match) {
      const [, filePath, lineNum, colNum, , errorCode, message] = match;
      if (filePath && lineNum && colNum && message) {
        violations.push({
          file: relative(projectRoot, filePath),
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          rule: errorCode ?? "tsc",
          message: message.trim(),
          linter: "tsc" as const,
        });
      }
    }
  }

  return violations;
}
