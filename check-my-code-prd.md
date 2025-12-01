# Product Requirements Document: check-my-code (cmc)

**Version:** 1.0
**Date:** November 2025
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Overview](#3-product-overview)
4. [Target Users](#4-target-users)
5. [Core Principles](#5-core-principles)
6. [Version Scope](#6-version-scope)
7. [Feature Specifications (v1 MVP)](#7-feature-specifications-v1-mvp)
   - 7.1 [CLI Commands](#71-cli-commands)
   - 7.2 [Configuration System](#72-configuration-system)
   - 7.3 [Ruleset System](#73-ruleset-system)
   - 7.4 [Linter Integration](#74-linter-integration)
   - 7.5 [Output & Exit Codes](#75-output--exit-codes)
8. [Feature Specifications (v2 Future)](#8-feature-specifications-v2-future)
9. [Technical Specifications](#9-technical-specifications)
10. [User Workflows](#10-user-workflows)
11. [Glossary](#11-glossary)

---

## 1. Executive Summary

**check-my-code** (`cmc`) is a CLI tool that verifies code adherence to configurable rulesets. It is designed for teams using diverse AI coding agents (Claude Code, Codex, Gemini CLI) working across multiple repositories, providing a unified way to enforce coding standards without per-repository configuration overhead.

The tool acts as both:

- A **verification layer** that checks code against defined standards
- A **context provider** for AI coding agents, ensuring they write compliant code from the start

---

## 2. Problem Statement

### Current Challenges

1. **Inconsistent coding standards**: Teams using multiple AI coding tools (Claude Code, Codex, Gemini CLI, Cursor) produce code with varying styles and quality levels.

2. **Per-repository overhead**: Maintaining git hooks, linter configs, and style guides for each repository is time-consuming and leads to drift.

3. **No unified enforcement**: Existing tools (ESLint, Ruff, etc.) operate independently without a unified layer that can enforce both mechanical and subjective standards.

4. **Context gap for AI agents**: AI coding tools don't automatically know the team's specific coding standards, leading to non-compliant code that requires manual correction.

5. **Production vs. throwaway ambiguity**: No systematic way to apply different standards based on code purpose (production, prototype, internal tooling).

### Desired Outcome

A single tool that:

- Centralises coding standards in version-controlled, shareable rulesets
- Works across all repositories without per-repo configuration
- Integrates with any AI coding agent
- Distinguishes between code categories (production, prototype, etc.)
- Provides both pre-write guidance and post-write verification

---

## 3. Product Overview

### What cmc Does

1. **Defines rulesets** in `cmc.toml` as the single source of truth for coding standards
2. **Supports community rulesets** that can be extended and merged with local configuration
3. **Generates linter configs** (eslint.config.js, ruff.toml) from rulesets
4. **Verifies linter configs** match the required ruleset before running checks
5. **Runs linters** (ESLint, Ruff) using native tooling
6. **Reports violations** with file paths and line numbers
7. **Provides context** to AI coding agents so they write compliant code

### What cmc Does NOT Do

- Auto-fix code (delegates to existing pre-commit hooks)
- Replace linters (orchestrates them, doesn't replace them)
- Block commits or merges (reports only, humans decide)

---

## 4. Target Users

### Primary Users

- **Software engineers** using AI coding tools who want consistent, standards-compliant code
- **Tech leads** who need to ensure team-wide code quality
- **DevOps engineers** integrating quality checks into CI/CD pipelines

### Team Context

- Teams of 2-20 engineers
- Using multiple AI coding tools simultaneously
- Managing multiple repositories
- Needing both mechanical checks (linting) and subjective checks (meaningful names)

---

## 5. Core Principles

### 5.1 Read-Only Verification

`cmc` tells you what's wrong but never modifies files. Auto-fixing remains the responsibility of existing pre-commit hooks and formatters.

### 5.2 Linter-First

`cmc` always uses existing project linters/formatters (ESLint, Ruff) as the verification mechanism. It generates and verifies linter configs but delegates actual linting to native tools.

### 5.3 Single Source of Truth

`cmc.toml` is the authoritative definition of coding standards. Linter configs (eslint.config.js, ruff.toml) are generated from it and verified against it before checks run.

### 5.4 Agent-Agnostic

`cmc` works with any AI coding tool by providing standardised context output.

### 5.5 Config Validation via JSON Schema

`cmc.toml` is validated against a JSON Schema to ensure configuration correctness before any operations run.

### 5.6 Local Overrides Community

When extending community rulesets, local configuration always takes precedence over community defaults.

---

## 6. Version Scope

### v1 MVP

The minimum viable product focuses on core functionality:

**Commands:**

- `cmc init` - Generate minimal configuration
- `cmc check` - Verify configs and run linters
- `cmc generate` - Create linter configs from ruleset
- `cmc verify` - Check linter configs match ruleset
- `cmc update` - Fetch/update community rulesets
- `cmc context` - Output rules for AI agents

**Features:**

- JSON Schema validation of `cmc.toml`
- Community ruleset extension/merging
- ESLint + Ruff support
- Basic CLI output
- Standard exit codes

### v2 Future

Features deferred to future versions:

- `cmc diff` - Show changes since last check
- `cmc dry-run` - Preview what would be checked
- `cmc report` - Generate detailed reports (including HTML)
- AI-assisted checks for subjective rules
- Smart checking (file hash caching)
- Interactive init wizard
- Shell completion
- Progress indicators and spinners
- Verbose/quiet output modes
- Colored output

---

## 7. Feature Specifications (v1 MVP)

### 7.1 CLI Commands

#### 7.1.1 `cmc init`

**Purpose:** Generate a minimal configuration file.

**Usage:**

```bash
cmc init                      # Generate minimal cmc.toml
```

**Behaviour:**

1. Check if `cmc.toml` already exists (exit with error if so, unless `--force`)
2. Detect project characteristics (languages by file extensions)
3. Generate minimal `cmc.toml` with placeholders
4. Print next steps to stdout

**Flags:**
| Flag | Description |
|------|-------------|
| `--force` | Overwrite existing `cmc.toml` |

---

#### 7.1.2 `cmc check`

**Purpose:** Verify linter configs match ruleset, then run linters.

**Usage:**

```bash
cmc check                     # Check entire project
cmc check src/                # Check specific path
```

**Behaviour:**

1. Reads and validates `cmc.toml` against JSON Schema
2. Resolves community rulesets (if extended)
3. Verifies project linter configs contain all required rules from ruleset
4. If verification fails, exits with error showing missing/disabled rules
5. Runs linter checks (ESLint, Ruff) using project's native configs
6. Outputs violations to stdout
7. Exits with appropriate code

**Flags:**
| Flag | Description |
|------|-------------|
| `--no-verify` | Skip linter config verification |
| `--json` | Output results as JSON |

---

#### 7.1.3 `cmc generate`

**Purpose:** Generate linter config files from `cmc.toml` ruleset.

**Usage:**

```bash
cmc generate eslint           # Generate eslint.config.js
cmc generate ruff             # Generate ruff.toml
```

**Behaviour:**

1. Reads and validates `cmc.toml`
2. Resolves community rulesets (if extended)
3. Merges rules (local overrides community)
4. Generates linter config with all required rules
5. Writes to standard location (or stdout if `--stdout`)
6. Includes header comment indicating file was generated by cmc

**Flags:**
| Flag | Description |
|------|-------------|
| `--force` | Overwrite existing config file |
| `--stdout` | Output to stdout instead of file |

**Generated File Locations:**

- ESLint: `eslint.config.js` (flat config format)
- Ruff: `ruff.toml`

---

#### 7.1.4 `cmc verify`

**Purpose:** Verify project linter configs match ruleset requirements (without running linters).

**Usage:**

```bash
cmc verify                    # Verify all linter configs
cmc verify eslint             # Verify only ESLint config
cmc verify ruff               # Verify only Ruff config
```

**Behaviour:**

1. Parses project's linter config files
2. Checks each required rule from `cmc.toml` is present and at least as strict
3. Reports missing or insufficiently strict rules
4. Exits with code 0 (all rules valid) or 1 (issues found)

---

#### 7.1.5 `cmc update`

**Purpose:** Fetch latest versions of configured community rulesets.

**Usage:**

```bash
cmc update                    # Update all rulesets
```

**Behaviour:**

1. Reads `cmc.toml` to find extended community rulesets
2. Fetches latest versions from Git repositories
3. Updates local cache
4. Reports what was updated

---

#### 7.1.6 `cmc context`

**Purpose:** Output active rules formatted for AI agent consumption.

**Usage:**

```bash
cmc context                   # Output markdown for AI agents
```

**Behaviour:**

1. Resolves all active rulesets
2. Merges and deduplicates rules
3. Outputs rules in markdown format
4. Uses strict language ("you MUST follow these rules")

**Output Example:**

```markdown
# Code Standards for this Project

You MUST follow these rules when writing code:

## ESLint Rules

- no-var: error
- eqeqeq: ["error", "always"]
- @typescript-eslint/no-explicit-any: error

## Ruff Rules

- Select: E, F, I, UP
- Line length: 120
```

---

### 7.2 Configuration System

#### 7.2.1 Project Configuration File

**File:** `cmc.toml` (located in project root)

**Purpose:** Defines which rulesets apply to the project.

**Required:** Yes — `cmc` refuses to run without this file.

**Schema:**

```toml
# Project metadata
[project]
name = "my-project"
category = "production"  # Optional: production, prototype, internal, etc.

# Extend community rulesets (optional)
[extends]
rulesets = [
  "github:check-my-code/rulesets/typescript-strict",
  "github:check-my-code/rulesets/python-prod",
]

# ESLint rules - uses exact ESLint config syntax
[rulesets.eslint.rules]
no-var = "error"
prefer-const = "error"
eqeqeq = ["error", "always"]
"max-lines-per-function" = ["error", { max = 100 }]
"@typescript-eslint/no-explicit-any" = "error"

# Ruff configuration - uses exact Ruff config syntax
[rulesets.ruff]
line-length = 120

[rulesets.ruff.lint]
select = ["E", "F", "I", "UP"]
ignore = ["E501"]
```

#### 7.2.2 Rule Syntax

Rules in `cmc.toml` use **exact ESLint/Ruff syntax**:

**ESLint rules:**

```toml
[rulesets.eslint.rules]
no-var = "error"
eqeqeq = ["error", "always"]
"max-lines-per-function" = ["error", { max = 100 }]
"@typescript-eslint/no-explicit-any" = "error"
```

**Ruff configuration:**

```toml
[rulesets.ruff]
line-length = 120

[rulesets.ruff.lint]
select = ["E", "F", "I", "UP"]
ignore = ["E501"]
```

#### 7.2.3 Configuration Discovery

When `cmc` runs, it discovers configuration by:

1. Looking for `cmc.toml` in current directory
2. If not found, traversing up to find `cmc.toml`
3. If no config found, exiting with error:
   ```
   Error: No cmc.toml found. Run 'cmc init' to create one.
   ```

---

### 7.3 Ruleset System

#### 7.3.1 Overview

The ruleset system follows a **single source of truth** principle:

1. **`cmc.toml`** defines required rules (and optionally extends community rulesets)
2. **`cmc generate`** creates linter configs from those rules
3. **`cmc verify`** checks that existing linter configs are at least as strict
4. **`cmc check`** verifies configs then runs the linters

#### 7.3.2 Community Rulesets

Community rulesets are `cmc.toml` files hosted in Git repositories.

**Referencing community rulesets:**

```toml
[extends]
rulesets = [
  "github:check-my-code/rulesets/typescript-strict",
  "github:org/repo/path/to/ruleset",
]
```

**Format:** `github:<owner>/<repo>/<path>` or full Git URL.

**Community ruleset structure:**

```toml
# Community ruleset: typescript-strict
[project]
name = "typescript-strict"
description = "Strict TypeScript rules for production code"

[rulesets.eslint.rules]
no-var = "error"
prefer-const = "error"
"@typescript-eslint/no-explicit-any" = "error"
"@typescript-eslint/explicit-function-return-type" = "error"
```

#### 7.3.3 Ruleset Merging

When a project extends community rulesets:

1. Community rulesets are loaded in order listed
2. Later rulesets override earlier ones
3. Local `[rulesets.*]` sections override all community rules
4. Result is a merged set of rules

**Example:**

```toml
# Extends community ruleset, then overrides one rule
[extends]
rulesets = ["github:check-my-code/rulesets/typescript-strict"]

[rulesets.eslint.rules]
# Override: allow explicit any in this project
"@typescript-eslint/no-explicit-any" = "warn"
```

#### 7.3.4 Verification Logic

When verifying linter configs against `cmc.toml`:

- **Present and at least as strict**: Pass
- **Present but less strict**: Fail (e.g., "warn" when "error" required)
- **Missing**: Fail
- **Extra rules in linter config**: Allowed (not a failure)

**Strictness ordering:** `error` > `warn` > `off`

---

### 7.4 Linter Integration

#### 7.4.1 Supported Linters (v1)

| Language              | Linter | Config File                   | Generated Config   |
| --------------------- | ------ | ----------------------------- | ------------------ |
| TypeScript/JavaScript | ESLint | `eslint.config.js`            | `eslint.config.js` |
| Python                | Ruff   | `ruff.toml`, `pyproject.toml` | `ruff.toml`        |

#### 7.4.2 Execution Flow

1. **Validate** `cmc.toml` against JSON Schema
2. **Resolve** community rulesets (if any)
3. **Verify** project linter configs are at least as strict (unless `--no-verify`)
4. **Run** linters using project's native config files
5. **Collect** violations from linter JSON output
6. **Report** violations to stdout

#### 7.4.3 Generated Config Examples

**Generated eslint.config.js:**

```javascript
// Generated by cmc - do not edit directly
// Source: cmc.toml
// To regenerate: cmc generate eslint --force

export default [
  {
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      'max-lines-per-function': ['error', { max: 100 }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
```

**Generated ruff.toml:**

```toml
# Generated by cmc - do not edit directly
# Source: cmc.toml
# To regenerate: cmc generate ruff --force

line-length = 120

[lint]
select = ["E", "F", "I", "UP"]
ignore = ["E501"]
```

#### 7.4.4 Missing Linter Handling

If a linter is required but not installed:

```
Error: ESLint is required but not found.

Install locally: npm install eslint
Install globally: npm install -g eslint
```

Exit code: 3 (runtime error)

---

### 7.5 Output & Exit Codes

#### 7.5.1 CLI Output Format

**Default output:**

```
src/main.py:15:1 F401 'os' imported but unused
src/utils.ts:42:5 no-var Unexpected var, use let or const instead

2 violations found
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
      "message": "'os' imported but unused"
    }
  ],
  "summary": {
    "total": 2,
    "files": 2
  }
}
```

#### 7.5.2 Exit Codes

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| 0    | No violations                                          |
| 1    | Violations found                                       |
| 2    | Configuration error (invalid cmc.toml, missing config) |
| 3    | Runtime error (linter failed, linter not installed)    |

---

## 8. Feature Specifications (v2 Future)

The following features are planned for v2:

### 8.1 Additional Commands

- **`cmc diff`**: Show files changed since last check
- **`cmc dry-run`**: Preview what would be checked without running
- **`cmc report`**: Generate detailed reports (stdout and HTML)

### 8.2 Smart Checking

Track file hashes to skip unchanged files:

- State stored in `.cmc/state.json`
- `--all` flag to force full check
- Cache invalidation on ruleset changes

### 8.3 AI-Assisted Checks

Verify subjective rules using AI agents:

- Meaningful variable/function names
- Code complexity assessment
- Documentation quality
- Custom prompts for team-specific standards

### 8.4 Enhanced CLI Experience

- Interactive init wizard (`cmc init --interactive`)
- Progress indicators and spinners
- Colored output
- Verbose (`-v`) and quiet (`-q`) modes
- Shell completion (bash, zsh, fish)

### 8.5 Advanced Reporting

- HTML report generation
- Violations by file/rule grouping
- Historical tracking
- CI/CD annotations (GitHub Actions format)

---

## 9. Technical Specifications

### 9.1 Technology Stack

| Component         | Technology           |
| ----------------- | -------------------- |
| Language          | TypeScript (Node.js) |
| Package Manager   | npm                  |
| CLI Framework     | Commander.js         |
| Config Parsing    | TOML parser          |
| Schema Validation | JSON Schema (Ajv)    |
| Git Operations    | simple-git           |

### 9.2 Directory Structure

```
check-my-code/
├── src/
│   ├── cli/
│   │   ├── index.ts           # CLI entry point
│   │   └── commands/
│   │       ├── check.ts
│   │       ├── init.ts
│   │       ├── generate.ts
│   │       ├── verify.ts
│   │       ├── update.ts
│   │       └── context.ts
│   ├── config/
│   │   ├── loader.ts          # Config discovery and parsing
│   │   ├── schema.ts          # JSON Schema validation
│   │   └── schema.json        # JSON Schema definition
│   ├── rulesets/
│   │   ├── fetcher.ts         # Git-based ruleset fetching
│   │   ├── merger.ts          # Ruleset merging logic
│   │   └── cache.ts           # Local ruleset cache
│   ├── linters/
│   │   ├── eslint.ts          # ESLint integration
│   │   ├── ruff.ts            # Ruff integration
│   │   └── types.ts           # Shared types
│   ├── generators/
│   │   ├── eslint.ts          # Generate eslint.config.js
│   │   └── ruff.ts            # Generate ruff.toml
│   └── utils/
│       └── git.ts
├── schemas/
│   └── cmc.schema.json        # JSON Schema for cmc.toml
├── package.json
├── tsconfig.json
└── README.md
```

### 9.3 JSON Schema

The JSON Schema for `cmc.toml` validation:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["project"],
  "properties": {
    "project": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": { "type": "string" },
        "category": { "type": "string" }
      }
    },
    "extends": {
      "type": "object",
      "properties": {
        "rulesets": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "rulesets": {
      "type": "object",
      "properties": {
        "eslint": {
          "type": "object",
          "properties": {
            "rules": { "type": "object" }
          }
        },
        "ruff": {
          "type": "object"
        }
      }
    }
  }
}
```

### 9.4 External Dependencies

**Runtime:**

- Node.js >= 18
- Git (for community ruleset fetching)

**Linters (user-installed):**

- ESLint (TypeScript/JavaScript)
- Ruff (Python)

---

## 10. User Workflows

### 10.1 Initial Setup

```bash
# Install globally
npm install -g check-my-code

# In project directory
cmc init

# Edit cmc.toml to configure rules
# Generate linter configs
cmc generate eslint
cmc generate ruff

# Run first check
cmc check
```

### 10.2 Daily Development with AI Agent

```bash
# Before writing code - get context for AI agent
cmc context | pbcopy  # Copy to clipboard

# Or append to CLAUDE.md
cmc context >> CLAUDE.md

# After writing code
cmc check
```

### 10.3 CI/CD Pipeline

```yaml
name: Code Standards

on: [pull_request]

jobs:
  check-standards:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install cmc
        run: npm install -g check-my-code

      - name: Install linters
        run: |
          pip install ruff
          npm install eslint

      - name: Check code standards
        run: cmc check
```

### 10.4 Using Community Rulesets

```bash
# Add community ruleset to cmc.toml
# [extends]
# rulesets = ["github:check-my-code/rulesets/typescript-strict"]

# Fetch the ruleset
cmc update

# Generate configs with community + local rules
cmc generate eslint

# Check code
cmc check
```

---

## 11. Glossary

| Term                  | Definition                                                        |
| --------------------- | ----------------------------------------------------------------- |
| **Ruleset**           | A collection of linter rules defined in `cmc.toml` format         |
| **Community ruleset** | A publicly available ruleset hosted in a Git repository           |
| **Rule**              | A single linter configuration (e.g., `"no-var": "error"`)         |
| **Verification**      | Checking that linter configs are at least as strict as `cmc.toml` |
| **Generation**        | Creating linter config files from `cmc.toml`                      |
| **Context**           | Rules formatted for consumption by AI coding agents               |
| **Agent**             | An AI coding tool (Claude Code, Codex, Gemini CLI)                |

---

_End of Document_
