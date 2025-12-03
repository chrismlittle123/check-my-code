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

| Tool             | Description                         | Parameters             |
| ---------------- | ----------------------------------- | ---------------------- |
| `check_files`    | Lint specific files                 | `files: string[]`      |
| `check_project`  | Lint entire project or subdirectory | `path?: string`        |
| `fix_files`      | Auto-fix violations in files        | `files: string[]`      |
| `get_guidelines` | Fetch coding standards templates    | `templates?: string[]` |
| `get_status`     | Get current session state           | (none)                 |

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

[requirements]
# Verify required configuration files exist
file_exists = [
    ".tool-versions",      # Required by mise
    ".nvmrc"               # Common for Node projects
]
```

**Enforcer Types:**

| Enforcer           | Description                 | Validates       |
| ------------------ | --------------------------- | --------------- |
| `polyglot_manager` | Version manager enforcement | mise, asdf, rtx |
| `file_exists`      | Required file presence      | Any file paths  |

**Use Cases:**

- Ensure all projects use consistent version management
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
