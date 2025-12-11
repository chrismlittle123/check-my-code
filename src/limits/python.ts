/**
 * Python AST analysis for code limits.
 * Uses a bundled Python script to parse Python files and extract function info.
 */

import { execSync } from "child_process";

import { type FileAnalysis, LimitsError } from "./types.js";

// Bundled Python script as a string (avoids needing to bundle the .py file)
const PYTHON_SCRIPT = `#!/usr/bin/env python3
"""
Analyze Python files for code limits.
Outputs JSON with file analysis data.
"""
import ast
import json
import sys
from typing import Any


def analyze_file(filepath: str) -> dict[str, Any]:
    """Analyze a single Python file."""
    with open(filepath, encoding="utf-8") as f:
        source = f.read()
    lines = source.splitlines()

    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError as e:
        return {
            "filePath": filepath,
            "totalLines": len(lines),
            "functions": [],
            "error": f"Syntax error: {e.msg} at line {e.lineno}",
        }

    functions: list[dict[str, Any]] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions.append(analyze_function(node))

    return {
        "filePath": filepath,
        "totalLines": len(lines),
        "functions": functions,
    }


def analyze_function(node: ast.FunctionDef | ast.AsyncFunctionDef) -> dict[str, Any]:
    """Analyze a single function/method."""
    params = node.args

    # Count parameters (excluding self/cls)
    positional = [a for a in params.args if a.arg not in ("self", "cls")]
    param_count = (
        len(positional)
        + len(params.posonlyargs)
        + len(params.kwonlyargs)
        + (1 if params.vararg else 0)
        + (1 if params.kwarg else 0)
    )

    # Calculate nesting depth
    max_depth = calculate_nesting_depth(node.body)

    # Line count includes the function definition line
    line_count = (node.end_lineno or node.lineno) - node.lineno + 1

    return {
        "name": node.name,
        "startLine": node.lineno,
        "endLine": node.end_lineno or node.lineno,
        "lineCount": line_count,
        "parameterCount": param_count,
        "maxNestingDepth": max_depth,
    }


def calculate_nesting_depth(body: list[ast.stmt], current_depth: int = 0) -> int:
    """Calculate maximum nesting depth in a list of statements."""
    max_depth = current_depth
    nesting_types = (ast.If, ast.For, ast.While, ast.Try, ast.With, ast.Match)

    for node in body:
        if isinstance(node, nesting_types):
            # Get all child bodies
            child_bodies: list[list[ast.stmt]] = []

            if isinstance(node, ast.If):
                child_bodies.append(node.body)
                child_bodies.append(node.orelse)
            elif isinstance(node, (ast.For, ast.While)):
                child_bodies.append(node.body)
                child_bodies.append(node.orelse)
            elif isinstance(node, ast.Try):
                child_bodies.append(node.body)
                child_bodies.append(node.orelse)
                child_bodies.append(node.finalbody)
                for handler in node.handlers:
                    child_bodies.append(handler.body)
            elif isinstance(node, ast.With):
                child_bodies.append(node.body)
            elif isinstance(node, ast.Match):
                for case in node.cases:
                    child_bodies.append(case.body)

            for child_body in child_bodies:
                if child_body:
                    child_depth = calculate_nesting_depth(child_body, current_depth + 1)
                    max_depth = max(max_depth, child_depth)
        else:
            # Check for nested nodes that might contain more statements
            for child in ast.iter_child_nodes(node):
                if isinstance(child, list):
                    for item in child:
                        if isinstance(item, ast.stmt):
                            child_depth = calculate_nesting_depth([item], current_depth)
                            max_depth = max(max_depth, child_depth)

    return max_depth


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python-limits.py <file1.py> [file2.py ...]", file=sys.stderr)
        sys.exit(1)

    results = []
    for filepath in sys.argv[1:]:
        try:
            results.append(analyze_file(filepath))
        except Exception as e:
            results.append({
                "filePath": filepath,
                "totalLines": 0,
                "functions": [],
                "error": str(e),
            })

    print(json.dumps(results))
`;

/**
 * Check if Python 3 is available
 */
export function isPythonAvailable(): boolean {
  try {
    execSync("python3 --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Analyze Python files for code limits.
 * @param files Array of Python file paths to analyze
 * @returns Array of file analysis results
 */
export function analyzePythonFiles(files: string[]): FileAnalysis[] {
  if (files.length === 0) return [];

  if (!isPythonAvailable()) {
    throw new LimitsError(
      "Python 3 is required for limits checking on .py files but was not found",
    );
  }

  try {
    // Run Python script with files as arguments
    const result = execSync(
      `python3 -c ${JSON.stringify(PYTHON_SCRIPT)} ${files.map((f) => JSON.stringify(f)).join(" ")}`,
      {
        encoding: "utf-8",
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large projects
      },
    );

    const analyses = JSON.parse(result) as (FileAnalysis & {
      error?: string;
    })[];

    // Check for errors in results
    for (const analysis of analyses) {
      if (analysis.error) {
        // Log warning but continue with other files
        console.warn(`Warning: ${analysis.filePath}: ${analysis.error}`);
      }
    }

    return analyses.map((a) => ({
      filePath: a.filePath,
      totalLines: a.totalLines,
      functions: a.functions,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LimitsError(`Failed to analyze Python files: ${message}`);
  }
}
