# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.0] - 2025-12-09

### Added

- **Remote config inheritance (`[extends]`)** - Projects can now inherit ESLint, Ruff, and TSC configurations from remote git repositories. Define `[extends]` in your `cmc.toml` to pull in base rulesets from a central standards repository:
  ```toml
  [extends]
  eslint = "github:myorg/standards/rulesets/internal/typescript/5.5/eslint@latest"
  tsc = "github:myorg/standards/rulesets/internal/typescript/5.5/tsc@latest"
  ```
- **Version resolution via manifest** - Remote rulesets are resolved through a `rulesets.json` manifest, supporting `@latest` for newest version or `@1.0.0` for pinned versions
- **Rule merging with conflict detection** - Local rules are merged with inherited rules. If a local rule conflicts with an inherited rule (different value for same setting), cmc will error with a clear message explaining the conflict
- **Inheritance comments in generated configs** - `cmc generate` now includes an "Extends:" comment in generated config files when inheritance is active

### Changed

- `loadConfig()` now resolves `[extends]` references and returns merged configuration
- `cmc check`, `cmc generate`, and `cmc audit` all use the resolved (merged) configuration automatically

## [1.5.11] - 2025-12-08

### Fixed

- **Audit ignores commented ESLint rules** - `cmc audit eslint` now correctly strips JavaScript comments (single-line `//` and multi-line `/* */`) before parsing ESLint config files. Previously, commented-out rules were incorrectly detected as active rules, causing audit to pass when rules were actually missing.
- **Suppress linter warnings in JSON mode** - When using `--json` or `--quiet` flags, warning messages like "Ruff not found" or "ESLint not found" are now suppressed. Previously, these warnings were printed to stderr even in JSON mode, potentially polluting JSON output in CI/CD pipelines.

## [1.5.10] - 2025-12-08

### Fixed

- **JSON error output** - The `--json` flag now outputs errors as JSON instead of plain text. Previously, errors like "Path not found" were output as plain text even when `--json` was specified, breaking JSON consumers in CI/CD pipelines.

## [1.5.9] - 2025-12-08

### Security

- **Path traversal protection in MCP tools** - The MCP server's `check_files`, `check_project`, and `fix_files` tools now reject file paths that resolve outside the project root. Previously, paths like `../../../etc/passwd` or `/absolute/path/outside/project` could potentially be passed to linters. Now such paths are silently filtered out for security.

### Fixed

- **TSC file filtering** - TypeScript type checking (`tsc`) now filters violations to only include the requested files. Previously, when running `cmc check src/specific-file.ts`, TSC would report type errors from all files in the project, not just the requested file. This made the behavior inconsistent with ESLint and Ruff which correctly check only the specified files.
- **Linter output parse error reporting** - ESLint and Ruff parsers now report parse errors instead of silently returning empty results. Previously, if a linter produced malformed JSON output (indicating a crash or configuration issue), the parser would silently return an empty violations list, making it appear that the code had no issues when in fact the linter failed to run properly.

## [1.5.8] - 2024-12-08

### Fixed

- **MCP `check_project` subdirectory path resolution** - The MCP server's `check_project` tool now correctly handles subdirectory paths when the MCP server runs from a parent directory. Previously, relative paths like `subdir/` would return "No lintable files found" because paths were resolved against the project root instead of the current working directory.
- **CLI multiple file arguments** - `cmc check` now accepts multiple file/directory arguments (e.g., `cmc check file1.ts file2.ts src/`). Previously, only the first argument was processed and all subsequent arguments were silently ignored.
- **CLI exit code for nonexistent paths** - `cmc check` now returns exit code 2 (config error) when explicitly specified files or directories don't exist. Previously, it showed a warning but returned exit code 0 with "No violations found", which could cause CI pipelines to pass incorrectly.
- Use `path.isAbsolute()` for cross-platform path detection in MCP handlers (Windows + Unix compatibility)

