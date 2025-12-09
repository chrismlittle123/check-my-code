/**
 * ESLint audit utilities - parsing and comparing ESLint config files.
 */

import { type ESLintRuleValue } from "../types.js";

export interface Mismatch {
  type: "missing" | "different" | "extra";
  rule: string;
  expected?: unknown;
  actual?: unknown;
}

/** Compare expected vs actual ESLint rules.
 * Only reports missing or different rules - extra rules in the actual config are allowed.
 * This allows projects to add additional rules on top of the required ruleset.
 *
 * Severity comparison is flexible:
 * - If expected is "error", actual can be "error" or ["error", ...options]
 * - If expected is "warn", actual can be "warn", "error", or arrays with those severities
 * - Local config can be stricter (error instead of warn) but not weaker
 */
export function compareESLintRules(
  expected: Record<string, ESLintRuleValue>,
  actual: Record<string, ESLintRuleValue>,
): Mismatch[] {
  const mismatches: Mismatch[] = [];

  for (const [rule, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[rule];
    if (actualValue === undefined) {
      mismatches.push({ type: "missing", rule, expected: expectedValue });
    } else if (!ruleSeverityMatches(expectedValue, actualValue)) {
      mismatches.push({
        type: "different",
        rule,
        expected: expectedValue,
        actual: actualValue,
      });
    }
  }

  // Note: We intentionally don't report "extra" rules as mismatches.
  // Projects can add additional rules beyond the required ruleset.

  return mismatches;
}

/** Check if the actual rule severity satisfies the expected severity. */
function ruleSeverityMatches(
  expected: ESLintRuleValue,
  actual: ESLintRuleValue,
): boolean {
  const expectedSeverity = getSeverity(expected);
  const actualSeverity = getSeverity(actual);

  if (expectedSeverity === "off") return actualSeverity === "off";
  if (expectedSeverity === "error") return actualSeverity === "error";
  if (expectedSeverity === "warn") {
    return actualSeverity === "warn" || actualSeverity === "error";
  }

  return false;
}

/** Extract severity from an ESLint rule value. */
export function getSeverity(value: ESLintRuleValue): "off" | "warn" | "error" {
  if (Array.isArray(value)) {
    return normalizeSeverity(value[0]);
  }
  return normalizeSeverity(value);
}

/** Normalize severity to string form. */
function normalizeSeverity(
  severity: string | number | undefined,
): "off" | "warn" | "error" {
  if (severity === 0 || severity === "off") return "off";
  if (severity === 1 || severity === "warn") return "warn";
  if (severity === 2 || severity === "error") return "error";
  return "off";
}

/** Extract rules from ESLint config file content.
 * Returns rules from all blocks. For rules that appear in multiple blocks,
 * we keep the "most enabled" value (error > warn > off) since different
 * blocks may apply to different file patterns.
 */
export function extractESLintRules(
  content: string,
): Record<string, ESLintRuleValue> {
  const strippedContent = stripJsComments(content);
  const rulesBlocks = extractAllRulesBlocks(strippedContent);
  const allRules: Record<string, ESLintRuleValue> = {};

  for (const block of rulesBlocks) {
    const parsedRules = parseRulesBlock(block);
    mergeRulesKeepingStricter(allRules, parsedRules);
  }

  return allRules;
}

/** Parse a rules block, trying JSON first then manual parsing. */
function parseRulesBlock(block: string): Record<string, ESLintRuleValue> {
  try {
    return parseRulesAsJson(block);
  } catch {
    return parseRulesManually(block);
  }
}

/** Merge rules, keeping the stricter severity for each rule. */
function mergeRulesKeepingStricter(
  target: Record<string, ESLintRuleValue>,
  source: Record<string, ESLintRuleValue>,
): void {
  for (const [rule, value] of Object.entries(source)) {
    const existing = target[rule];
    if (existing === undefined) {
      target[rule] = value;
    } else {
      target[rule] = getStricterRule(existing, value);
    }
  }
}

/** Return the stricter of two rule values. */
function getStricterRule(
  a: ESLintRuleValue,
  b: ESLintRuleValue,
): ESLintRuleValue {
  const severityOrder = { off: 0, warn: 1, error: 2 };
  return severityOrder[getSeverity(a)] >= severityOrder[getSeverity(b)] ? a : b;
}

/** Extract all rules blocks from ESLint config. */
function extractAllRulesBlocks(content: string): string[] {
  const blocks: string[] = [];
  const rulesKeywordPattern = /rules\s*:\s*\{/g;
  let match;

  while ((match = rulesKeywordPattern.exec(content)) !== null) {
    const startBrace = match.index + match[0].length - 1;
    const block = extractBalancedBraces(content, startBrace);
    if (block) blocks.push(block);
  }

  return blocks;
}

/** Extract content between balanced braces starting at the given position. */
// eslint-disable-next-line complexity, max-statements
function extractBalancedBraces(
  content: string,
  startPos: number,
): string | null {
  if (content[startPos] !== "{") return null;

  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = startPos; i < content.length; i++) {
    const char = content[i];

    // Handle string state - check if quote is escaped by counting preceding backslashes
    // An odd count means the quote is escaped, even count (including 0) means unescaped
    const isQuote = char === '"' || char === "'" || char === "`";
    if (isQuote) {
      let backslashCount = 0;
      for (let j = i - 1; j >= 0 && content[j] === "\\"; j--) {
        backslashCount++;
      }
      const isEscaped = backslashCount % 2 === 1;
      if (isEscaped) continue;
    }
    if (isQuote) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = "";
      }
      continue;
    }
    if (inString) continue;

    // Handle braces
    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) return content.substring(startPos, i + 1);
    }
  }

  return null;
}

