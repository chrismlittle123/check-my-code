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
} from '../types.js';
import { runSimpleCheck } from './simple.js';
import { LinterRunner, LinterNotFoundError } from './linter.js';
import { RulesetResolver } from '../rulesets/resolver.js';
import type { Spinner } from '../utils/spinner.js';

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
    const fileResults = new Map<string, FileCheckResult>();

    // Resolve rulesets
    this.spinner.start('Resolving rulesets...');
    const rulesets = await this.rulesetResolver.resolveRulesets(this.config);
    this.spinner.succeed(`Resolved ${rulesets.length} rulesets`);

    // Group rules by type
    const linterRules: Array<{ rule: string; config: RuleConfig }> = [];
    const simpleRules: Array<{ rule: string; config: RuleConfig }> = [];
    const scriptRules: Array<{ rule: string; config: RuleConfig }> = [];
    const aiRules: Array<{ rule: string; config: RuleConfig }> = [];

    for (const ruleset of rulesets) {
      for (const [ruleName, ruleConfig] of Object.entries(ruleset.rules)) {
        switch (ruleConfig.type) {
          case 'linter':
            linterRules.push({ rule: ruleName, config: ruleConfig });
            break;
          case 'simple':
            simpleRules.push({ rule: ruleName, config: ruleConfig });
            break;
          case 'script':
            scriptRules.push({ rule: ruleName, config: ruleConfig });
            break;
          case 'ai':
            aiRules.push({ rule: ruleName, config: ruleConfig });
            break;
        }
      }
    }

    // Group files by language
    const pythonFiles = files.filter((f) => f.endsWith('.py') || f.endsWith('.pyi'));
    const jsFiles = files.filter((f) => f.match(/\.(ts|tsx|js|jsx|mjs|cjs)$/));

    // Run linter checks (parallel by language)
    if (linterRules.length > 0) {
      this.spinner.start('Running linter checks...');

      const linterPromises: Promise<Violation[]>[] = [];

      // Group linter rules by linter
      const ruffRules = linterRules.filter((r) => r.config.linter === 'ruff');
      const eslintRules = linterRules.filter((r) => r.config.linter === 'eslint');

      if (ruffRules.length > 0 && pythonFiles.length > 0) {
        // Merge configs from all ruff rules
        const mergedConfig = ruffRules.reduce((acc, r) => {
          return { ...acc, ...r.config.config };
        }, {});

        linterPromises.push(
          this.linterRunner.runLinter(pythonFiles, 'ruff', mergedConfig).catch((err) => {
            if (err instanceof LinterNotFoundError) {
              throw err;
            }
            return [];
          })
        );
      }

      if (eslintRules.length > 0 && jsFiles.length > 0) {
        const mergedConfig = eslintRules.reduce((acc, r) => {
          return { ...acc, ...r.config.config };
        }, {});

        linterPromises.push(
          this.linterRunner.runLinter(jsFiles, 'eslint', mergedConfig).catch((err) => {
            if (err instanceof LinterNotFoundError) {
              throw err;
            }
            return [];
          })
        );
      }

      try {
        const linterResults = await Promise.all(linterPromises);
        for (const result of linterResults) {
          violations.push(...result);
        }
        this.spinner.succeed(`Linter checks complete (${violations.length} violations)`);
      } catch (err) {
        if (err instanceof LinterNotFoundError) {
          throw err;
        }
        throw err;
      }
    }

    // Run simple checks
    if (simpleRules.length > 0) {
      this.spinner.start('Running simple checks...');

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
    }

    // Run script checks
    if (scriptRules.length > 0) {
      this.spinner.start('Running script checks...');
      // Script checks would be implemented here
      // For v1, we'll skip this as it requires more complex execution
      this.spinner.succeed('Script checks complete');
    }

    // Run AI checks (unless --no-ai)
    if (aiRules.length > 0 && this.options.ai !== false) {
      if (this.config.ai?.enabled !== false) {
        this.spinner.start('Running AI-assisted checks...');
        // AI checks would be implemented here
        // For v1, we'll note that this requires agent configuration
        this.spinner.succeed('AI checks complete');
      }
    }

    // Compute file results for state tracking
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

    return { violations, fileResults };
  }
}
