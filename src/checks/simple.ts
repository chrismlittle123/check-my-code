import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Violation, RuleConfig } from '../types.js';

export type SimpleCheckFunction = (
  filePath: string,
  content: string,
  config: RuleConfig
) => Promise<Violation[]>;

const simpleChecks: Record<string, SimpleCheckFunction> = {
  'file-length': checkFileLength,
  'require-docstrings': checkRequireDocstrings,
  'require-type-hints': checkRequireTypeHints,
  'require-jsdoc': checkRequireJSDoc,
  'no-console': checkNoConsole,
  'no-print': checkNoPrint,
};

export async function runSimpleCheck(
  projectRoot: string,
  file: string,
  checkName: string,
  config: RuleConfig
): Promise<Violation[]> {
  const checkFn = simpleChecks[checkName];
  if (!checkFn) {
    console.error(`Warning: Unknown simple check: ${checkName}`);
    return [];
  }

  const absolutePath = join(projectRoot, file);
  const content = await readFile(absolutePath, 'utf-8');

  return checkFn(file, content, config);
}

async function checkFileLength(
  filePath: string,
  content: string,
  config: RuleConfig
): Promise<Violation[]> {
  const maxLines = config.max ?? 500;
  const lines = content.split('\n').length;

  if (lines > maxLines) {
    return [
      {
        file: filePath,
        line: null,
        column: null,
        rule: 'file-length',
        message: `File exceeds ${maxLines} lines (current: ${lines})`,
      },
    ];
  }

  return [];
}

async function checkRequireDocstrings(
  filePath: string,
  content: string,
  config: RuleConfig
): Promise<Violation[]> {
  const violations: Violation[] = [];
  const scope = config.scope ?? 'functions';

  // Only apply to Python files
  if (!filePath.endsWith('.py')) {
    return [];
  }

  const lines = content.split('\n');

  // Simple regex patterns for Python functions and classes
  const functionPattern = /^(\s*)def\s+(\w+)\s*\(/;
  const classPattern = /^(\s*)class\s+(\w+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check functions
    if (scope === 'functions' || scope === 'all') {
      const funcMatch = line.match(functionPattern);
      if (funcMatch) {
        const funcName = funcMatch[2];
        // Skip dunder methods
        if (!funcName.startsWith('__')) {
          if (!hasDocstring(lines, i)) {
            violations.push({
              file: filePath,
              line: i + 1,
              column: null,
              rule: 'require-docstrings',
              message: `Function '${funcName}' missing docstring`,
            });
          }
        }
      }
    }

    // Check classes
    if (scope === 'classes' || scope === 'all') {
      const classMatch = line.match(classPattern);
      if (classMatch) {
        const className = classMatch[2];
        if (!hasDocstring(lines, i)) {
          violations.push({
            file: filePath,
            line: i + 1,
            column: null,
            rule: 'require-docstrings',
            message: `Class '${className}' missing docstring`,
          });
        }
      }
    }
  }

  return violations;
}

function hasDocstring(lines: string[], defLineIndex: number): boolean {
  // Look at the lines after the definition
  for (let i = defLineIndex + 1; i < Math.min(defLineIndex + 3, lines.length); i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    if (line.startsWith('"""') || line.startsWith("'''")) {
      return true;
    }
    // If we hit non-empty, non-docstring content, no docstring
    break;
  }
  return false;
}

async function checkRequireTypeHints(
  filePath: string,
  content: string,
  config: RuleConfig
): Promise<Violation[]> {
  const violations: Violation[] = [];
  const scope = config.scope ?? 'all';

  // Only apply to Python files
  if (!filePath.endsWith('.py')) {
    return [];
  }

  const lines = content.split('\n');

  // Pattern for function definitions
  const functionPattern = /^(\s*)def\s+(\w+)\s*\(([^)]*)\)\s*(->\s*\S+)?:/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(functionPattern);

    if (match) {
      const funcName = match[2];
      const params = match[3];
      const hasReturnType = !!match[4];

      // Skip dunder methods
      if (funcName.startsWith('__')) continue;

      // Check parameters
      if (scope === 'parameters' || scope === 'all') {
        if (params.trim() && !hasParameterTypeHints(params)) {
          violations.push({
            file: filePath,
            line: i + 1,
            column: null,
            rule: 'require-type-hints',
            message: `Function '${funcName}' has parameters without type hints`,
          });
        }
      }

      // Check return type
      if (scope === 'returns' || scope === 'all') {
        if (!hasReturnType) {
          violations.push({
            file: filePath,
            line: i + 1,
            column: null,
            rule: 'require-type-hints',
            message: `Function '${funcName}' missing return type hint`,
          });
        }
      }
    }
  }

  return violations;
}