/**
 * Strip JavaScript comments from content.
 */
export function stripJsComments(content: string): string {
  const stringPlaceholders: string[] = [];
  const contentWithPlaceholders = content.replace(
    /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
    (match) => {
      const placeholder = `__STRING_${stringPlaceholders.length}__`;
      stringPlaceholders.push(match);
      return placeholder;
    },
  );

  const withoutSingleLine = contentWithPlaceholders.replace(/\/\/[^\n]*/g, "");
  const withoutComments = withoutSingleLine.replace(/\/\*[\s\S]*?\*\//g, "");

  return withoutComments.replace(/__STRING_(\d+)__/g, (_, index) => {
    return stringPlaceholders[parseInt(index, 10)] ?? "";
  });
}

/** Parse rules block as JSON.
 * Note: This handles most ESLint config patterns but may fail on complex
 * JavaScript expressions. The manual parser is used as a fallback.
 */
function parseRulesAsJson(rulesBlock: string): Record<string, ESLintRuleValue> {
  let jsonStr = rulesBlock
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, "$1")
    // Match unquoted keys including @, -, /, . for plugin rule names like @typescript-eslint/no-unused-vars
    .replace(/([\w@/.-]+):/g, '"$1":')
    .replace(/"@/g, '"@')
    .replace(/""/g, '"');

  jsonStr = jsonStr.replace(/"+"([^"]+)"+:/g, '"$1":');
  return JSON.parse(jsonStr);
}

/** Manual parser for ESLint rules when JSON parsing fails.
 * Handles nested arrays/objects in rule options by tracking bracket depth.
 */
function parseRulesManually(
  rulesBlock: string,
): Record<string, ESLintRuleValue> {
  const rules: Record<string, ESLintRuleValue> = {};
  // Match rule name followed by colon
  const ruleNamePattern = /['"]([^'"]+)['"]\s*:/g;
  let match;

  while ((match = ruleNamePattern.exec(rulesBlock)) !== null) {
    const ruleName = match[1];
    if (!ruleName) continue;

    const valueStart = match.index + match[0].length;
    const ruleValue = extractRuleValue(rulesBlock, valueStart);
    if (!ruleValue) continue;

    try {
      const normalizedValue = ruleValue.replace(/'/g, '"');
      rules[ruleName] = JSON.parse(normalizedValue);
    } catch {
      rules[ruleName] = ruleValue.replace(/['"]/g, "") as ESLintRuleValue;
    }
  }

  return rules;
}

/** Count consecutive backslashes before position i in content. */
function countPrecedingBackslashes(content: string, i: number): number {
  let count = 0;
  for (let j = i - 1; j >= 0 && content[j] === "\\"; j--) {
    count++;
  }
  return count;
}

/** Check if a quote at position i is escaped (odd number of preceding backslashes). */
function isEscapedQuote(content: string, i: number): boolean {
  return countPrecedingBackslashes(content, i) % 2 === 1;
}

/** Extract a quoted string value starting at pos. */
function extractStringValue(
  content: string,
  pos: number,
  quote: string,
): string | null {
  for (let endPos = pos + 1; endPos < content.length; endPos++) {
    if (content[endPos] === quote && !isEscapedQuote(content, endPos)) {
      return content.substring(pos, endPos + 1);
    }
  }
  return null;
}

/** Extract a bracketed value (array or object) starting at pos. */
// eslint-disable-next-line complexity, max-statements
function extractBracketedValue(
  content: string,
  pos: number,
  openBracket: string,
  closeBracket: string,
): string | null {
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = pos; i < content.length; i++) {
    const char = content[i];

    // Handle string state with proper escape detection
    if ((char === '"' || char === "'") && !inString) {
      if (!isEscapedQuote(content, i)) {
        inString = true;
        stringChar = char;
      }
    } else if (char === stringChar && inString) {
      if (!isEscapedQuote(content, i)) {
        inString = false;
        stringChar = "";
      }
    }

    if (!inString) {
      if (char === openBracket) depth++;
      if (char === closeBracket) {
        depth--;
        if (depth === 0) return content.substring(pos, i + 1);
      }
    }
  }
  return null;
}

/** Extract a rule value starting at the given position, handling nested brackets. */
function extractRuleValue(content: string, startPos: number): string | null {
  // Skip whitespace
  let pos = startPos;
  while (pos < content.length && /\s/.test(content[pos] ?? "")) {
    pos++;
  }

  if (pos >= content.length) return null;

  const firstChar = content[pos];

  // Simple string value
  if (firstChar === '"' || firstChar === "'") {
    return extractStringValue(content, pos, firstChar);
  }

  // Array or object - track nested brackets
  if (firstChar === "[") {
    return extractBracketedValue(content, pos, "[", "]");
  }
  if (firstChar === "{") {
    return extractBracketedValue(content, pos, "{", "}");
  }

  // Simple unquoted value (like error, warn, off, or numbers)
  const simpleMatch = /^[\w-]+/.exec(content.substring(pos));
  return simpleMatch ? simpleMatch[0] : null;
}
