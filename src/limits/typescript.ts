/**
 * TypeScript AST analysis for code limits.
 * Uses the TypeScript compiler API to parse files and extract function info.
 */

import { readFileSync } from "fs";
import ts from "typescript";

import { type FileAnalysis, type FunctionInfo, LimitsError } from "./types.js";

/**
 * Analyze a single TypeScript/JavaScript file for code limits.
 */
export function analyzeTypeScriptFile(filePath: string): FileAnalysis {
  let source: string;
  try {
    source = readFileSync(filePath, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LimitsError(`Failed to read file ${filePath}: ${message}`);
  }

  const totalLines = source.split("\n").length;

  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith(".tsx") || filePath.endsWith(".jsx")
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LimitsError(`Failed to parse ${filePath}: ${message}`);
  }

  const functions: FunctionInfo[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      const funcInfo = analyzeFunctionNode(node, sourceFile);
      if (funcInfo) {
        functions.push(funcInfo);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    filePath,
    totalLines,
    functions,
  };
}

/**
 * Analyze TypeScript/JavaScript files for code limits.
 */
export function analyzeTypeScriptFiles(files: string[]): FileAnalysis[] {
  return files.map((file) => analyzeTypeScriptFile(file));
}

/**
 * Analyze a function node and extract info.
 */
function analyzeFunctionNode(
  node: ts.FunctionLikeDeclaration,
  sourceFile: ts.SourceFile,
): FunctionInfo | null {
  // Skip function type expressions (not actual function definitions)
  if (ts.isFunctionTypeNode(node as ts.Node)) {
    return null;
  }

  const startPos = node.getStart(sourceFile);
  const endPos = node.getEnd();

  const startLine = sourceFile.getLineAndCharacterOfPosition(startPos).line + 1;
  const endLine = sourceFile.getLineAndCharacterOfPosition(endPos).line + 1;
  const lineCount = endLine - startLine + 1;

  // Count parameters (excluding 'this' parameter)
  const params = node.parameters.filter((p) => {
    if (ts.isIdentifier(p.name)) {
      return p.name.text !== "this";
    }
    return true;
  });
  const parameterCount = params.length;

  // Get function name
  const name = getFunctionName(node, sourceFile);

  // Calculate nesting depth
  const maxNestingDepth = calculateNestingDepth(node.body);

  return {
    name,
    startLine,
    endLine,
    lineCount,
    parameterCount,
    maxNestingDepth,
  };
}

/**
 * Get name from anonymous function assigned to a variable or property.
 */
function getAnonymousFunctionName(node: ts.Node): string | null {
  const parent = node.parent;

  // const foo = () => {} or const foo = function() {}
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }

  // obj.foo = () => {} or obj.foo = function() {}
  if (
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isPropertyAccessExpression(parent.left)
  ) {
    return parent.left.name.text;
  }

  // { foo: () => {} } or { foo: function() {} }
  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }

  return null;
}

/**
 * Get the name of a function node.
 */
function getFunctionName(
  node: ts.FunctionLikeDeclaration,
  sourceFile: ts.SourceFile,
): string {
  // Named function or method
  if (node.name) {
    return node.name.getText(sourceFile);
  }

  // Constructor
  if (ts.isConstructorDeclaration(node)) {
    return "constructor";
  }

  // Arrow function or function expression - try to get name from context
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return getAnonymousFunctionName(node) ?? "<anonymous>";
  }

  return "<anonymous>";
}

/**
 * Calculate the maximum nesting depth in a node.
 */
function calculateNestingDepth(node: ts.Node | undefined, depth = 0): number {
  if (!node) return depth;

  let maxDepth = depth;

  const isNestingNode = (n: ts.Node): boolean =>
    ts.isIfStatement(n) ||
    ts.isForStatement(n) ||
    ts.isForInStatement(n) ||
    ts.isForOfStatement(n) ||
    ts.isWhileStatement(n) ||
    ts.isDoStatement(n) ||
    ts.isSwitchStatement(n) ||
    ts.isTryStatement(n) ||
    ts.isWithStatement(n);

  ts.forEachChild(node, (child) => {
    const newDepth = isNestingNode(child) ? depth + 1 : depth;
    const childMaxDepth = calculateNestingDepth(child, newDepth);
    maxDepth = Math.max(maxDepth, childMaxDepth);
  });

  return maxDepth;
}
