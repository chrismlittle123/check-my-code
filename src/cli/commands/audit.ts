import { Command } from 'commander';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { loadConfig, findProjectRoot, ConfigError } from '../../config/loader.js';
import {
  ExitCode,
  type Config,
  type ESLintRuleValue,
  type RuffConfig,
  type TscConfig,
} from '../../types.js';

type LinterTarget = 'eslint' | 'ruff' | 'tsc';

interface Mismatch {
  type: 'missing' | 'different' | 'extra';
  rule: string;
  expected?: unknown;
  actual?: unknown;
}

interface VerifyResult {
  linter: LinterTarget;
  filename: string;
  matches: boolean;
  mismatches: Mismatch[];
}

const LINTER_CONFIGS: Record<LinterTarget, string> = {
  eslint: 'eslint.config.js',
  ruff: 'ruff.toml',
  tsc: 'tsconfig.json',
};

export const auditCommand = new Command('audit')
  .description('Check that linter config files match the ruleset defined in cmc.toml')
  .argument('[linter]', 'Linter to audit (eslint, ruff, tsc). If omitted, audits all.')
  .addHelpText(
    'after',
    `
Examples:
  $ cmc audit           Audit all linter configs
  $ cmc audit eslint    Audit only ESLint config
  $ cmc audit ruff      Audit only Ruff config
  $ cmc audit tsc       Audit only TypeScript config

Use in CI to ensure configs haven't drifted from cmc.toml.`
  )
  .action(async (linter?: string) => {
    try {
      const projectRoot = findProjectRoot();
      const config = await loadConfig(projectRoot);

      const targets = linter
        ? [validateLinterTarget(linter)]
        : (['eslint', 'ruff', 'tsc'] as LinterTarget[]);

      const allResults = await Promise.all(
        targets.map((target) => verifyLinterConfig(projectRoot, config, target))
      );
      const results = allResults.filter((r): r is VerifyResult => r !== null);
      const hasErrors = results.some((r) => !r.matches);

      // Output results
      for (const result of results) {
        if (result.matches) {
          console.log(`✓ ${result.filename} matches cmc.toml ruleset`);
        } else {
          console.log(`✗ ${result.filename} has mismatches:`);
          for (const mismatch of result.mismatches) {
            console.log(formatMismatch(mismatch));
          }
        }
      }

      if (results.length === 0) {
        console.log('No linter configs to audit (no rulesets defined in cmc.toml)');
        process.exit(ExitCode.SUCCESS);
      }

      process.exit(hasErrors ? ExitCode.VIOLATIONS : ExitCode.SUCCESS);
    } catch (error) {
      if (error instanceof ConfigError) {
        console.error(`Error: ${error.message}`);
        process.exit(ExitCode.CONFIG_ERROR);
      }
      if (error instanceof LinterConfigNotFoundError) {
        console.error(`Error: ${error.message}`);
        process.exit(ExitCode.RUNTIME_ERROR);
      }
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(ExitCode.RUNTIME_ERROR);
    }
  });

class LinterConfigNotFoundError extends Error {
  constructor(filename: string) {
    super(`Linter config file not found: ${filename}`);
    this.name = 'LinterConfigNotFoundError';
  }
}

function validateLinterTarget(linter: string): LinterTarget {
  const normalized = linter.toLowerCase();
  if (normalized !== 'eslint' && normalized !== 'ruff' && normalized !== 'tsc') {
    throw new ConfigError(`Unknown linter: ${linter}. Supported linters: eslint, ruff, tsc`);
  }
  return normalized;
}

function formatMismatch(mismatch: Mismatch): string {
  switch (mismatch.type) {
    case 'missing':
      return `  - missing rule: ${mismatch.rule} = ${JSON.stringify(mismatch.expected)}`;
    case 'different':
      return `  - different value: ${mismatch.rule} (expected ${JSON.stringify(mismatch.expected)}, got ${JSON.stringify(mismatch.actual)})`;
    case 'extra':
      return `  - extra rule: ${mismatch.rule} = ${JSON.stringify(mismatch.actual)}`;
  }
}

