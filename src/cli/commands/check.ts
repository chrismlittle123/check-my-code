/* eslint-disable no-await-in-loop -- Sequential file processing is intentional */
import { Command } from 'commander';
import { loadConfig, ConfigNotFoundError, ConfigValidationError } from '../../config/loader.js';
import { CheckRunner } from '../../checks/runner.js';
import { StateTracker } from '../../state/tracker.js';
import { OutputFormatter } from '../../output/cli.js';
import { createSpinner, type Spinner } from '../../utils/spinner.js';
import { LinterNotFoundError } from '../../checks/linter.js';
import type { CheckOptions, CheckResult, ProjectConfig } from '../../types.js';

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
    await runCheckCommand(path, options);
  });

async function runCheckCommand(path: string | undefined, options: CheckOptions): Promise<void> {
  validateOptions(options);

  const spinner = await createSpinner(options);
  const formatter = new OutputFormatter(options);

  try {
    const config = await loadAndValidateConfig(options, spinner);
    const { filesToCheck, cachedFiles, stateTracker } = await prepareFiles(
      path,
      options,
      config,
      spinner
    );

    if (filesToCheck.length === 0) {
      handleAllFilesCached(cachedFiles, stateTracker, formatter);
      return;
    }

    const result = await executeChecks(filesToCheck, cachedFiles, config, options, spinner);
    await saveStateIfEnabled(options, stateTracker, filesToCheck, result);
    outputAndExit(result, cachedFiles, stateTracker, formatter);
  } catch (error) {
    handleError(error, spinner);
  }
}

function validateOptions(options: CheckOptions): void {
  if (options.verbose && options.quiet) {
    console.error('Error: --verbose and --quiet cannot be used together');
    process.exit(2);
  }
}

async function loadAndValidateConfig(
  options: CheckOptions,
  spinner: Spinner
): Promise<ProjectConfig> {
  spinner.start('Loading configuration...');
  const config = await loadConfig(options.config);
  spinner.succeed('Configuration loaded');

  if (isEmptyRulesets(config)) {
    console.error('Warning: No rulesets configured in cmc.toml. Nothing to check.');
    process.exit(0);
  }

  return config;
}

interface PreparedFiles {
  filesToCheck: string[];
  cachedFiles: string[];
  stateTracker: StateTracker;
}

async function prepareFiles(
  path: string | undefined,
  options: CheckOptions,
  config: ProjectConfig,
  spinner: Spinner
): Promise<PreparedFiles> {
  const pathsToCheck = determinePaths(path, options.paths, config.projectRoot);
  const stateTracker = new StateTracker(config.projectRoot);
  await stateTracker.load();

  spinner.start('Discovering files...');
  const allFiles = await discoverFiles(pathsToCheck, config.projectRoot);

  if (allFiles.length === 0) {
    spinner.warn('No files to check');
    process.exit(0);
  }

  let filesToCheck = allFiles;
  let cachedFiles: string[] = [];

  if (!options.all) {
    const { changed, unchanged } = await stateTracker.filterChangedFiles(allFiles);
    filesToCheck = changed;
    cachedFiles = unchanged;
  }

  spinner.succeed(`Found ${filesToCheck.length} files to check (${cachedFiles.length} cached)`);
  return { filesToCheck, cachedFiles, stateTracker };
}

function handleAllFilesCached(
  cachedFiles: string[],
  stateTracker: StateTracker,
  formatter: OutputFormatter
): void {
  const cachedViolations = stateTracker.getCachedViolations(cachedFiles);
  formatter.outputResults({
    violations: cachedViolations,
    filesChecked: 0,
    filesCached: cachedFiles.length,
    durationMs: 0,
  });
  process.exit(cachedViolations.length > 0 ? 1 : 0);
}

interface ExecutionResult {
  violations: CheckResult['violations'];
  fileResults: Map<
    string,
    { file: string; hash: string; violations: CheckResult['violations']; checkedAt: string }
  >;
  durationMs: number;
}

async function executeChecks(
  filesToCheck: string[],
  _cachedFiles: string[],
  config: ProjectConfig,
  options: CheckOptions,
  spinner: Spinner
): Promise<ExecutionResult> {
  const runner = new CheckRunner(config, options, spinner);
  const startTime = Date.now();
  const result = await runner.run(filesToCheck);
  const durationMs = Date.now() - startTime;

  return { ...result, durationMs };
}

async function saveStateIfEnabled(
  options: CheckOptions,
  stateTracker: StateTracker,
  filesToCheck: string[],
  result: ExecutionResult
): Promise<void> {
  if (options.cache !== false) {
    await stateTracker.updateState(filesToCheck, result.fileResults);
    await stateTracker.save();
  }
}

function outputAndExit(
  result: ExecutionResult,
  cachedFiles: string[],
  stateTracker: StateTracker,
  formatter: OutputFormatter
): void {
  const cachedViolations = stateTracker.getCachedViolations(cachedFiles);
  const allViolations = [...result.violations, ...cachedViolations];

  const finalResult: CheckResult = {
    violations: allViolations,
    filesChecked: result.fileResults.size,
    filesCached: cachedFiles.length,
    durationMs: result.durationMs,
  };

  formatter.outputResults(finalResult);
  process.exit(allViolations.length > 0 ? 1 : 0);
}

function handleError(error: unknown, spinner: Spinner): never {
  spinner.fail('Check failed');

  if (
    error instanceof ConfigNotFoundError ||
    error instanceof ConfigValidationError ||
    error instanceof ConfigurationError
  ) {
    console.error(`Error: ${error.message}`);
    process.exit(2);
  }

  if (error instanceof LinterNotFoundError || error instanceof RuntimeError) {
    console.error(`Error: ${error.message}`);
    process.exit(3);
  }

  console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(3);
}

function determinePaths(
  singlePath: string | undefined,
  multiplePaths: string[] | undefined,
  projectRoot: string
): string[] {
  if (multiplePaths && multiplePaths.length > 0) return multiplePaths;
  if (singlePath) return [singlePath];
  return [projectRoot];
}

async function discoverFiles(paths: string[], projectRoot: string): Promise<string[]> {
  const { glob } = await import('glob');
  const { resolve, relative } = await import('path');
  const { stat } = await import('fs/promises');

  const files = new Set<string>();

  for (const p of paths) {
    const absolutePath = resolve(projectRoot, p);

    try {
      const stats = await stat(absolutePath);

      if (stats.isFile()) {
        files.add(relative(projectRoot, absolutePath));
      } else if (stats.isDirectory()) {
        const pattern = `${absolutePath}/**/*`;
        const foundFiles = await glob(pattern, {
          nodir: true,
          ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
          dot: false,
        });

        for (const file of foundFiles) {
          if (isSourceFile(file)) {
            files.add(relative(projectRoot, file));
          }
        }
      }
    } catch {
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

function isEmptyRulesets(config: ProjectConfig): boolean {
  if (!config.rulesets) return true;

  const hasDefault = config.rulesets.default && config.rulesets.default.length > 0;
  const hasLanguageRulesets = Object.keys(config.rulesets)
    .filter((k) => k !== 'default')
    .some((k) => {
      const ruleset = config.rulesets[k];
      return (
        ruleset &&
        typeof ruleset === 'object' &&
        'rules' in ruleset &&
        Array.isArray(ruleset.rules) &&
        ruleset.rules.length > 0
      );
    });

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
