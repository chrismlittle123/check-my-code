# check-my-code Roadmap

This document tracks planned features from the [PRD](../docs/check-my-code-prd.md). Check off items as they're completed.

**Current Version:** 1.4.3
**Last Updated:** December 2025

---

## Version Guide

| Version | Focus Area                                        |
| ------- | ------------------------------------------------- |
| v1.5.x  | CLI polish, output improvements                   |
| v1.6.x  | `cmc sync` command (config merging)               |
| v2.0.x  | Remote config inheritance                         |
| v2.1.x  | Environment enforcers                             |
| v2.2.x  | CI/CD integration                                 |
| v2.3.x  | Security scanning                                 |
| v2.4.x  | AI agent security & configuration                 |
| v2.5.x  | Code quality & conventions                        |
| v2.6.x  | Documentation requirements                        |
| v3.0.x  | Extended linting, custom hooks, advanced features |

---

## v1.5.x - CLI Polish & Output Improvements

### Output Formatting

- [ ] Colored output for terminal (violations in red, success in green)
- [ ] Progress indicators for large projects
- [ ] File count in violation output (e.g., `10 files checked`)

### CLI Enhancements

- [ ] `--verbose` flag for `cmc check` with detailed linter execution info
- [ ] `--quiet` flag for minimal output (exit code only)
- [ ] Better error messages with actionable suggestions

---

## v1.6.x - Config Sync Command

### `cmc sync` Command (PRD 6.1.3)

- [ ] `cmc sync eslint` - Merge rules into existing `eslint.config.js`
- [ ] `cmc sync ruff` - Merge rules into existing `ruff.toml`
- [ ] `cmc sync tsc` - Merge settings into existing `tsconfig.json`
- [ ] `cmc sync` (no args) - Sync all linter configs
- [ ] Conflict detection (existing rule has different value)
- [ ] Conflict reporting with clear output format
- [ ] Preserve existing rules not defined in `cmc.toml`
- [ ] Exit codes: 0 (success), 1 (conflicts), 2 (config error), 3 (file not found)

---

## v2.0.x - Remote Config Inheritance

### Remote Ruleset Fetching (PRD 6.2.2)

- [ ] `[extends]` section support in cmc.toml
- [ ] Parse `github:owner/repo/path@version` format for rulesets
- [ ] Fetch remote `cmc.toml` from specified path
- [ ] Merge remote rules with local rules
- [ ] Version pinning (`@v1.0.0`, `@latest`, `@main`)
- [ ] SSH authentication for private repos (already partial)

### Additive-Only Inheritance (PRD 6.2.3)

- [ ] Block local rules from weakening base rules (`error` -> `warn`)
- [ ] Block local rules from disabling base rules (`error` -> `off`)
- [ ] Clear error messages when inheritance violations detected
- [ ] Enforcement in `cmc generate`
- [ ] Enforcement in `cmc sync`
- [ ] Enforcement in `cmc audit`

### Community Presets

- [ ] Document community repository structure (`rulesets/` directory)
- [ ] `rulesets.json` manifest support
- [ ] Version resolution via manifest (like prompts)
- [ ] Default community source: `github:chrismlittle123/check-my-code-community/rulesets@latest`

---

## v2.1.x - Environment Enforcers (PRD 7.2)

### `[enforcers]` Configuration

- [ ] `polyglot_manager` option (mise, asdf, rtx)
- [ ] `container_runtime` option (docker, podman)
- [ ] Detect if specified tools are installed
- [ ] Warning/error when required tool missing

### `[requirements]` Configuration

- [ ] `file_exists` array option
- [ ] Verify required configuration files exist
- [ ] Common files: `.tool-versions`, `.nvmrc`, `Dockerfile`, `docker-compose.yml`
- [ ] Report missing files with clear errors

### CLI Support

- [ ] `cmc check` includes enforcer validation
- [ ] `cmc audit` includes enforcer validation
- [ ] `--skip-enforcers` flag to bypass

---

## v2.2.x - CI/CD Integration (PRD 7.7)

### `[ci.coverage]` Configuration