async function verifyLinterConfig(
  projectRoot: string,
  config: Config,
  target: LinterTarget
): Promise<VerifyResult | null> {
  const filename = LINTER_CONFIGS[target];
  const configPath = join(projectRoot, filename);

  // Check if ruleset is defined in cmc.toml
  if (target === 'eslint' && !config.rulesets?.eslint?.rules) {
    return null; // No ESLint rules defined, skip verification
  }
  if (target === 'ruff' && !config.rulesets?.ruff) {
    return null; // No Ruff config defined, skip verification
  }
  if (target === 'tsc' && !config.rulesets?.tsc) {
    return null; // No tsc config defined, skip verification
  }

  // Check if linter config file exists
  if (!existsSync(configPath)) {
    throw new LinterConfigNotFoundError(filename);
  }

  if (target === 'eslint') {
    return verifyESLintConfig(projectRoot, config, filename);
  } else if (target === 'ruff') {
    return verifyRuffConfig(projectRoot, config, filename);
  } else {
    return verifyTscConfig(projectRoot, config, filename);
  }
}

async function verifyESLintConfig(
  projectRoot: string,
  config: Config,
  filename: string
): Promise<VerifyResult> {
  const configPath = join(projectRoot, filename);
  const content = await readFile(configPath, 'utf-8');

  const expectedRules = config.rulesets?.eslint?.rules ?? {};
  const actualRules = extractESLintRules(content);

  const mismatches: Mismatch[] = [];

  // Check for missing and different rules
  for (const [rule, expectedValue] of Object.entries(expectedRules)) {
    if (!(rule in actualRules)) {
      mismatches.push({ type: 'missing', rule, expected: expectedValue });
    } else if (!deepEqual(expectedValue, actualRules[rule])) {
      mismatches.push({
        type: 'different',
        rule,
        expected: expectedValue,
        actual: actualRules[rule],
      });
    }
  }

  // Check for extra rules (rules in config but not in cmc.toml)
  for (const [rule, actualValue] of Object.entries(actualRules)) {
    if (!(rule in expectedRules)) {
      mismatches.push({ type: 'extra', rule, actual: actualValue });
    }
  }

  return {
    linter: 'eslint',
    filename,
    matches: mismatches.length === 0,
    mismatches,
  };
}

async function verifyRuffConfig(
  projectRoot: string,
  config: Config,
  filename: string
): Promise<VerifyResult> {
  const configPath = join(projectRoot, filename);
  const content = await readFile(configPath, 'utf-8');

  const TOML = await import('@iarna/toml');
  let actualConfig: RuffConfig;
  try {
    actualConfig = TOML.parse(content) as RuffConfig;
  } catch (error) {
    throw new Error(
      `Failed to parse ${filename}: ${error instanceof Error ? error.message : 'Parse error'}`
    );
  }

  const expectedConfig = config.rulesets?.ruff ?? {};
  const mismatches: Mismatch[] = [];

  // Check each Ruff config option
  compareRuffOption(
    mismatches,
    'line-length',
    expectedConfig['line-length'],
    actualConfig['line-length']
  );
  compareRuffOption(mismatches, 'select', expectedConfig.lint?.select, actualConfig.lint?.select);
  compareRuffOption(mismatches, 'ignore', expectedConfig.lint?.ignore, actualConfig.lint?.ignore);

  return {
    linter: 'ruff',
    filename,
    matches: mismatches.length === 0,
    mismatches,
  };
}

