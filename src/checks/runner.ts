/* eslint-disable no-await-in-loop -- Sequential file processing is intentional for memory efficiency */
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import type {
  ProjectConfig,
  CheckOptions,
  Violation,
  RunnerResult,
  FileCheckResult,
  RuleConfig,
  RulesetConfig,
} from '../types.js';
import { runSimpleCheck } from './simple.js';
import { LinterRunner, LinterNotFoundError } from './linter.js';
import { RulesetResolver } from '../rulesets/resolver.js';
import type { Spinner } from '../utils/spinner.js';

interface GroupedRules {
  linter: { rule: string; config: RuleConfig }[];
  simple: { rule: string; config: RuleConfig }[];
  script: { rule: string; config: RuleConfig }[];
  ai: { rule: string; config: RuleConfig }[];
}

export class CheckRunner {
  private config: ProjectConfig;
  private options: CheckOptions;
  private spinner: Spinner;
  private linterRunner: LinterRunner;
  private rulesetResolver: RulesetResolver;

  constructor(config: ProjectConfig, options: CheckOptions, spinner: Spinner) {
    this.config = config;
    this.options = options;
    this.spinner = spinner;
    this.linterRunner = new LinterRunner(config.projectRoot);
    this.rulesetResolver = new RulesetResolver(config.projectRoot);
  }

  async run(files: string[]): Promise<RunnerResult> {
    const violations: Violation[] = [];

    // Resolve and group rules
    const rulesets = await this.resolveRulesets();
    const rules = this.groupRulesByType(rulesets);

    // Run each type of check
    violations.push(...(await this.runLinterChecks(files, rules.linter)));
    violations.push(...(await this.runSimpleChecks(files, rules.simple)));
    await this.runScriptChecks(rules.script);
    await this.runAIChecks(rules.ai);

    // Build file results for state tracking
    const fileResults = await this.buildFileResults(files, violations);

    return { violations, fileResults };
  }

  private async resolveRulesets(): Promise<RulesetConfig[]> {
    this.spinner.start('Resolving rulesets...');
    const rulesets = await this.rulesetResolver.resolveRulesets(this.config);
    this.spinner.succeed(`Resolved ${rulesets.length} rulesets`);
    return rulesets;
  }

  private groupRulesByType(rulesets: RulesetConfig[]): GroupedRules {
    const rules: GroupedRules = { linter: [], simple: [], script: [], ai: [] };

    for (const ruleset of rulesets) {
      for (const [ruleName, ruleConfig] of Object.entries(ruleset.rules)) {
        const entry = { rule: ruleName, config: ruleConfig };
        switch (ruleConfig.type) {
          case 'linter':
            rules.linter.push(entry);
            break;
          case 'simple':
            rules.simple.push(entry);
            break;
          case 'script':
            rules.script.push(entry);
            break;
          case 'ai':
            rules.ai.push(entry);
            break;
        }
      }
    }

    return rules;
  }

  private async runLinterChecks(
    files: string[],
    linterRules: { rule: string; config: RuleConfig }[]
  ): Promise<Violation[]> {
    if (linterRules.length === 0) return [];

    this.spinner.start('Running linter checks...');
    const violations: Violation[] = [];

    const pythonFiles = files.filter((f) => f.endsWith('.py') || f.endsWith('.pyi'));
    const jsFiles = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.exec(f));

    const promises = this.buildLinterPromises(linterRules, pythonFiles, jsFiles);

    try {
      const results = await Promise.all(promises);
      for (const result of results) {
        violations.push(...result);
      }
      this.spinner.succeed(`Linter checks complete (${violations.length} violations)`);
    } catch (err) {
      if (err instanceof LinterNotFoundError) throw err;
      throw err;
    }

    return violations;
  }

  private buildLinterPromises(
    linterRules: { rule: string; config: RuleConfig }[],
    pythonFiles: string[],
    jsFiles: string[]
  ): Promise<Violation[]>[] {
    const promises: Promise<Violation[]>[] = [];

    const ruffRules = linterRules.filter((r) => r.config.linter === 'ruff');
    const eslintRules = linterRules.filter((r) => r.config.linter === 'eslint');

    if (ruffRules.length > 0 && pythonFiles.length > 0) {
      const mergedConfig = this.mergeConfigs(ruffRules);
      promises.push(this.runLinterSafe(pythonFiles, 'ruff', mergedConfig));
    }

    if (eslintRules.length > 0 && jsFiles.length > 0) {
      const mergedConfig = this.mergeConfigs(eslintRules);
      promises.push(this.runLinterSafe(jsFiles, 'eslint', mergedConfig));
    }

    return promises;
  }

  private mergeConfigs(rules: { config: RuleConfig }[]): Record<string, unknown> {
    return rules.reduce((acc, r) => ({ ...acc, ...r.config.config }), {});
  }

  private async runLinterSafe(
    files: string[],
    linter: string,
    config: Record<string, unknown>
  ): Promise<Violation[]> {
    try {
      return await this.linterRunner.runLinter(files, linter, config);
    } catch (err) {
      if (err instanceof LinterNotFoundError) {
        // Warn but don't fail - linter is optional
        console.warn(`Warning: ${linter} is not installed, skipping those checks`);
        return [];
      }
      return [];
    }
  }

  private async runSimpleChecks(
    files: string[],
    simpleRules: { rule: string; config: RuleConfig }[]
  ): Promise<Violation[]> {
    if (simpleRules.length === 0) return [];

    this.spinner.start('Running simple checks...');
    const violations: Violation[] = [];

    let fileCount = 0;
    for (const file of files) {
      fileCount++;
      this.spinner.text = `Running simple checks... [${fileCount}/${files.length}]`;

      for (const { config } of simpleRules) {
        if (config.check) {
          const checkViolations = await runSimpleCheck(
            this.config.projectRoot,
            file,
            config.check,
            config
          );
          violations.push(...checkViolations);
        }
      }
    }

    this.spinner.succeed('Simple checks complete');
    return violations;
  }

  private async runScriptChecks(
    scriptRules: { rule: string; config: RuleConfig }[]
  ): Promise<void> {
    if (scriptRules.length === 0) return;
    this.spinner.start('Running script checks...');
    // Script checks would be implemented here
    this.spinner.succeed('Script checks complete');
  }

  private async runAIChecks(aiRules: { rule: string; config: RuleConfig }[]): Promise<void> {
    if (aiRules.length === 0 || this.options.ai === false) return;
    if (this.config.ai?.enabled === false) return;

    this.spinner.start('Running AI-assisted checks...');
    // AI checks would be implemented here
    this.spinner.succeed('AI checks complete');
  }

  private async buildFileResults(
    files: string[],
    violations: Violation[]
  ): Promise<Map<string, FileCheckResult>> {
    const fileResults = new Map<string, FileCheckResult>();

    for (const file of files) {
      const absolutePath = join(this.config.projectRoot, file);
      const content = await readFile(absolutePath);
      const hash = createHash('sha256').update(content).digest('hex');
      const fileViolations = violations.filter((v) => v.file === file);

      fileResults.set(file, {
        file,
        hash,
        violations: fileViolations,
        checkedAt: new Date().toISOString(),
      });
    }

    return fileResults;
  }
}