- [ ] `provider` option (codecov, coveralls, local)
- [ ] `threshold` percentage option
- [ ] `fail_under` hard fail threshold
- [ ] `exclude` patterns for coverage
- [ ] Tier-based threshold presets

### `[ci.tests]` Configuration

- [ ] `runner` option (pytest, vitest, jest)
- [ ] `parallel` boolean option
- [ ] `timeout` seconds option
- [ ] `on_pull_request` boolean
- [ ] `on_push` branches array
- [ ] Runner-specific config sections (`[ci.tests.pytest]`, `[ci.tests.vitest]`)

### `[ci.branch_protection]` Configuration

- [ ] Branch protection rules definition
- [ ] `require_reviews` count
- [ ] `require_status_checks` boolean
- [ ] `require_linear_history` boolean

### `[ci.releases]` Configuration

- [ ] `versioning` option (bumpver, semantic-release, changesets)
- [ ] `tag_format` pattern
- [ ] `changelog` boolean

### `[ci.pr]` Configuration

- [ ] `max_files_changed` limit
- [ ] `max_lines_changed` limit
- [ ] `require_tests` boolean
- [ ] `require_description` boolean

### CI Commands

- [ ] `cmc ci generate github` - Generate GitHub Actions workflows
- [ ] `cmc ci generate gitlab` - Generate GitLab CI config
- [ ] `cmc ci audit` - Verify CI config matches cmc.toml
- [ ] `cmc ci status` - Show current CI/CD configuration

---

## v2.3.x - Security Scanning (PRD 7.10)

### `[security]` Configuration

- [ ] `secrets_scanner` option (gitleaks, detect-secrets, trufflehog)
- [ ] `secrets_config` custom config file path
- [ ] `scan_on_commit` boolean
- [ ] `fail_on_secrets` boolean

### `[security.blocked_commands]` Configuration

- [ ] `patterns` array for dangerous command patterns
- [ ] Default patterns (rm -rf /, docker run --privileged, etc.)

### `[security.dependencies]` Configuration

- [ ] `scanner` option (npm-audit, pip-audit, safety)
- [ ] `fail_on_severity` option (low, medium, high, critical)
- [ ] `ignore_advisories` array for CVE exceptions

### `[security.code]` Configuration

- [ ] `check_sql_injection` boolean
- [ ] `check_xss` boolean
- [ ] `check_command_injection` boolean

### Security Commands

- [ ] `cmc security scan` - Run all security scans
- [ ] `cmc security secrets` - Scan for secrets only
- [ ] `cmc security deps` - Scan dependencies only
- [ ] `cmc security audit` - Full security audit report

---

## v2.4.x - AI Agent Security & Configuration (PRD 7.11)

### `[ai.security]` Configuration

- [ ] `deny_commands` array (universal across agents)
- [ ] `deny_paths` array (glob patterns for sensitive paths)
- [ ] `deny_patterns` array (regex patterns for sensitive content)
- [ ] `template` option (minimal, standard, production, paranoid)

### `[ai.security.tools]` Configuration

- [ ] `allow` array (allowlist approach)
- [ ] `deny` array (denylist approach)

### `[ai.security.files]` Configuration

- [ ] `max_file_size` bytes limit
- [ ] `deny_binary` boolean
- [ ] `deny_extensions` array

### Agent-Specific Configuration

- [ ] `[ai.claude]` - Claude Code settings
- [ ] `[ai.cursor]` - Cursor settings
- [ ] `[ai.copilot]` - GitHub Copilot settings
- [ ] `[ai.windsurf]` - Windsurf settings
- [ ] `[ai.aider]` - Aider settings

### AI Commands

- [ ] `cmc ai generate` - Generate all agent configs
- [ ] `cmc ai generate claude` - Generate `.claude/settings.json`
- [ ] `cmc ai generate cursor` - Generate `.cursorrules`
- [ ] `cmc ai generate copilot` - Generate `.github/copilot-settings.json`
- [ ] `cmc ai audit` - Verify agent configs match cmc.toml
- [ ] `cmc ai diff` - Show drift between cmc.toml and agent configs
- [ ] `cmc ai templates` - List available security templates
- [ ] `cmc ai templates show <name>` - Show template contents

---

## v2.5.x - Code Quality & Conventions (PRD 7.12)

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