## [1.5.7] - 2024-12-06

### Fixed

- **MCP `check_files` cross-directory path resolution** - The MCP server now correctly handles file paths when running from a parent directory. Previously, relative paths like `nested-paths/file.ts` would fail with "No valid files found" because paths were resolved incorrectly.
- `findProjectRoot()` now always returns absolute paths (was returning relative paths in some cases)
- `validateFiles()` now resolves relative paths from the MCP server's working directory, not the project root
- Fallback path resolution now correctly returns directories instead of file paths

## [1.5.6] - 2024-12-06

### Fixed

- **MCP `check_files` path resolution bug** - The MCP server's `check_files` tool now correctly handles absolute file paths. Previously, absolute paths would fail with "No valid files found" or cause linter errors due to malformed path resolution.
- Use `path.isAbsolute()` for cross-platform path detection (Windows + Unix compatibility)

## [1.5.5] - 2024-12-06

### Changed

- Split release workflow into separate jobs for changesets and publish for better OIDC isolation

## [1.5.4] - 2024-12-06

### Fixed

- Fix release workflow to use Node.js LTS for npm OIDC compatibility

## [1.5.3] - 2024-12-06

### Fixed

- Fix CHANGELOG.md format
- Consolidate release workflow to single location

## [1.5.2] - 2024-12-06

### Fixed

- **BUG-004**: `cmc validate` no longer crashes with "ENOENT: no such file or directory" - the `schemas/` directory is now included in the npm package distribution
- **BUG-005**: Fixed incorrect template name format in documentation and help text. Templates now correctly show the full path format `<tier>/<language>/<version>` (e.g., `internal/typescript/5.5`) instead of the abbreviated format

## [1.5.1] - 2024-12-06

### Added

