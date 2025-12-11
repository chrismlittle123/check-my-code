# check-my-code Roadmap

This document tracks planned features for check-my-code. Check off items as they're completed.

---

## Version Guide

| Version | Focus Area                      |
| ------- | ------------------------------- |
| v1.2.x  | Validation & Registry           |
| v1.5.x  | Colored output, `--quiet` flag  |
| v1.6.x  | Remote config inheritance       |
| v1.8.x  | Requirements & tool enforcement |
| v1.9.x  | Native code limits              |
| v1.10.x | Claude settings from remote     |

---

## v1.5.x - CLI Polish & Output Improvements ✓

### Output Formatting

- [x] Colored output for terminal (violations in red, success in green)

### CLI Enhancements

- [x] `--quiet` flag for minimal output (exit code only)

---

## v1.6.x - Remote Config Inheritance ✓

### Remote Ruleset Fetching

- [x] `[extends]` section support in cmc.toml
- [x] Parse `github:owner/repo/path@version` format for rulesets
- [x] Fetch remote ruleset TOML files from specified path
- [x] Merge remote rules with local rules
- [x] Version pinning (`@v1.0.0`, `@latest`) via rulesets.json manifest
- [x] SSH authentication for private repos (uses ambient git credentials)

### Additive-Only Inheritance

- [x] Block local rules from conflicting with inherited rules
- [x] Clear error messages when inheritance violations detected
- [x] Enforcement in `cmc generate` (uses merged config)
- [x] Enforcement in `cmc audit` (uses merged config)
- [x] Enforcement in `cmc check` (uses merged config)

---

## v1.8.x - Requirements & Tool Enforcement ✓

### `[requirements.files]` Configuration

- [x] Array of files that must exist in the project
- [x] Examples: `CLAUDE.md`, `.coderabbit.yaml`, `.nvmrc`, `knip.json`, `CHANGELOG.md`
- [x] Report missing files with clear errors

### `[requirements.tools]` Configuration

Enforce that specific tools are configured (policy enforcer, not tool runner):

- [x] `ty` - Python type checking (Astral's type checker)
- [x] `gitleaks` - Secrets detection
- [x] `npm-audit` - TypeScript/JavaScript dependency vulnerabilities
- [x] `pip-audit` - Python dependency vulnerabilities
- [x] `knip` - TypeScript dead code detection
- [x] `vulture` - Python dead code detection

### CLI Support

- [x] `cmc check` includes requirements validation
- [x] `cmc audit` includes requirements validation
- [x] `--skip-requirements` flag to bypass

---

## v1.9.x - Native Code Limits ✓

cmc checks these directly (not via external tools) for both Python and TypeScript:

### `[rulesets.limits]` Configuration

- [x] `max_file_lines` - Maximum lines per file
- [x] `max_function_lines` - Maximum lines per function
- [x] `max_parameters` - Maximum function parameters
- [x] `max_nesting_depth` - Maximum nesting depth

### Implementation

- [x] Python: Parse AST to count lines/params/nesting
- [x] TypeScript: Parse AST to count lines/params/nesting
- [x] Report violations in unified format (same as ESLint/Ruff)

### CLI Support

- [x] `cmc check` includes limits validation
- [x] `--skip-limits` flag to bypass

---

## v1.10.x - Claude Settings from Remote

### `[ai.claude]` Configuration

- [ ] `extends` option - fetch settings from remote repo
- [ ] Format: `github:owner/repo/path@version` (same as rulesets)
- [ ] SSH authentication for private repos

### CLI Support

- [ ] `cmc generate claude` - Generate `.claude/settings.json`
- [ ] `cmc audit claude` - Verify settings match remote

---

## Completed Features (v1.x)

### v1.0.x - Initial Release

- [x] `cmc check` command - Run linters and report violations
- [x] `cmc generate eslint` - Generate eslint.config.js
- [x] `cmc generate ruff` - Generate ruff.toml
- [x] `cmc generate tsc` - Generate tsconfig.json
- [x] `cmc context` command - Output rules for AI agents
- [x] `cmc audit` command - Check linter configs match ruleset
- [x] ESLint integration
- [x] Ruff integration
- [x] TypeScript (tsc) integration
- [x] Unified output format (text and JSON)
- [x] Standard exit codes (0, 1, 2, 3)
- [x] Graceful handling of missing linters
- [x] Local `cmc.toml` configuration
- [x] `--json` flag for JSON output
- [x] `--force` flag for generate
- [x] `--stdout` flag for generate/context
- [x] Config discovery (walk up directory tree)
- [x] `[project] name` required field
- [x] `[rulesets.eslint.rules]` configuration
- [x] `[rulesets.ruff]` configuration
- [x] `[rulesets.tsc]` configuration with all compiler options
- [x] `[prompts]` configuration for AI context templates
- [x] Remote template fetching from git repositories
- [x] Manifest-based template resolution (`prompts.json`)

### v1.1.x - MCP Server

- [x] `cmc mcp-server` command
- [x] `check_files` MCP tool
- [x] `check_project` MCP tool
- [x] `fix_files` MCP tool (auto-fix)
- [x] `get_guidelines` MCP tool
- [x] `get_status` MCP tool
- [x] `suggest_config` MCP tool
- [x] `validate_config` MCP tool

### v1.2.x - Validation & Registry

- [x] `cmc validate` command - Validate cmc.toml against JSON schema
- [x] `cmc registry validate` - Validate registry JSON files
- [x] `cmc registry list` - List prompts/rulesets with filtering
- [x] `cmc registry check` - Verify if entry exists
- [x] `cmc registry sync` - Detect sync issues
- [x] `cmc registry bump` - Create new versions
- [x] JSON Schema for cmc.toml
- [x] JSON Schema for prompts.json
- [x] JSON Schema for rulesets.json

---

## Ideas Backlog

_Add new feature ideas here for future consideration:_

- [ ]
- [ ]
- [ ]

---

## Notes

- Features are organized by the version they're planned for
- Check off items as they're implemented
- Move items between versions as priorities change
- Add new ideas to the Ideas Backlog section