### `[code.patterns]` Configuration

- [ ] `forbid` array (regex patterns that fail if found)
- [ ] `require` array (regex patterns that fail if NOT found)

### `[conventions.files]` Configuration

- [ ] `casing` option (snake_case, kebab-case, PascalCase)
- [ ] `extension_map` normalization mapping
- [ ] `max_path_length` limit

### `[conventions.structure]` Configuration

- [ ] `required_dirs` array
- [ ] `required_files` array

### `[git.commits]` Configuration

- [ ] `pattern` regex for conventional commits
- [ ] `require_issue` boolean
- [ ] `issue_pattern` regex (JIRA/Linear format)
- [ ] `max_subject_length` limit
- [ ] `max_body_line_length` limit
- [ ] `require_body` boolean

### `[git.hooks]` Configuration

- [ ] `check_merge_conflict` boolean
- [ ] `trailing_whitespace` boolean
- [ ] `end_of_file_fixer` boolean
- [ ] `mixed_line_endings` option (lf, crlf, native)
- [ ] `no_commit_to_branch` array
- [ ] `detect_private_key` boolean
- [ ] `check_added_large_files` KB limit

### `[docs.docstrings]` Configuration

- [ ] `style` option (google, numpy, sphinx, epytext)
- [ ] `scanner` option (interrogate, typedoc)
- [ ] `coverage_threshold` percentage
- [ ] `require_for` option (public, all, none)
- [ ] `fail_under` percentage

### Additional Linter Rulesets

- [ ] `[rulesets.mypy]` - Python type checking
- [ ] `[rulesets.yaml]` - YAML file linting (yamllint)
- [ ] `[rulesets.json]` - JSON file linting (jsonlint)

### `[api]` Configuration

- [ ] `openapi_path` file location
- [ ] `openapi_diff` boolean
- [ ] `require_openapi_version` boolean
- [ ] `validate_examples` boolean

### `[testing.integration]` Configuration

- [ ] `require_endpoint_coverage` boolean
- [ ] `endpoint_discovery` option (openapi, fastapi, flask, express)
- [ ] `coverage_threshold` percentage

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

## v2.6.x - Documentation Requirements (PRD 7.9)

### `[docs]` Configuration

- [ ] `require_adr` boolean
- [ ] `adr_path` directory path
- [ ] `adr_template` template file path
- [ ] `require_diagrams` boolean
- [ ] `diagram_path` directory path
- [ ] `diagram_formats` array (mermaid, svg)
- [ ] `manual_testing_checklist` file path
- [ ] `regression_test_path` directory path
- [ ] `require_readme` boolean
- [ ] `readme_sections` required sections array

### Documentation Commands

- [ ] `cmc docs audit` - Verify documentation requirements
- [ ] `cmc docs init` - Generate documentation scaffolding

---

## v3.0.x - Advanced Features

### Additional Commands (PRD 7.5)

- [ ] `cmc diff` - Show changes since last check
- [ ] `cmc dry-run` - Preview what would be checked
- [ ] `cmc report` - Generate detailed reports
- [ ] `cmc report --html` - HTML report output

### Custom Hooks (PRD 7.4)

- [ ] `[hooks]` configuration section
- [ ] `pre_check` script path
- [ ] `post_check` script path
- [ ] Script execution with environment variables

### Enhanced Features (PRD 7.6)

- [ ] Smart checking with file hash caching
- [ ] Nested config inheritance (base extends another base)
- [ ] Multiple inheritance sources per linter

### Extended Linting Categories (PRD 7.3)

- [ ] Formatting standards (Prettier, Black)
- [ ] Import ordering enforcement
- [ ] Python type hints coverage analysis
- [ ] Secrets detection integration
- [ ] Dependency vulnerability scanning integration
- [ ] Cyclomatic complexity limits (native, not via external tool)
- [ ] Function/file length limits (native enforcement)

### MCP Server Configuration (PRD 7.8)

- [ ] `[mcp]` configuration section
- [ ] `servers` recommended array
- [ ] `required` servers array (warn if missing)
- [ ] Server-specific configuration sections

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
- Reference PRD section numbers for detailed specifications
