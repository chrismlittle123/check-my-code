# Product Requirements Document: check-my-code (cmc)

**Version:** 2.0
**Date:** December 2025
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Overview](#3-product-overview)
4. [Core Principles](#4-core-principles)
5. [Version Scope](#5-version-scope)
6. [Feature Specifications (v1 MVP)](#6-feature-specifications-v1-mvp)
   - 6.1 [CLI Commands](#61-cli-commands)
   - 6.2 [Configuration System](#62-configuration-system)
   - 6.3 [Linter Integration](#63-linter-integration)
   - 6.4 [Output & Exit Codes](#64-output--exit-codes)
   - 6.5 [MCP Server](#65-mcp-server)
7. [Feature Specifications (v2 Future)](#7-feature-specifications-v2-future)
   - 7.7 [CI/CD Integration](#77-cicd-integration)
   - 7.8 [MCP Server Configuration](#78-mcp-server-configuration)
   - 7.9 [Documentation Requirements](#79-documentation-requirements)
   - 7.10 [Security Scanning](#710-security-scanning)
   - 7.11 [AI Agent Security & Configuration](#711-ai-agent-security--configuration)
   - 7.12 [Code Quality & Conventions](#712-code-quality--conventions)
8. [Technical Specifications](#8-technical-specifications)
9. [Glossary](#9-glossary)

---

## 1. Executive Summary

**check-my-code** (`cmc`) is a CLI tool that manages linter configurations and runs ESLint and Ruff on code. It provides a unified way to enforce coding standards across TypeScript/JavaScript and Python files with `cmc.toml` as the single source of truth.

The tool acts as:

- A **configuration manager** that generates and syncs linter configs from a central definition
- A **verification layer** that checks code and configs against defined standards
- A **context provider** for AI coding agents, ensuring they write compliant code from the start

**Core concept:** `cmc.toml` defines your rules. ESLint/Ruff configs are generated artifacts that can be created, amended, or verified against the source of truth.

---

## 2. Problem Statement

### Current Challenges

1. **Configuration sprawl**: Every repository has its own ESLint and Ruff configs, leading to inconsistency across projects and teams.

2. **Config drift**: Linter configurations diverge over time as different developers make local changes, making it hard to enforce organization-wide standards.

3. **Adoption friction**: Adopting new linting standards requires manually updating configs in every repository.

4. **No unified interface**: Running ESLint and Ruff separately requires different commands and output formats.

5. **Context gap for AI agents**: AI coding tools don't automatically know the team's specific coding standards, leading to non-compliant code that requires manual correction.

### Desired Outcome

A single tool that:

- Uses `cmc.toml` as the single source of truth for linting rules
- Generates, syncs, and verifies linter configs as artifacts
- Supports inheriting rules from remote repositories (private or community)
- Runs both ESLint and Ruff with a unified interface
- Provides context output for AI agents

---

## 3. Product Overview

### What cmc Does

1. **Manages linter configs** as generated artifacts from `cmc.toml`
2. **Inherits rules** from remote repositories (private git repos or community presets)
3. **Generates configs** for new projects (`cmc generate`)
4. **Syncs configs** for existing projects (`cmc sync`)
5. **Verifies configs** match the source of truth (`cmc audit`)
6. **Runs linters** (ESLint, Ruff) on specified files or directories
7. **Provides context** to AI coding agents so they write compliant code

### What cmc Does NOT Do

- Auto-fix code (delegates to existing pre-commit hooks)
- Replace linters (orchestrates them, doesn't replace them)
- Block commits or merges (reports only, humans decide)
- Auto-resolve config conflicts (reports conflicts, humans decide)

---

## 4. Core Principles

### 4.1 Single Source of Truth

`cmc.toml` is the authoritative definition of linting rules. Linter config files (eslint.config.js, ruff.toml) are generated artifacts.

### 4.2 Additive-Only Inheritance

Projects can only ADD rules or make rules STRICTER when extending a base config. They cannot disable or weaken inherited rules.

### 4.3 Linter-First

`cmc` uses existing project linters (ESLint, Ruff) as the verification mechanism. It delegates actual linting to native tools.

### 4.4 Graceful Degradation

If a linter is not installed, `cmc` silently skips it rather than failing. This allows gradual adoption.

### 4.5 Explicit Conflict Resolution

When syncing configs, `cmc` reports conflicts but never auto-resolves them. Humans decide how to handle conflicts.

### 4.6 Agent-Agnostic

`cmc` works with any AI coding tool by providing standardised context output.

---

## 5. Version Scope

### v1 MVP (Current)

The minimum viable product focuses on core functionality:

**Commands:**

- `cmc check` - Run linters and report violations
- `cmc generate` - Create linter configs from `cmc.toml` ruleset (overwrites)
- `cmc context` - Output rules for AI agents
- `cmc audit` - Check linter configs match ruleset (without running linters)

**Features:**

- ESLint + Ruff support
- Unified output format (text and JSON)
- Standard exit codes
- Graceful handling of missing linters
- Local `cmc.toml` configuration

### v2 (Config Inheritance)

**Commands:**

- `cmc sync` - Merge/amend rules into existing linter configs (with conflict detection)

**Features:**

- Remote config inheritance from git repositories
- Community presets from central repository
- Version pinning for remote configs (`@v1.0.0`, `@latest`)
- Additive-only rule inheritance (cannot weaken base rules)
- Conflict detection and reporting

---

## 6. Feature Specifications (v1 MVP)

### 6.1 CLI Commands

#### 6.1.1 `cmc check`

**Purpose:** Run linters on project files and report violations.

**Usage:**

```bash
cmc check                     # Check entire project
cmc check src/                # Check specific directory
cmc check src/main.ts         # Check specific file
cmc check --json              # Output as JSON
```

**Behaviour:**

1. Discovers `cmc.toml` by walking up from current directory
2. Validates config has required `[project] name`
3. Discovers source files (respects ignore patterns)
4. Routes files to appropriate linters (ESLint for JS/TS, Ruff for Python)
5. Collects violations from all linters
6. Outputs results in unified format
7. Exits with appropriate code

**Flags:**

| Flag     | Description            |
| -------- | ---------------------- |
| `--json` | Output results as JSON |

---

#### 6.1.2 `cmc generate`

**Purpose:** Generate linter config files from scratch using `cmc.toml` ruleset. Use this for new projects or when you want to completely replace existing configs.

**Usage:**

```bash
cmc generate eslint           # Generate eslint.config.js
cmc generate ruff             # Generate ruff.toml
```

**Behaviour:**

1. Reads `cmc.toml` ruleset configuration (including any `extends` in v2)
2. Checks if target config file already exists (exit with error unless `--force`)
3. Generates linter config with defined rules
4. Writes to standard location (or stdout if `--stdout`)
5. Includes header comment indicating file was generated by cmc

**Flags:**

| Flag       | Description                      |
| ---------- | -------------------------------- |
| `--force`  | Overwrite existing config file   |
| `--stdout` | Output to stdout instead of file |

**Generated File Locations:**

- ESLint: `eslint.config.js` (flat config format)
- Ruff: `ruff.toml`

**Linter Config Lifecycle:**

| State     | Command        | Use Case                                   |
| --------- | -------------- | ------------------------------------------ |
| Generated | `cmc generate` | New project, start fresh                   |
| Amended   | `cmc sync`     | Existing project, merge rules (v2)         |
| Verified  | `cmc audit`    | Check compliance without modifying configs |

---

#### 6.1.3 `cmc sync` (v2)

**Purpose:** Merge/amend rules from `cmc.toml` into existing linter config files. Use this for existing projects adopting cmc gradually.

**Usage:**

```bash
cmc sync eslint               # Sync rules into existing eslint.config.js
cmc sync ruff                 # Sync rules into existing ruff.toml
cmc sync                      # Sync all linter configs
```

**Behaviour:**

1. Reads `cmc.toml` ruleset configuration (including any `extends`)
2. Reads existing linter config file
3. Compares rules and detects conflicts
4. If conflicts exist: exit with error and report conflicts
5. If no conflicts: merge rules into existing config
6. Preserves existing rules not defined in `cmc.toml`

**Conflict Detection:**

A conflict occurs when:

- Existing config has a rule with a different value than `cmc.toml`
- Existing config weakens a rule from the base (e.g., `"error"` → `"warn"`)

**Example Conflict Output:**

```
✗ Conflicts detected in eslint.config.js:
  - "no-var": existing="warn", required="error"
  - "eqeqeq": existing="off", required="error"

Resolve conflicts manually, then run `cmc sync` again.
```

**Exit Codes:**

| Code | Meaning                      |
| ---- | ---------------------------- |
| 0    | Sync successful              |
| 1    | Conflicts detected           |
| 2    | Configuration error          |
| 3    | Linter config file not found |

---

#### 6.1.4 `cmc context`

**Purpose:** Append coding standards context to AI agent configuration files.

**Usage:**

```bash
cmc context --target claude   # Appends to CLAUDE.md
cmc context --target cursor   # Appends to .cursorrules
cmc context --target copilot  # Appends to .github/copilot-instructions.md
cmc context --stdout          # Output to stdout instead of file
```

**Behaviour:**

1. Reads `cmc.toml` to find configured templates in `[prompts]` section
2. Fetches `prompts.json` manifest from remote source (default: `github:chrismlittle123/check-my-code-community/prompts@latest`)
3. Resolves template versions and fetches template files
4. Concatenates multiple templates if specified
5. Appends content to target AI tool's configuration file (or outputs to stdout)

**Flags:**

| Flag              | Description                                      |
| ----------------- | ------------------------------------------------ |
| `--target <tool>` | Target AI tool: `claude`, `cursor`, or `copilot` |
| `--stdout`        | Output to stdout instead of appending to file    |

**Target File Locations:**

| Target  | File                              |
| ------- | --------------------------------- |
| claude  | `CLAUDE.md`                       |
| cursor  | `.cursorrules`                    |
| copilot | `.github/copilot-instructions.md` |

**Exit Codes:**

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| 0    | Success                                 |
| 2    | Configuration error (missing template)  |
| 3    | Runtime error (template file not found) |

---

#### 6.1.5 `cmc audit`

**Purpose:** Check that linter config files contain all rules defined in `cmc.toml` without running the linters or modifying any files. Use this in CI/CD to ensure configs haven't drifted.

**Usage:**

```bash
cmc audit                    # Audit all linter configs match cmc.toml
cmc audit eslint             # Audit only ESLint config
cmc audit ruff               # Audit only Ruff config
```

**Behaviour:**

1. Reads `cmc.toml` ruleset configuration (including any `extends` in v2)
2. Reads the corresponding linter config file(s)
3. For each rule in `cmc.toml`: checks if it exists with the exact same value in linter config
4. Extra rules in linter config (not in `cmc.toml`) are allowed
5. Reports any mismatches and exits with appropriate code

**Matching Rules:**

- Only rules defined in `cmc.toml` must be present in linter config
- Values must match exactly (e.g., `line-length = 120` must be exactly `120`)
- Extra rules in linter config are ignored (allowed)

**Output:**

```
✓ eslint.config.js matches cmc.toml ruleset
✗ ruff.toml has mismatches:
  - missing rule: line-length (expected 120)
  - different value: select (expected ["E", "F", "I", "UP"], got ["E", "F"])
```

**Exit Codes:**

| Code | Meaning                                |
| ---- | -------------------------------------- |
| 0    | All required rules match               |
| 1    | Mismatches found                       |
| 2    | Configuration error (missing cmc.toml) |
| 3    | Linter config file not found           |

---

### 6.2 Configuration System

#### 6.2.1 Project Configuration File

**File:** `cmc.toml` (located in project root)

**Purpose:** Defines project metadata, ruleset inheritance, and local rule overrides.

**Required:** Yes — `cmc` requires this file to run.

**Minimal Schema (v1):**

```toml
[project]
name = "my-project"
```

**Full Schema (v2 with inheritance):**

```toml
[project]
name = "my-project"

# Inherit rules from remote repositories (v2)
# Separate bases per linter - uses ambient git credentials
[extends]
eslint = "github:chrismlittle123/check-my-code-community/rulesets/typescript@v1.0.0"
ruff = "github:chrismlittle123/check-my-code-community/rulesets/python@latest"

# AI context templates (for `cmc context`)
[prompts]
templates = ["typescript/5.5", "python/3.12"]

# Local ESLint rule overrides - can only ADD rules, not weaken base rules
[rulesets.eslint.rules]
"no-console" = "error"                    # Adding a rule
"@typescript-eslint/no-explicit-any" = "error"

# Local Ruff configuration overrides
[rulesets.ruff]
line-length = 100                         # Can override if stricter

[rulesets.ruff.lint]
select = ["E", "F", "I", "UP", "B"]       # Can add more selections
```

#### 6.2.2 Remote Config Inheritance (v2)

**Purpose:** Inherit rules from remote git repositories to enforce organization-wide or community standards.

**Syntax:**

```
github:<owner>/<repo>/<path>@<version>
```

**Components:**

| Component | Description                             | Example                    |
| --------- | --------------------------------------- | -------------------------- |
| `owner`   | GitHub username or organization         | `chrismlittle123`          |
| `repo`    | Repository name                         | `check-my-code-community`  |
| `path`    | Path to directory containing `cmc.toml` | `rulesets/typescript`      |
| `version` | Git tag, branch, or `latest`            | `v1.0.0`, `main`, `latest` |

**Resolution:**

1. Clone/fetch the repository using ambient git credentials (SSH keys)
2. Checkout the specified version
3. Read `cmc.toml` from the specified path
4. Merge rules with local overrides (additive only)

**Example Remote Repository Structure:**

```
check-my-code-community/
├── rulesets/
│   ├── rulesets.json         # Ruleset manifest
│   ├── typescript/
│   │   └── 5.5/
│   │       └── eslint/
│   │           └── 1.0.0.toml
│   └── python/
│       └── 3.12/
│           └── ruff/
│               └── 1.0.0.toml
└── prompts/
    ├── prompts.json          # Prompts manifest
    ├── typescript/
    │   └── 5.5/
    │       └── 1.0.0.md
    └── python/
        └── 3.12/
            └── 1.0.0.md
```

**Community Repository:** `github:chrismlittle123/check-my-code-community`

#### 6.2.3 Additive-Only Inheritance

**Principle:** Projects can only ADD rules or make rules STRICTER when extending a base config. They cannot disable or weaken inherited rules.

**Allowed:**

```toml
# Base has: "no-var" = "error"
# Local adds new rule:
"no-console" = "error"         # ✅ Allowed - adding a rule
```

**Not Allowed:**

```toml
# Base has: "no-var" = "error"
# Local tries to weaken:
"no-var" = "warn"              # ❌ Blocked - weakening base rule
"no-var" = "off"               # ❌ Blocked - disabling base rule
```

**Enforcement:** `cmc generate` and `cmc sync` will error if local rules attempt to weaken base rules.

#### 6.2.4 AI Context Templates

**Location:** Fetched from community repository `prompts/` directory via manifest-based resolution.

**Purpose:** Pre-written markdown files containing coding standards and guidelines for AI agents.

**Template Resolution:** Template names in `[prompts].templates` are resolved via `prompts.json` manifest:

- `"typescript/5.5"` → looks up in `prompts.json`, resolves to `prompts/typescript/5.5/1.0.0.md`
- `"python/3.12"` → looks up in `prompts.json`, resolves to `prompts/python/3.12/1.0.0.md`
- `"typescript/5.5@1.0.0"` → pins specific version

**Multiple Templates:** When multiple templates are specified, they are concatenated in order.

#### 6.2.5 Configuration Discovery

When `cmc` runs, it discovers configuration by:

1. Looking for `cmc.toml` in current directory
2. If not found, traversing up to find `cmc.toml`
3. If no config found, exiting with error:

   ```
   Error: No cmc.toml found.

   Create a cmc.toml file with:
     [project]
     name = "your-project"
   ```

---

### 6.3 Linter Integration

#### 6.3.1 Supported Linters (v1)

| Language              | Linter | Config File        |
| --------------------- | ------ | ------------------ |
| TypeScript/JavaScript | ESLint | `eslint.config.js` |
| Python                | Ruff   | `ruff.toml`        |

#### 6.3.2 Execution Flow

1. Discover files in scope
2. Route files to appropriate linters by extension
3. Run linters using project's native config files
4. Collect violations from linter JSON output
5. Report violations to stdout in unified format

#### 6.3.3 File Extension Routing

| Extensions                                   | Linter |
| -------------------------------------------- | ------ |
| `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` | ESLint |
| `.py`, `.pyi`                                | Ruff   |

#### 6.3.4 Missing Linter Handling

If a linter is not installed, `cmc` silently skips files for that linter. This enables graceful degradation:

- Project with only TypeScript: Works without Ruff installed
- Project with only Python: Works without ESLint installed
- Mixed project: Checks whatever linters are available

---

### 6.4 Output & Exit Codes

#### 6.4.1 CLI Output Format

**Default output:**

```
src/main.py:15 [ruff/F401] 'os' imported but unused
src/utils.ts:42 [eslint/no-var] Unexpected var, use let or const instead

✗ 2 violations found
```

**No violations:**

```
✓ No violations found (10 files checked)
```

**JSON output (`--json`):**

```json
{
  "violations": [
    {
      "file": "src/main.py",
      "line": 15,
      "column": 1,
      "rule": "F401",
      "message": "'os' imported but unused",
      "linter": "ruff"
    }
  ],
  "summary": {
    "files_checked": 10,
    "violations_count": 1
  }
}
```

#### 6.4.2 Exit Codes

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| 0    | No violations                                          |
| 1    | Violations found                                       |
| 2    | Configuration error (invalid cmc.toml, missing config) |
| 3    | Runtime error (linter failed)                          |

---

### 6.5 MCP Server

#### 6.5.1 Overview

`cmc` includes an MCP (Model Context Protocol) server that enables AI agents (Claude Code, Cursor, Codex, Gemini) to proactively lint code and enforce coding standards.

**Usage:**

```bash
# Claude Code
claude mcp add cmc -- npx -y check-my-code mcp-server

# Cursor / Claude Desktop / other MCP clients
# Add to MCP config JSON:
{
  "mcpServers": {
    "cmc": {
      "command": "npx",
      "args": ["-y", "check-my-code", "mcp-server"]
    }
  }
}
```

#### 6.5.2 MCP Tools

| Tool              | Description                                | Parameters             |
| ----------------- | ------------------------------------------ | ---------------------- |
| `check_files`     | Lint specific files                        | `files: string[]`      |
| `check_project`   | Lint entire project or subdirectory        | `path?: string`        |
| `fix_files`       | Auto-fix violations in files               | `files: string[]`      |
| `get_guidelines`  | Fetch coding standards templates           | `templates?: string[]` |
| `get_status`      | Get current session state                  | (none)                 |
| `suggest_config`  | Generate cmc.toml from project description | `description: string`  |
| `validate_config` | Validate TOML against cmc.toml schema      | `config: string`       |

#### 6.5.3 Tool Response Format

All tools return structured JSON responses:

**Success:**

```json
{
  "success": true,
  "violations": [...],
  "files_checked": 5,
  "has_violations": true
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "CONFIG_NOT_FOUND",
    "message": "No cmc.toml found in project",
    "recoverable": false
  }
}
```

**Error Codes:**

- `CONFIG_NOT_FOUND` - No cmc.toml in project
- `CONFIG_INVALID` - Invalid cmc.toml
- `FILE_NOT_FOUND` - Requested file doesn't exist
- `TEMPLATE_NOT_FOUND` - Requested template doesn't exist
- `RUNTIME_ERROR` - Linter execution failed
- `VALIDATION_ERROR` - Generated config failed schema validation

#### 6.5.4 suggest_config Tool

**Purpose:** Generate a valid `cmc.toml` configuration based on a natural language project description. This enables AI agents to bootstrap new projects or suggest configurations for existing projects without a `cmc.toml`.

**Parameters:**

| Parameter     | Type   | Required | Description                                 |
| ------------- | ------ | -------- | ------------------------------------------- |
| `description` | string | Yes      | Natural language description of the project |

**Behaviour:**

1. AI agent calls `suggest_config` with a project description (e.g., "A TypeScript REST API using Express with strict type checking")
2. Tool returns a prompt with schema guidance and examples
3. AI agent generates TOML config based on the prompt
4. AI agent calls `validate_config` to verify the generated config
5. If valid, the config can be written to `cmc.toml`

**Response:**

```json
{
  "success": true,
  "prompt": "Generate a valid cmc.toml configuration for...",
  "schema_version": "1.0.0",
  "validation_endpoint": "Use validate_config tool to validate the generated TOML"
}
```

**Use Cases:**

- AI agent bootstrapping a new project
- Suggesting stricter rules for production services
- Migrating existing projects to use `cmc`

#### 6.5.5 validate_config Tool

**Purpose:** Validate TOML content against the `cmc.toml` schema. Use after `suggest_config` to verify generated configuration is valid.

**Parameters:**

| Parameter | Type   | Required | Description                                      |
| --------- | ------ | -------- | ------------------------------------------------ |
| `config`  | string | Yes      | TOML content to validate against cmc.toml schema |

**Response (valid):**

```json
{
  "success": true,
  "validated": true,
  "config": "[project]\nname = \"my-api\"\n...",
  "parsed": { "project": { "name": "my-api" }, ... },
  "schema_version": "1.0.0"
}
```

**Response (invalid):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid config:\nproject.name: project name cannot be empty",
    "recoverable": true
  }
}
```

---

## 7. Feature Specifications (v2 Future)

### 7.1 Config Inheritance

Remote config inheritance from git repositories:

- Community presets from central repository
- Version pinning for remote configs (`@v1.0.0`, `@latest`)
- Additive-only rule inheritance (cannot weaken base rules)
- Conflict detection and reporting
- `cmc sync` command to merge/amend rules into existing configs

### 7.2 Environment Enforcers

Meta-standard enforcement for development environments:

```toml
[project]
name = "payment-service"
tier = "production"

[enforcers]
# Require the use of a polyglot version manager
polyglot_manager = "mise"

# Require containerization tool
container_runtime = "docker"

[requirements]
# Verify required configuration files exist
file_exists = [
    ".tool-versions",      # Required by mise
    ".nvmrc",              # Common for Node projects
    "Dockerfile",          # Required by Docker
    "docker-compose.yml"   # Docker Compose config
]
```

**Enforcer Types:**

| Enforcer            | Description                  | Validates       |
| ------------------- | ---------------------------- | --------------- |
| `polyglot_manager`  | Version manager enforcement  | mise, asdf, rtx |
| `container_runtime` | Containerization enforcement | docker, podman  |
| `file_exists`       | Required file presence       | Any file paths  |

**Use Cases:**

- Ensure all projects use consistent version management
- Enforce containerization standards (Docker/Podman)
- Verify required configuration files are present
- Enforce tool consistency across teams

### 7.3 Extended Linting Categories

Additional linting beyond style violations:

**Formatting:**

- Code formatting standards (Prettier, Black)
- Import ordering
- Consistent indentation

**Type Safety:**

- TypeScript strict mode enforcement
- Python type hints coverage
- Generic type usage

**Security:**

- Secrets detection
- Dependency vulnerability scanning
- Unsafe code patterns

**Complexity:**

- Cyclomatic complexity limits
- Function length limits
- File size limits

### 7.4 Custom Hooks

User-defined validation scripts:

```toml
[hooks]
pre_check = "./scripts/validate-env.sh"
post_check = "./scripts/notify-violations.sh"
```

### 7.5 Additional Commands

- `cmc diff` - Show changes since last check
- `cmc dry-run` - Preview what would be checked
- `cmc report` - Generate detailed reports (including HTML)

### 7.6 Enhanced Features

- Smart checking with file hash caching
- Colored output and progress indicators
- Nested config inheritance (base extends another base)
- Multiple inheritance sources per linter

### 7.7 CI/CD Integration

Encapsulate CI/CD rules, thresholds, and workflows as part of the `cmc.toml` configuration. This extends `cmc` from a linting tool to a complete code quality pipeline manager.

**Inspiration:** [cookiecutter-uv-hypermodern-python](https://github.com/bosd/cookiecutter-uv-hypermodern-python) provides a reference for modern Python project standards.

```toml
[project]
name = "payment-service"
tier = "production"  # Controls default thresholds

[ci]
# Code coverage configuration
[ci.coverage]
provider = "codecov"           # codecov, coveralls, or local
threshold = 80                 # Minimum coverage percentage
fail_under = 70                # Hard fail threshold
exclude = ["tests/**", "scripts/**"]

# Tier-based threshold presets
[ci.coverage.tiers]
production = 90
internal = 80
experimental = 60

[ci.tests]
# Test runner configuration
runner = "pytest"              # pytest, vitest, jest
parallel = true
timeout = 300                  # seconds
on_pull_request = true         # Run tests on PRs
on_push = ["main", "develop"]  # Branches to test on push

# Python-specific test config
[ci.tests.pytest]
markers = ["unit", "integration", "e2e"]
fail_fast = true
coverage = true

# Node-specific test config
[ci.tests.vitest]
coverage_provider = "v8"

[ci.branch_protection]
# Branch protection rules (can generate GitHub/GitLab configs)
main = { require_reviews = 2, require_status_checks = true, require_linear_history = true }
develop = { require_reviews = 1, require_status_checks = true }

[ci.releases]
# Release management
versioning = "bumpver"         # bumpver, semantic-release, changesets
tag_format = "v{version}"
changelog = true
```

**Commands:**

```bash
cmc ci generate github     # Generate .github/workflows/*.yml
cmc ci generate gitlab     # Generate .gitlab-ci.yml
cmc ci audit               # Verify CI config matches cmc.toml
cmc ci status              # Show current CI/CD configuration
```

**CI/CD Features:**

| Feature             | Description                                             |
| ------------------- | ------------------------------------------------------- |
| Coverage thresholds | Tier-based coverage requirements with fail conditions   |
| Test runners        | Configure pytest, vitest, jest with consistent settings |
| Branch protection   | Generate GitHub/GitLab branch protection rules          |
| PR workflows        | Auto-generate test/lint workflows for pull requests     |
| Release automation  | Integrate with bumpver, semantic-release for versioning |
| Status checks       | Define required status checks per branch                |

**Use Cases:**

- Enforce minimum 90% coverage for production services
- Ensure all PRs run tests before merge
- Standardize branch protection across repositories
- Generate CI workflow files from a single source of truth
- Tier-based quality gates (stricter for production, relaxed for experiments)

**PR Constraints:**

Extend CI/CD configuration to enforce small, atomic PRs:

```toml
[ci.pr]
max_files_changed = 20                # Encourage small PRs
max_lines_changed = 500               # Limit PR size
require_tests = true                  # PR must include test changes
require_description = true            # PR must have description
```

### 7.8 MCP Server Configuration

Define recommended and required MCP servers for AI coding agents. This ensures consistent tooling across the team and enables agents to access approved resources.

```toml
[mcp]
# Recommended MCP servers for this project
servers = [
    "context7",                        # Library documentation
    "cmc",                             # check-my-code linting
    "github"                           # GitHub integration
]

# Required servers (agent setup will warn if missing)
required = ["cmc"]

# Server-specific configuration
[mcp.context7]
enabled = true
cache_ttl = 3600                       # Cache docs for 1 hour

[mcp.cmc]
enabled = true
auto_check = true                      # Auto-lint on file save
```

**Use Cases:**

- Standardize which MCP servers the team uses
- Ensure agents have access to up-to-date library documentation (Context7)
- Warn developers if required MCP servers are not configured
- Provide server-specific settings per project

### 7.9 Documentation Requirements

Enforce documentation standards based on project tier. Verify required documentation files exist and meet basic structural requirements.

```toml
[docs]
# ADR (Architectural Decision Records) requirements
require_adr = true                     # Tier 2+ should have ADRs
adr_path = "docs/adr/"                 # Where ADRs live
adr_template = "docs/adr/template.md"  # Optional template file

# Diagram requirements (Tier 3)
require_diagrams = true
diagram_path = "docs/diagrams/"
diagram_formats = ["mermaid", "svg"]   # Accepted formats

# Testing documentation
manual_testing_checklist = "TESTING_CHECKLIST.md"  # Required for Tier 3
regression_test_path = "tests/regression/"          # Verify regression tests exist

# README requirements
require_readme = true
readme_sections = ["Installation", "Usage", "Testing"]  # Required sections
```

**Commands:**

```bash
cmc docs audit                 # Verify documentation requirements
cmc docs init                  # Generate documentation scaffolding
```

**Tier-Based Defaults:**

| Requirement       | Tier 1   | Tier 2              | Tier 3                     |
| ----------------- | -------- | ------------------- | -------------------------- |
| README            | Optional | Required            | Required + sections        |
| ADRs              | None     | For major decisions | All architecture decisions |
| Diagrams          | None     | Optional            | Required for complex flows |
| Testing checklist | None     | Brief               | Comprehensive              |
| Regression tests  | None     | Basic               | Comprehensive suite        |

### 7.10 Security Scanning

Integrate security scanning tools to detect secrets, vulnerabilities, and unsafe patterns before they reach the repository.

```toml
[security]
# Secrets detection
secrets_scanner = "gitleaks"           # gitleaks, detect-secrets, trufflehog
secrets_config = ".gitleaks.toml"      # Custom config file
scan_on_commit = true                  # Run in pre-commit hook
fail_on_secrets = true                 # Block commits with secrets

# Blocked commands (for AI agents like Claude Code)
[security.blocked_commands]
patterns = [
    "rm -rf /",
    "rm -rf ~",
    "docker run --privileged",
    "> /dev/sda",
    "chmod 777",
    "curl | bash",
    "wget | sh"
]

# Dependency vulnerability scanning
[security.dependencies]
scanner = "npm-audit"                  # npm-audit, pip-audit, safety
fail_on_severity = "high"              # low, medium, high, critical
ignore_advisories = []                 # CVEs to ignore (with justification)

# Code security patterns
[security.code]
check_sql_injection = true
check_xss = true
check_command_injection = true
```

**Commands:**

```bash
cmc security scan              # Run all security scans
cmc security secrets           # Scan for secrets only
cmc security deps              # Scan dependencies only
cmc security audit             # Full security audit report
```

**Integration:**

- Pre-commit hooks for secrets detection
- CI/CD pipeline integration for dependency scanning
- Generate `.gitleaks.toml` or `.pre-commit-config.yaml` from cmc.toml
- Export blocked commands config for Claude Code / Cursor

**Use Cases:**

- Prevent secrets from being committed to repositories
- Block dangerous commands in AI coding agents
- Scan dependencies for known vulnerabilities
- Enforce OWASP security patterns in code

### 7.11 AI Agent Security & Configuration

Unified security enforcement and configuration management for all AI coding agents. CMC generates and audits agent-specific config files from a single source of truth.

**Supported Agents:**

| Agent          | Config File                     | Capabilities                             |
| -------------- | ------------------------------- | ---------------------------------------- |
| Claude Code    | `.claude/settings.json`         | Deny commands, paths, tools; permissions |
| Cursor         | `.cursor/rules`, `.cursorrules` | Rules, deny patterns, context            |
| GitHub Copilot | `.github/copilot-settings.json` | Content exclusions                       |
| Windsurf       | `.windsurfrules`                | Rules and restrictions                   |
| Aider          | `.aider.conf.yml`               | Model settings, file restrictions        |

**Configuration:**

```toml
[ai.security]
# Universal deny rules (applied to all agents)
deny_commands = [
    "rm -rf /",
    "rm -rf ~",
    "rm -rf .",
    "docker run --privileged",
    "> /dev/sda",
    "chmod 777",
    "curl | bash",
    "wget | sh",
    "git push --force origin main",
    "DROP TABLE",
    "DELETE FROM"
]

deny_paths = [
    ".env*",
    "*.pem",
    "*.key",
    "**/secrets/**",
    "**/credentials/**",
    "**/.aws/**",
    "**/node_modules/**"
]

deny_patterns = [
    "password\\s*=",
    "api_key\\s*=",
    "secret\\s*="
]

# Tool restrictions (for agents that support it)
[ai.security.tools]
# Allowlist approach (more restrictive)
# allow = ["Read", "Edit", "Grep", "Glob", "Write"]
# Denylist approach (less restrictive)
deny = ["Bash"]  # Or specific dangerous tools

[ai.security.files]
max_file_size = 100000               # Bytes - prevent reading huge files
deny_binary = true                   # Block binary file access
deny_extensions = [".exe", ".dll", ".so", ".dylib"]

# Agent-specific overrides
[ai.claude]
# Claude Code specific settings
permissions = {
    allow_bash = "ask",              # ask, allow, deny
    allow_write = "allow",
    allow_mcp = "allow"
}
max_context_tokens = 100000

[ai.cursor]
# Cursor specific settings
always_apply_rules = true
index_exclude = ["dist/**", "build/**", "node_modules/**"]

[ai.copilot]
# GitHub Copilot specific
content_exclusion_patterns = ["*.env", "*.pem", "*.key"]
```

**Templates:**

CMC can apply security templates based on project tier:

```toml
[ai.security]
# Use predefined security template
template = "production"              # minimal, standard, production, paranoid

# Templates define sensible defaults:
# - minimal: Basic deny patterns only
# - standard: Common dangerous commands blocked
# - production: Strict path/file restrictions, tool limits
# - paranoid: Allowlist-only, maximum restrictions
```

**Commands:**

```bash
cmc ai generate                # Generate all agent configs
cmc ai generate claude         # Generate .claude/settings.json
cmc ai generate cursor         # Generate .cursorrules
cmc ai generate copilot        # Generate .github/copilot-settings.json

cmc ai audit                   # Verify all agent configs match cmc.toml
cmc ai audit claude            # Audit specific agent config

cmc ai diff                    # Show drift between cmc.toml and agent configs

cmc ai templates               # List available security templates
cmc ai templates show production  # Show what a template includes
```

**Generated Files:**

Example `.claude/settings.json` generated from cmc.toml:

```json
{
  "permissions": {
    "allow_bash": "ask",
    "allow_write": "allow",
    "allow_mcp": "allow"
  },
  "deny": {
    "commands": ["rm -rf /", "docker run --privileged", ...],
    "paths": [".env*", "*.pem", "**/secrets/**", ...],
    "tools": ["Bash"]
  },
  "generated_by": "check-my-code",
  "generated_at": "2025-12-04T10:30:00Z",
  "source": "cmc.toml"
}
```

**Enforcement Modes:**

| Mode       | Behavior                                                         |
| ---------- | ---------------------------------------------------------------- |
| `generate` | Create agent config files from cmc.toml                          |
| `audit`    | Check configs match cmc.toml, report drift                       |
| `sync`     | Update agent configs to match cmc.toml (with conflict detection) |
| `verify`   | CI check that fails if configs don't match                       |

**Use Cases:**

- Enforce consistent security rules across all AI coding tools
- Prevent agents from accessing secrets, credentials, or sensitive paths
- Block dangerous commands before they execute
- Apply tier-based security templates (stricter for production projects)
- Audit drift between cmc.toml and actual agent configurations
- Onboard new developers with correct agent security settings automatically

### 7.12 Code Quality & Conventions

Comprehensive code quality enforcement covering size limits, complexity metrics, naming conventions, and structural requirements. This extends CMC beyond linting to full codebase health management.

**Configuration:**

```toml
[code.limits]
# Size limits - prevent god files/functions/classes
max_file_lines = 300
max_function_lines = 50
max_class_lines = 200
max_parameters = 5
max_nesting_depth = 4

[code.metrics]
# Complexity thresholds
analyzer = "radon"                     # radon (Python), escomplex (JS/TS)
max_cyclomatic = 10                    # Cyclomatic complexity per function
max_cognitive = 15                     # Cognitive complexity per function
maintainability_threshold = 20         # Radon maintainability index (A/B grade)
halstead_threshold = 100               # Halstead difficulty

[code.quality]
# Dead code and duplication
dead_code_scanner = "vulture"          # vulture (Python), ts-prune (TS)
dead_code_threshold = 0                # Zero tolerance for dead code
duplication_scanner = "jscpd"          # jscpd, CPD
duplication_threshold = 5              # Max allowed duplicate blocks
min_duplicate_lines = 5                # Minimum lines to count as duplicate

[code.patterns]
# Forbidden patterns (regex) - fail if found
forbid = [
    "dict\\[",                          # Force typed dicts/dataclasses/Pydantic
    "Dict\\[",
    "Any\\]",                           # No Any types in production
    "# type: ignore$",                  # No blanket type ignores (must have code)
    "# noqa$",                          # No blanket noqa (must have code)
    "TODO",                             # No TODOs in production tier
    "FIXME",
    "HACK",
    "print\\(",                         # No print statements (use logging)
    "console\\.log"
]

# Required patterns - fail if NOT found
require = [
    "__all__"                           # Python modules must export explicitly
]

[conventions.files]
# File naming conventions
casing = "snake_case"                  # snake_case, kebab-case, PascalCase
extension_map = { yaml = "yml", jpeg = "jpg" }  # Normalize extensions
max_path_length = 100                  # Prevent deeply nested paths

[conventions.structure]
# Required directory structure
required_dirs = [
    "src/domain",
    "src/application",
    "src/infrastructure",
    "tests/unit",
    "tests/integration"
]

# Required files
required_files = [
    "README.md",
    "pyproject.toml",                  # or package.json
    ".gitignore"
]

[git.commits]
# Commit message format (conventional commits)
pattern = "^(feat|fix|chore|docs|refactor|test|perf|ci)(\\(\\w+\\))?: .{1,50}"
require_issue = true                   # Must reference an issue
issue_pattern = "PROJ-\\d+"            # Jira/Linear ticket format
max_subject_length = 50
max_body_line_length = 72
require_body = false                   # Require commit body for non-trivial changes

[git.hooks]
# Pre-commit hook configuration
check_merge_conflict = true            # Fail if conflict markers present
trailing_whitespace = true             # Remove trailing whitespace
end_of_file_fixer = true               # Ensure files end with newline
mixed_line_endings = "lf"              # lf, crlf, or native
no_commit_to_branch = ["main", "master", "production"]
detect_private_key = true              # Block commits with private keys
check_added_large_files = 500          # KB - warn on large file additions

[docs.docstrings]
# Docstring requirements
style = "google"                       # google, numpy, sphinx, epytext
scanner = "interrogate"                # interrogate (Python), typedoc (TS)
coverage_threshold = 80                # Minimum docstring coverage %
require_for = ["public"]               # public, all, none
fail_under = 70                        # Hard fail threshold

[rulesets.mypy]
# Python type checking
enabled = true
strict = true
ignore_missing_imports = false
disallow_untyped_defs = true
disallow_any_explicit = true           # No explicit Any
warn_return_any = true

[rulesets.yaml]
# YAML file linting
scanner = "yamllint"
max_line_length = 120
allow_duplicate_keys = false

[rulesets.json]
# JSON file linting
scanner = "jsonlint"
allow_comments = false
allow_trailing_commas = false

[api]
# API specification enforcement
openapi_path = "openapi.yaml"
openapi_diff = true                    # Fail if spec changes without version bump
require_openapi_version = true         # Spec version must match package version
validate_examples = true               # Validate OpenAPI examples against schema

[testing.integration]
# Integration test requirements
require_endpoint_coverage = true       # All API endpoints must have tests
endpoint_discovery = "openapi"         # openapi, fastapi, flask, express
coverage_threshold = 100               # % of endpoints that must be tested
```

**Commands:**

```bash
cmc quality                    # Run all quality checks
cmc quality limits             # Check size limits only
cmc quality metrics            # Check complexity metrics only
cmc quality patterns           # Check forbidden/required patterns
cmc quality duplication        # Check code duplication

cmc conventions                # Check all conventions
cmc conventions files          # Check file naming
cmc conventions structure      # Check directory structure

cmc score                      # Aggregate quality score
cmc score --details            # Detailed breakdown
cmc score --json               # JSON output for CI
```

**Quality Score Output:**

```
📊 Codebase Quality Score: 73/100

  Linting:        95/100  ✓
  Type Safety:    80/100  ✓
  Test Coverage:  65/100  ⚠
  Complexity:     70/100  ⚠
  Documentation:  55/100  ✗
  Security:       90/100  ✓
  Architecture:   75/100  ⚠

Improvements needed:
  - 12 functions exceed max_cyclomatic (10)
  - 3 files missing docstrings
  - tests/integration coverage at 65% (target: 100%)

Run `cmc quality --fix` to auto-fix where possible
Run `cmc score --details` for full breakdown
```

**Tier-Based Defaults:**

| Check               | Tier 1 (Prototype) | Tier 2 (Internal) | Tier 3 (Production) |
| ------------------- | ------------------ | ----------------- | ------------------- |
| max_file_lines      | 1000               | 500               | 300                 |
| max_function_lines  | 100                | 75                | 50                  |
| max_cyclomatic      | 20                 | 15                | 10                  |
| docstring_coverage  | 0%                 | 50%               | 80%                 |
| forbid patterns     | None               | Basic             | Strict              |
| require_issue       | No                 | Yes               | Yes                 |
| dead_code_threshold | 50                 | 10                | 0                   |

**Use Cases:**

- Prevent file/function bloat before it happens
- Enforce consistent naming conventions across the team
- Block commits that don't reference tickets
- Detect and remove dead code automatically
- Find copy-paste duplication early
- Generate aggregate quality scores for dashboards
- Gradually increase strictness as project matures (tier promotion)

---

## 8. Technical Specifications

### 8.1 Technology Stack

| Component         | Technology           |
| ----------------- | -------------------- |
| Language          | TypeScript (Node.js) |
| Package Manager   | npm                  |
| CLI Framework     | Commander.js         |
| Config Parsing    | @iarna/toml          |
| Schema Validation | Zod                  |
| File Discovery    | glob                 |

### 8.2 Directory Structure

```
check-my-code/
├── src/
│   ├── cli/
│   │   ├── index.ts           # CLI entry point
│   │   └── commands/
│   │       ├── check.ts       # Run linters and report violations
│   │       ├── context.ts     # Append AI context from remote templates
│   │       ├── generate.ts    # Generate linter configs from cmc.toml
│   │       └── audit.ts      # Audit linter configs match cmc.toml
│   ├── config/
│   │   └── loader.ts          # Config discovery and parsing (Zod validation)
│   ├── remote/
│   │   └── fetcher.ts         # Git-based remote file fetching
│   ├── linter.ts              # ESLint and Ruff execution
│   └── types.ts               # TypeScript interfaces
├── package.json
├── tsconfig.json
└── README.md
```

### 8.3 External Dependencies

**Runtime:**

- Node.js >= 18

**Linters (user-installed):**

- ESLint (TypeScript/JavaScript)
- Ruff (Python)

---

## 9. Glossary

| Term        | Definition                                                |
| ----------- | --------------------------------------------------------- |
| **Ruleset** | A collection of linter rules defined in `cmc.toml` format |
| **Rule**    | A single linter configuration (e.g., `"no-var": "error"`) |
| **Context** | Rules formatted for consumption by AI coding agents       |
| **Agent**   | An AI coding tool (Claude Code, Codex, Gemini CLI)        |
