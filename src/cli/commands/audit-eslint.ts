/**
 * ESLint audit utilities - parsing and comparing ESLint config files.
 */

import { type ESLintRuleValue } from "../../types.js";
import { type Mismatch } from "./audit-types.js";

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
    const prevChar = i > 0 ? content[i - 1] : "";

    // Handle string state
    const isQuote =
      (char === '"' || char === "'" || char === "`") && prevChar !== "\\";
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

/** Parse rules block as JSON */
function parseRulesAsJson(rulesBlock: string): Record<string, ESLintRuleValue> {
  let jsonStr = rulesBlock
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, "$1")
    .replace(/(\w+):/g, '"$1":')
    .replace(/"@/g, '"@')
    .replace(/""/g, '"');

  jsonStr = jsonStr.replace(/"+"([^"]+)"+:/g, '"$1":');
  return JSON.parse(jsonStr);
}

/** Manual parser for ESLint rules when JSON parsing fails. */
function parseRulesManually(
  rulesBlock: string,
): Record<string, ESLintRuleValue> {
  const rules: Record<string, ESLintRuleValue> = {};
  const rulePattern = /['"]([^'"]+)['"]\s*:\s*(['"][^'"]+['"]|\[[^\]]+\])/g;
  let match;

  while ((match = rulePattern.exec(rulesBlock)) !== null) {
    const ruleName = match[1];
    const ruleValue = match[2];
    if (!ruleName || !ruleValue) continue;

    try {
      const normalizedValue = ruleValue.replace(/'/g, '"');
      rules[ruleName] = JSON.parse(normalizedValue);
    } catch {
      rules[ruleName] = ruleValue.replace(/['"]/g, "") as ESLintRuleValue;
    }
  }

  return rules;
}