function hasParameterTypeHints(params: string): boolean {
  // Skip self and cls
  const paramList = params
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && p !== 'self' && p !== 'cls' && !p.startsWith('*'));

  if (paramList.length === 0) return true;

  // Check if all params have type hints (contain :)
  return paramList.every((p) => p.includes(':'));
}

async function checkRequireJSDoc(
  filePath: string,
  content: string,
  config: RuleConfig
): Promise<Violation[]> {
  const violations: Violation[] = [];
  const scope = config.scope ?? 'exported';

  // Only apply to TypeScript/JavaScript files
  if (!filePath.match(/\.(ts|tsx|js|jsx|mjs|cjs)$/)) {
    return [];
  }

  const lines = content.split('\n');

  // Patterns for exported functions
  const exportFunctionPattern = /^export\s+(async\s+)?function\s+(\w+)/;
  const exportConstArrowPattern = /^export\s+const\s+(\w+)\s*=\s*(async\s+)?\(/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let funcName: string | null = null;

    const funcMatch = line.match(exportFunctionPattern);
    if (funcMatch) {
      funcName = funcMatch[2];
    }

    const arrowMatch = line.match(exportConstArrowPattern);
    if (arrowMatch) {
      funcName = arrowMatch[1];
    }

    if (funcName) {
      if (scope === 'exported' || scope === 'all') {
        if (!hasJSDoc(lines, i)) {
          violations.push({
            file: filePath,
            line: i + 1,
            column: null,
            rule: 'require-jsdoc',
            message: `Exported function '${funcName}' missing JSDoc comment`,
          });
        }
      }
    }
  }

  return violations;
}

function hasJSDoc(lines: string[], funcLineIndex: number): boolean {
  // Look at the lines before the function
  for (let i = funcLineIndex - 1; i >= Math.max(0, funcLineIndex - 10); i--) {
    const line = lines[i].trim();
    if (line === '') continue;
    if (line.endsWith('*/')) {
      // Check if it's a JSDoc comment (starts with /**)
      for (let j = i; j >= Math.max(0, i - 20); j--) {
        if (lines[j].trim().startsWith('/**')) {
          return true;
        }
      }
    }
    // If we hit non-comment content, no JSDoc
    break;
  }
  return false;
}

async function checkNoConsole(
  filePath: string,
  content: string,
  _config: RuleConfig
): Promise<Violation[]> {
  const violations: Violation[] = [];

  // Only apply to TypeScript/JavaScript files
  if (!filePath.match(/\.(ts|tsx|js|jsx|mjs|cjs)$/)) {
    return [];
  }

  const lines = content.split('\n');
  const consolePattern = /console\.(log|warn|error|info|debug|trace)\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      continue;
    }

    if (consolePattern.test(line)) {
      violations.push({
        file: filePath,
        line: i + 1,
        column: null,
        rule: 'no-console',
        message: 'Unexpected console statement',
      });
    }
  }

  return violations;
}

async function checkNoPrint(
  filePath: string,
  content: string,
  _config: RuleConfig
): Promise<Violation[]> {
  const violations: Violation[] = [];

  // Only apply to Python files
  if (!filePath.endsWith('.py')) {
    return [];
  }

  const lines = content.split('\n');
  const printPattern = /\bprint\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    if (line.trim().startsWith('#')) {
      continue;
    }

    if (printPattern.test(line)) {
      violations.push({
        file: filePath,
        line: i + 1,
        column: null,
        rule: 'no-print',
        message: 'Unexpected print statement',
      });
    }
  }

  return violations;
}

export function getAvailableSimpleChecks(): string[] {
  return Object.keys(simpleChecks);
}
