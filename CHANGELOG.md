# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/chrismlittle123/check-my-code/compare/v1.5.5...HEAD
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
