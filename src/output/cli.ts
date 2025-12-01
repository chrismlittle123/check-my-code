/* eslint-disable no-console -- This file is specifically for CLI output */
import type { CheckOptions, CheckResult, Violation } from '../types.js';

export class OutputFormatter {
  private options: CheckOptions;

  constructor(options: CheckOptions) {
    this.options = options;
  }

  outputResults(result: CheckResult): void {
    if (this.options.json) {
      this.outputJSON(result);
    } else if (this.options.quiet) {
      this.outputQuiet(result);
    } else if (this.options.verbose) {
      this.outputVerbose(result);
    } else {
      this.outputDefault(result);
    }
  }

  private outputDefault(result: CheckResult): void {
    const { violations } = result;

    if (violations.length === 0) {
      console.log('\nNo violations found');
      return;
    }

    // Sort violations by file, then line
    const sorted = [...violations].sort((a, b) => {
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return (a.line ?? 0) - (b.line ?? 0);
    });

    console.log('');
    for (const v of sorted) {
      const location = v.line ? `${v.file}:${v.line}` : v.file;
      console.log(`${location} ${v.rule}`);
    }

    console.log(`\n${violations.length} violation${violations.length === 1 ? '' : 's'} found`);
  }

  private outputVerbose(result: CheckResult): void {
    const { violations, filesChecked, filesCached, durationMs } = result;

    console.log(`\nChecking ${filesChecked + filesCached} files...`);

    if (violations.length === 0) {
      console.log('\nNo violations found');
      console.log(
        `Checked ${filesChecked} files in ${(durationMs / 1000).toFixed(1)}s (${filesCached} cached)`
      );
      return;
    }

    // Group violations by file
    const byFile = new Map<string, Violation[]>();
    for (const v of violations) {
      const existing = byFile.get(v.file) ?? [];
      existing.push(v);
      byFile.set(v.file, existing);
    }

    console.log('');
    for (const [file, fileViolations] of byFile) {
      // Sort by line number
      const sorted = [...fileViolations].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));

      for (const v of sorted) {
        const location = v.line ? `${file}:${v.line}` : file;
        console.log(`${location} ${v.rule}`);
        console.log(`  ${v.message}`);
        console.log('');
      }
    }

    const fileCount = byFile.size;
    console.log(
      `${violations.length} violation${violations.length === 1 ? '' : 's'} ` +
        `in ${fileCount} file${fileCount === 1 ? '' : 's'}`
    );
    console.log(
      `Checked ${filesChecked} files in ${(durationMs / 1000).toFixed(1)}s (${filesCached} cached, ${filesChecked} checked)`
    );
  }

  private outputQuiet(result: CheckResult): void {
    console.log(result.violations.length);
  }

  private outputJSON(result: CheckResult): void {
    const output = {
      summary: {
        files_checked: result.filesChecked,
        files_cached: result.filesCached,
        violations_total: result.violations.length,
        duration_ms: result.durationMs,
      },
      violations: result.violations.map((v) => ({
        file: v.file,
        line: v.line,
        column: v.column,
        rule: v.rule,
        message: v.message,
        ruleset: v.ruleset ?? null,
      })),
    };

    console.log(JSON.stringify(output, null, 2));
  }
}
