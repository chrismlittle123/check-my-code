# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `tsc` support in `[extends]` schema for remote TypeScript config inheritance
- `cmc info` command to display supported languages, runtimes, and linters
- `compatibility.yaml` as single source of truth for supported tools
- Comprehensive roadmap tracking in `docs/ROADMAP.md`

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

[Unreleased]: https://github.com/chrismlittle123/check-my-code/compare/v1.4.4...HEAD
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
