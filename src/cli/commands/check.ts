import { Command } from 'commander';
import { glob } from 'glob';
import { stat } from 'fs/promises';
import { resolve, relative } from 'path';
import { loadConfig, findProjectRoot } from '../../config/loader.js';
import { runLinters } from '../../linter.js';
import type { CheckResult } from '../../types.js';

export const checkCommand = new Command('check')
  .description('Run ESLint and Ruff checks')
  .argument('[path]', 'Path to check (default: current directory)')
  .option('--json', 'Output results as JSON', false)
  .action(async (path: string | undefined, options: { json?: boolean }) => {
    try {
      const result = await runCheck(path);
      outputResults(result, options.json ?? false);
      process.exit(result.violations.length > 0 ? 1 : 0);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

async function runCheck(path?: string): Promise<CheckResult> {
  const projectRoot = findProjectRoot();
  await loadConfig(projectRoot); // Validates config exists

  const targetPath = path ? resolve(projectRoot, path) : projectRoot;
  const files = await discoverFiles(targetPath, projectRoot);

  if (files.length === 0) {
    return { violations: [], filesChecked: 0 };
  }

  const violations = await runLinters(projectRoot, files);

  return {
    violations,
    filesChecked: files.length,
  };
}

async function discoverFiles(targetPath: string, projectRoot: string): Promise<string[]> {
  const stats = await stat(targetPath).catch(() => null);

  if (!stats) {
    console.error(`Warning: Path not found: ${targetPath}`);
    return [];
  }

  if (stats.isFile()) {
    return [relative(projectRoot, targetPath)];
  }

  const pattern = `${targetPath}/**/*.{ts,tsx,js,jsx,mjs,cjs,py,pyi}`;
  const foundFiles = await glob(pattern, {
    nodir: true,
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/__pycache__/**',
      '**/.venv/**',
    ],
  });

  return foundFiles.map((f) => relative(projectRoot, f)).sort();
}

function outputResults(result: CheckResult, json: boolean): void {
  if (json) {
    console.log(
      JSON.stringify(
        {
          violations: result.violations,
          summary: {
            files_checked: result.filesChecked,
            violations_count: result.violations.length,
          },
        },
        null,
        2
      )
    );
    return;
  }

  if (result.violations.length === 0) {
    console.log(`✓ No violations found (${result.filesChecked} files checked)`);
    return;
  }

  for (const v of result.violations) {
    const location = v.line ? `:${v.line}` : '';
    console.log(`${v.file}${location} [${v.linter}/${v.rule}] ${v.message}`);
  }

  const s = result.violations.length === 1 ? '' : 's';
  console.log(`\n✗ ${result.violations.length} violation${s} found`);
}
