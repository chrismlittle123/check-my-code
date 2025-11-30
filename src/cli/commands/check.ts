import { Command } from 'commander';
import { loadConfig, ConfigNotFoundError, ConfigValidationError } from '../../config/loader.js';
import { CheckRunner } from '../../checks/runner.js';
import { StateTracker } from '../../state/tracker.js';
import { OutputFormatter } from '../../output/cli.js';
import { createSpinner } from '../../utils/spinner.js';
import { LinterNotFoundError } from '../../checks/linter.js';
import type { CheckOptions, CheckResult } from '../../types.js';

export const checkCommand = new Command('check')
  .description('Run verification checks against configured rulesets')
  .argument('[path]', 'Single path to check (file or directory)')
  .option('-p, --paths <paths...>', 'Check multiple specific paths')
  .option('-a, --all', 'Force check all files, ignoring smart checking cache', false)
  .option('--no-ai', 'Skip AI-assisted checks')
  .option('--no-cache', 'Do not update the state cache after check')
  .option('-v, --verbose', 'Show detailed progress and violation messages', false)
  .option('-q, --quiet', 'Only output violation count, no details', false)
  .option('--json', 'Output results as JSON', false)
  .option('-c, --config <path>', 'Path to cmc.toml config file')
  .action(async (path: string | undefined, options: CheckOptions) => {
    // Check for conflicting options
    if (options.verbose && options.quiet) {
      console.error('Error: --verbose and --quiet cannot be used together');
      process.exit(2);
    }

    const spinner = await createSpinner(options);
    const formatter = new OutputFormatter(options);

    try {
      // 1. Discover and load configuration
      spinner.start('Loading configuration...');
      const config = await loadConfig(options.config);
      spinner.succeed('Configuration loaded');

      // Check for empty rulesets
      if (isEmptyRulesets(config)) {
        console.error('Warning: No rulesets configured in cmc.toml. Nothing to check.');
        process.exit(0);
      }

      // 2. Determine paths to check
      const pathsToCheck = determinePaths(path, options.paths, config.projectRoot);

      // 3. Initialize state tracker
      const stateTracker = new StateTracker(config.projectRoot);
      await stateTracker.load();

      // 4. Determine files in scope
      spinner.start('Discovering files...');
      const allFiles = await discoverFiles(pathsToCheck, config.projectRoot);

      if (allFiles.length === 0) {
        spinner.warn('No files to check');
        process.exit(0);
      }

      // 5. Apply smart checking (unless --all)
      let filesToCheck = allFiles;
      let cachedFiles: string[] = [];

      if (!options.all) {
        const { changed, unchanged } = await stateTracker.filterChangedFiles(allFiles);
        filesToCheck = changed;
        cachedFiles = unchanged;
      }

      if (filesToCheck.length === 0) {
        spinner.succeed('All files up to date');
        const cachedViolations = stateTracker.getCachedViolations(cachedFiles);
        formatter.outputResults({
          violations: cachedViolations,
          filesChecked: 0,
          filesCached: cachedFiles.length,
          durationMs: 0,
        });
        process.exit(cachedViolations.length > 0 ? 1 : 0);
      }

      spinner.succeed(`Found ${filesToCheck.length} files to check (${cachedFiles.length} cached)`);

      // 6. Run checks
      const runner = new CheckRunner(config, options, spinner);
      const startTime = Date.now();

      const result = await runner.run(filesToCheck);

      const durationMs = Date.now() - startTime;

      // 7. Update state cache (unless --no-cache)
      if (options.cache !== false) {
        await stateTracker.updateState(filesToCheck, result.fileResults);
        await stateTracker.save();
      }

      // 8. Combine with cached violations for full picture
      const cachedViolations = stateTracker.getCachedViolations(cachedFiles);
      const allViolations = [...result.violations, ...cachedViolations];

      // 9. Output results
      const finalResult: CheckResult = {
        violations: allViolations,
        filesChecked: filesToCheck.length,
        filesCached: cachedFiles.length,
        durationMs,
      };

      formatter.outputResults(finalResult);

      // 10. Exit with appropriate code
      process.exit(allViolations.length > 0 ? 1 : 0);
    } catch (error) {
      spinner.fail('Check failed');

      // Configuration errors (exit code 2)
      if (
        error instanceof ConfigNotFoundError ||
        error instanceof ConfigValidationError ||
        error instanceof ConfigurationError
      ) {
        console.error(`Error: ${error.message}`);
        process.exit(2);
      }

      // Runtime errors (exit code 3)
      if (error instanceof LinterNotFoundError || error instanceof RuntimeError) {
        console.error(`Error: ${error.message}`);
        process.exit(3);
      }

      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(3);
    }
  });

function determinePaths(
  singlePath: string | undefined,
  multiplePaths: string[] | undefined,
  projectRoot: string
): string[] {
  if (multiplePaths && multiplePaths.length > 0) {
    return multiplePaths;
  }
  if (singlePath) {
    return [singlePath];
  }
  return [projectRoot];
}

async function discoverFiles(paths: string[], projectRoot: string): Promise<string[]> {
  const { glob } = await import('glob');
  const { resolve, relative } = await import('path');
  const { stat } = await import('fs/promises');

  const files: Set<string> = new Set();

  for (const p of paths) {
    const absolutePath = resolve(projectRoot, p);

    try {
      const stats = await stat(absolutePath);

      if (stats.isFile()) {
        files.add(relative(projectRoot, absolutePath));
      } else if (stats.isDirectory()) {
        // Find all source files, excluding hidden files/directories by default
        const pattern = `${absolutePath}/**/*`;
        const foundFiles = await glob(pattern, {
          nodir: true,
          ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
          dot: false, // Exclude hidden files by default
        });

        for (const file of foundFiles) {
          if (isSourceFile(file)) {
            files.add(relative(projectRoot, file));
          }
        }
      }
    } catch {
      // Path doesn't exist, skip it
      console.error(`Warning: Path not found: ${p}`);
    }
  }

  return Array.from(files).sort();
}

function isSourceFile(filePath: string): boolean {
  const sourceExtensions = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.py',
    '.pyi',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
  ];
  return sourceExtensions.some((ext) => filePath.endsWith(ext));
}

function isEmptyRulesets(config: any): boolean {
  if (!config.rulesets) return true;

  const hasDefault = config.rulesets.default && config.rulesets.default.length > 0;
  const hasLanguageRulesets = Object.keys(config.rulesets)
    .filter((k) => k !== 'default')
    .some((k) => config.rulesets[k].rules && config.rulesets[k].rules.length > 0);

  return !hasDefault && !hasLanguageRulesets;
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeError';
  }
}

export { ConfigurationError, RuntimeError };
