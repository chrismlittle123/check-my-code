# check-my-code Roadmap

This document tracks planned features for check-my-code. Check off items as they're completed.

---

## Version Guide

| Version | Focus Area                                        |
| ------- | ------------------------------------------------- |
| v1.5.x  | Colored output, `--quiet` flag                    |
| v1.6.x  | Remote config inheritance                         |
| v1.7.x  | Environment enforcers                             |
| v1.8.x  | CI/CD integration                                 |
| v1.9.x  | Security scanning                                 |
| v2.0.x  | AI agent security & configuration                 |
| v2.1.x  | Code quality & conventions                        |
| v2.2.x  | Documentation requirements                        |
| v3.0.x  | Extended linting, custom hooks, advanced features |

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

## v1.7.x - Environment Requirements

### `[requirements]` Configuration

- [ ] `file_exists` array option
- [ ] Verify required configuration files exist
- [ ] Common files: `.tool-versions`, `.nvmrc`, `Dockerfile`, `docker-compose.yml`
- [ ] Report missing files with clear errors

### CLI Support

- [ ] `cmc check` includes requirements validation
- [ ] `cmc audit` includes requirements validation
- [ ] `--skip-requirements` flag to bypass

---

## v1.9.x - Security Scanning

### `[security.secrets]` Configuration

- [ ] `secrets_scanner` option (

### `[security.dependencies]` Configuration

- [ ] `scanner` option (npm-audit, pip-audit, safety)

### Security Commands

- [ ] `cmc security scan` - Run all security scans
- [ ] `cmc security secrets` - Scan for secrets only
- [ ] `cmc security deps` - Scan dependencies only

---

## v2.0.x - AI Agent Security & Configuration

### Agent-Specific Configuration

- [ ] `[ai.claude]` - Claude Code settings

### AI Commands

- [ ] `cmc ai generate claude` - Generate `.claude/settings.json`

---

## v2.1.x - Code Quality & Conventions (WHat isn't covered by eslint)

### `[code.limits]` Configuration

- [ ] `max_file_lines` limit
- [ ] `max_function_lines` limit
- [ ] `max_class_lines` limit
- [ ] `max_parameters` limit
- [ ] `max_nesting_depth` limit

### `[code.metrics]` Configuration

- [ ] `analyzer` option (radon, escomplex)
- [ ] `max_cyclomatic` complexity threshold
- [ ] `max_cognitive` complexity threshold
- [ ] `maintainability_threshold` index
- [ ] `halstead_threshold` difficulty

### `[code.quality]` Configuration

- [ ] `dead_code_scanner` option (vulture, ts-prune)
- [ ] `dead_code_threshold` count
- [ ] `duplication_scanner` option (jscpd, CPD)
- [ ] `duplication_threshold` count
- [ ] `min_duplicate_lines` threshold

### Quality Commands

- [ ] `cmc quality` - Run all quality checks
- [ ] `cmc quality limits` - Check size limits only
- [ ] `cmc quality metrics` - Check complexity metrics only
- [ ] `cmc quality patterns` - Check forbidden/required patterns
- [ ] `cmc quality duplication` - Check code duplication
- [ ] `cmc conventions` - Check all conventions
- [ ] `cmc conventions files` - Check file naming
- [ ] `cmc conventions structure` - Check directory structure
- [ ] `cmc score` - Aggregate quality score
- [ ] `cmc score --details` - Detailed breakdown
- [ ] `cmc score --json` - JSON output for CI

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