- **Colored terminal output** - Visual distinction for errors (red), warnings (yellow), success messages (green), file paths (cyan), and linter/rule names (dim gray)
- **`--quiet` / `-q` flag** for `cmc check` - Suppresses all output, communicates results only through exit codes. Useful for CI/CD pipelines and scripting.
- `src/cli/output.ts` - Centralized color formatting utilities
- Environment variable support:
  - `NO_COLOR` - Disable all color output (per https://no-color.org/)
  - `FORCE_COLOR` - Force color output even when not a TTY
- TTY detection - Colors automatically disabled when output is piped

### Changed

- All commands now use colored output for better readability:
  - `check` - Violations in red, success in green, file paths in cyan, linter/rule in dim
  - `audit` - Mismatches in red, matches in green
  - `validate` - Errors in red, success in green
  - `generate` - Success in green, overwrites warning in yellow
  - `context` - Success in green

## [1.4.5] - 2024-12-06

### Fixed

- **BUG-001**: `cmc context` no longer duplicates content on repeated runs. Content is now wrapped in markers and replaced if already present.
- **BUG-002**: MCP server tools (`check_project`, `check_files`, `fix_files`) now accept path parameters for config discovery, allowing cmc.toml to be found from the specified path instead of only CWD.
- **BUG-003**: `cmc check` now properly reports errors when ESLint or Ruff fail to run (e.g., due to broken config files). Previously it would silently report "No violations found" when linters crashed.

## [1.4.4] - 2024-12-06

### Added

- `cmc info` command for displaying compatibility information
- `--json` flag for `cmc info` command
- `compatibility.yaml` included in npm package

### Changed

- Moved `compatibility.yaml` to project root
- Updated README with compatibility tables

## [1.4.3] - 2024-12-05

### Added

- E2E tests for registry with tsc tool entries

### Fixed

- Added `tsc` to allowed tool values in rulesets schema

## [1.4.2] - 2024-12-05

### Fixed

- Updated rulesets schema to support `tier/language/version/tool` pattern

## [1.4.1] - 2024-12-05

### Added

- Embedded registry schemas in CLI for standalone validation

## [1.4.0] - 2024-12-04

### Added

- `cmc audit tsc` - Audit tsconfig.json against cmc.toml
- `cmc generate tsc` - Generate tsconfig.json from cmc.toml
- `[rulesets.tsc]` configuration section with all compiler options

## [1.3.0] - 2024-12-03

### Added

- TypeScript type checking support via `tsc --noEmit`
- `tscEnabled` option in linter configuration

## [1.2.1] - 2024-12-02

### Added

- `cmc registry` command with subcommands:
  - `validate` - Validate registry JSON files
  - `list` - List prompts/rulesets with filtering
  - `check` - Verify if entry exists
  - `sync` - Detect sync issues
  - `bump` - Create new versions

## [1.2.0] - 2024-12-01

### Added

- `cmc validate` command for validating cmc.toml against JSON schema
- JSON Schema for cmc.toml, prompts.json, and rulesets.json

## [1.1.0] - 2024-11-30

### Added

- `cmc mcp-server` command for AI agent integration
- MCP tools: `check_files`, `check_project`, `fix_files`, `get_guidelines`, `get_status`, `suggest_config`, `validate_config`

## [1.0.0] - 2024-11-25

### Added

- Initial release
- `cmc check` - Run ESLint and Ruff linters
- `cmc generate eslint` - Generate eslint.config.js
- `cmc generate ruff` - Generate ruff.toml
- `cmc context` - Output coding standards for AI agents
- `cmc audit` - Check linter configs match cmc.toml
- `[prompts]` configuration for AI context templates
- Remote template fetching from git repositories
- Manifest-based template resolution
- Standard exit codes (0, 1, 2, 3)
- `--json`, `--force`, `--stdout` flags

[Unreleased]: https://github.com/chrismlittle123/check-my-code/compare/v1.6.0...HEAD
[1.6.0]: https://github.com/chrismlittle123/check-my-code/compare/v1.5.11...v1.6.0
[1.5.11]: https://github.com/chrismlittle123/check-my-code/compare/v1.5.10...v1.5.11
[1.5.10]: https://github.com/chrismlittle123/check-my-code/compare/v1.5.9...v1.5.10
[1.5.9]: https://github.com/chrismlittle123/check-my-code/compare/v1.5.8...v1.5.9
[1.5.8]: https://github.com/chrismlittle123/check-my-code/compare/v1.5.7...v1.5.8
[1.5.7]: https://github.com/chrismlittle123/check-my-code/compare/v1.5.6...v1.5.7
[1.5.6]: https://github.com/chrismlittle123/check-my-code/compare/v1.5.5...v1.5.6
[1.5.5]: https://github.com/chrismlittle123/check-my-code/compare/v1.5.2...v1.5.5
[1.5.4]: https://github.com/chrismlittle123/check-my-code/compare/v1.5.2...v1.5.4
[1.5.3]: https://github.com/chrismlittle123/check-my-code/compare/v1.5.2...v1.5.3
[1.5.2]: https://github.com/chrismlittle123/check-my-code/compare/v1.5.1...v1.5.2
[1.5.1]: https://github.com/chrismlittle123/check-my-code/compare/v1.4.5...v1.5.1
[1.4.5]: https://github.com/chrismlittle123/check-my-code/compare/v1.4.4...v1.4.5
[1.4.4]: https://github.com/chrismlittle123/check-my-code/compare/v1.4.3...v1.4.4
[1.4.3]: https://github.com/chrismlittle123/check-my-code/compare/v1.4.2...v1.4.3
[1.4.2]: https://github.com/chrismlittle123/check-my-code/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/chrismlittle123/check-my-code/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/chrismlittle123/check-my-code/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/chrismlittle123/check-my-code/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/chrismlittle123/check-my-code/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/chrismlittle123/check-my-code/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/chrismlittle123/check-my-code/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/chrismlittle123/check-my-code/releases/tag/v1.0.0