async function verifyTscConfig(
  projectRoot: string,
  config: Config,
  filename: string
): Promise<VerifyResult> {
  const configPath = join(projectRoot, filename);
  const content = await readFile(configPath, 'utf-8');

  let actualConfig: { compilerOptions?: Record<string, unknown> };
  try {
    actualConfig = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to parse ${filename}: ${error instanceof Error ? error.message : 'Parse error'}`
    );
  }

  const expectedConfig = config.rulesets?.tsc ?? {};
  const actualCompilerOptions = actualConfig.compilerOptions ?? {};
  const mismatches: Mismatch[] = [];

  // Get the list of tsc options to check (excluding 'enabled' which is cmc-specific)
  const tscOptions: (keyof TscConfig)[] = [
    'strict',
    'noImplicitAny',
    'strictNullChecks',
    'strictFunctionTypes',
    'strictBindCallApply',
    'strictPropertyInitialization',
    'noImplicitThis',
    'alwaysStrict',
    'noUncheckedIndexedAccess',
    'noImplicitReturns',
    'noFallthroughCasesInSwitch',
    'noUnusedLocals',
    'noUnusedParameters',
    'exactOptionalPropertyTypes',
    'noImplicitOverride',
    'allowUnusedLabels',
    'allowUnreachableCode',
  ];

  // Check each tsc option
  for (const option of tscOptions) {
    const expected = expectedConfig[option];
    const actual = actualCompilerOptions[option];

    if (expected !== undefined) {
      if (actual === undefined) {
        mismatches.push({ type: 'missing', rule: option, expected });
      } else if (!deepEqual(expected, actual)) {
        mismatches.push({ type: 'different', rule: option, expected, actual });
      }
    }
    // Note: We don't report extra options in tsconfig.json as projects often have
    // many other compiler options not managed by cmc (target, module, outDir, etc.)
  }

  return {
    linter: 'tsc',
    filename,
    matches: mismatches.length === 0,
    mismatches,
  };
}

/**
 * Compare a single Ruff config option and add mismatches if found
 */
function compareRuffOption(
  mismatches: Mismatch[],
  rule: string,
  expected: unknown,
  actual: unknown
): void {
  if (expected !== undefined) {
    if (actual === undefined) {
      mismatches.push({ type: 'missing', rule, expected });
    } else if (!deepEqual(expected, actual)) {
      mismatches.push({ type: 'different', rule, expected, actual });
    }
  } else if (actual !== undefined) {
    mismatches.push({ type: 'extra', rule, actual });
  }
}

/**
 * Extract rules from ESLint config file content.
 * This is a simple regex-based parser that extracts the rules object.
 */
function extractESLintRules(content: string): Record<string, ESLintRuleValue> {
  // Look for rules: { ... } pattern
  // This handles both single-line and multi-line rules objects
  const rulesMatch = /rules\s*:\s*(\{[\s\S]*?\})\s*[,}]/.exec(content);

  if (!rulesMatch) {
    return {};
  }

  const rulesBlock = rulesMatch[1];

  // Parse the rules object using a simple approach
  // Convert JavaScript object literal to JSON-compatible format
  try {
    // Replace single quotes with double quotes for JSON parsing
    // Handle trailing commas by removing them
    let jsonStr = rulesBlock
      .replace(/'/g, '"') // Single quotes to double quotes
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/(\w+):/g, '"$1":') // Unquoted keys to quoted keys
      .replace(/"@/g, '"@') // Keep @ in rule names
      .replace(/""/g, '"'); // Fix double quote issues

    // Handle already quoted keys (e.g., "@typescript-eslint/no-explicit-any")
    // This regex replaces ""key"" with "key"
    jsonStr = jsonStr.replace(/"+"([^"]+)"+:/g, '"$1":');

    return JSON.parse(jsonStr);
  } catch {
    // If JSON parsing fails, try a more lenient approach
    return parseRulesManually(rulesBlock);
  }
}

/**
 * Manual parser for ESLint rules when JSON parsing fails.
 * Handles common patterns like 'rule-name': 'error' and "rule-name": ["error", "always"]
 */
function parseRulesManually(rulesBlock: string): Record<string, ESLintRuleValue> {
  const rules: Record<string, ESLintRuleValue> = {};

  // Match patterns like: 'rule-name': 'error' or "rule-name": ["error", "always"]
  const rulePattern = /['"]([^'"]+)['"]\s*:\s*(['"][^'"]+['"]|\[[^\]]+\])/g;
  let match;

  while ((match = rulePattern.exec(rulesBlock)) !== null) {
    const ruleName = match[1];
    let ruleValue = match[2];

    try {
      // Convert single quotes to double quotes for JSON parsing
      ruleValue = ruleValue.replace(/'/g, '"');
      rules[ruleName] = JSON.parse(ruleValue);
    } catch {
      // If parsing fails, store as-is (removing quotes)
      rules[ruleName] = ruleValue.replace(/['"]/g, '') as ESLintRuleValue;
    }
  }

  return rules;
}

/**
 * Deep equality check for comparing rule values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}
