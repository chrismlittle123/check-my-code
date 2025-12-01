# Product Requirements Document: check-my-code (cmc)

**Version:** 1.1
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
   - 7.3 [Linter Integration](#73-linter-integration)
   - 7.4 [Output & Exit Codes](#74-output--exit-codes)
8. [Feature Specifications (v2 Future)](#8-feature-specifications-v2-future)
9. [Technical Specifications](#9-technical-specifications)
10. [User Workflows](#10-user-workflows)
11. [Glossary](#11-glossary)

---

## 1. Executive Summary

**check-my-code** (`cmc`) is a CLI tool that runs ESLint and Ruff linters on code. It provides a unified way to enforce coding standards across TypeScript/JavaScript and Python files without per-repository configuration overhead.

The tool acts as both:

- A **verification layer** that checks code against defined standards
- A **context provider** for AI coding agents, ensuring they write compliant code from the start

---

## 2. Problem Statement

### Current Challenges

1. **Inconsistent coding standards**: Teams using multiple AI coding tools (Claude Code, Codex, Gemini CLI, Cursor) produce code with varying styles and quality levels.

2. **Per-repository overhead**: Maintaining git hooks, linter configs, and style guides for each repository is time-consuming and leads to drift.

3. **No unified interface**: Running ESLint and Ruff separately requires different commands and output formats.

4. **Context gap for AI agents**: AI coding tools don't automatically know the team's specific coding standards, leading to non-compliant code that requires manual correction.

### Desired Outcome

A single tool that:

- Runs both ESLint and Ruff with a unified interface
- Provides consistent output format across linters
- Can generate linter configs from a central definition
- Provides context output for AI agents

---

## 3. Product Overview

### What cmc Does

1. **Runs linters** (ESLint, Ruff) on specified files or directories
2. **Reports violations** in a unified format with file paths and line numbers
3. **Generates linter configs** from `cmc.toml` ruleset definitions
4. **Provides context** to AI coding agents so they write compliant code

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
- Working with TypeScript/JavaScript and Python codebases

---

## 5. Core Principles

### 5.1 Read-Only Verification

`cmc` tells you what's wrong but never modifies files. Auto-fixing remains the responsibility of existing pre-commit hooks and formatters.

### 5.2 Linter-First

`cmc` uses existing project linters (ESLint, Ruff) as the verification mechanism. It delegates actual linting to native tools.

### 5.3 Graceful Degradation

If a linter is not installed, `cmc` silently skips it rather than failing. This allows gradual adoption.

### 5.4 Agent-Agnostic

`cmc` works with any AI coding tool by providing standardised context output.

---

## 6. Version Scope

### v1 MVP

The minimum viable product focuses on core functionality:

**Commands:**

- `cmc check` - Run linters and report violations
- `cmc generate` - Create linter configs from `cmc.toml` ruleset
- `cmc context` - Output rules for AI agents

**Features:**

- ESLint + Ruff support
- Unified output format (text and JSON)
- Standard exit codes
- Graceful handling of missing linters

### v2 Future

Features deferred to future versions:

- `cmc init` - Generate minimal configuration
- `cmc verify` - Check linter configs match ruleset (without running linters)
- `cmc update` - Fetch/update community rulesets
- `cmc diff` - Show changes since last check
- `cmc dry-run` - Preview what would be checked
- `cmc report` - Generate detailed reports (including HTML)
- Community ruleset extension/merging
- JSON Schema validation of `cmc.toml`
- Smart checking (file hash caching)
- Colored output, progress indicators
- Shell completion

---

## 7. Feature Specifications (v1 MVP)

### 7.1 CLI Commands

#### 7.1.1 `cmc check`

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

#### 7.1.2 `cmc generate`

**Purpose:** Generate linter config files from `cmc.toml` ruleset.

**Usage:**

```bash
cmc generate eslint           # Generate eslint.config.js
cmc generate ruff             # Generate ruff.toml
```

**Behaviour:**

1. Reads `cmc.toml` ruleset configuration
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

---

#### 7.1.3 `cmc context`

**Purpose:** Output active rules formatted for AI agent consumption.

**Usage:**

```bash
cmc context                   # Output markdown for AI agents
cmc context >> CLAUDE.md      # Append to AI context file
```

**Behaviour:**

1. Reads `cmc.toml` ruleset configuration
2. Formats rules as markdown
3. Outputs to stdout with strict language ("you MUST follow these rules")

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

**Purpose:** Defines project metadata and optional ruleset for config generation.

**Required:** Yes — `cmc` requires this file to run.

**Minimal Schema:**

```toml
[project]
name = "my-project"
```

**Full Schema (for `cmc generate`):**

```toml
[project]
name = "my-project"

# ESLint rules - uses exact ESLint config syntax
[rulesets.eslint.rules]
no-var = "error"
prefer-const = "error"
eqeqeq = ["error", "always"]
"@typescript-eslint/no-explicit-any" = "error"

# Ruff configuration - uses exact Ruff config syntax
[rulesets.ruff]
line-length = 120

[rulesets.ruff.lint]
select = ["E", "F", "I", "UP"]
ignore = ["E501"]
```

#### 7.2.2 Configuration Discovery

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

### 7.3 Linter Integration

#### 7.3.1 Supported Linters (v1)

| Language              | Linter | Config File        |
| --------------------- | ------ | ------------------ |
| TypeScript/JavaScript | ESLint | `eslint.config.js` |
| Python                | Ruff   | `ruff.toml`        |

#### 7.3.2 Execution Flow

1. Discover files in scope
2. Route files to appropriate linters by extension
3. Run linters using project's native config files
4. Collect violations from linter JSON output
5. Report violations to stdout in unified format

#### 7.3.3 File Extension Routing

| Extensions                                   | Linter |
| -------------------------------------------- | ------ |
| `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` | ESLint |
| `.py`, `.pyi`                                | Ruff   |

#### 7.3.4 Missing Linter Handling

If a linter is not installed, `cmc` silently skips files for that linter. This enables graceful degradation:

- Project with only TypeScript: Works without Ruff installed
- Project with only Python: Works without ESLint installed
- Mixed project: Checks whatever linters are available

---

### 7.4 Output & Exit Codes

#### 7.4.1 CLI Output Format

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

#### 7.4.2 Exit Codes

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| 0    | No violations                                          |
| 1    | Violations found                                       |
| 2    | Configuration error (invalid cmc.toml, missing config) |
| 3    | Runtime error (linter failed)                          |

---

## 8. Feature Specifications (v2 Future)

The following features are planned for v2:

### 8.1 Additional Commands

- **`cmc init`**: Generate minimal configuration file
- **`cmc verify`**: Check linter configs match ruleset (without running linters)
- **`cmc update`**: Fetch/update community rulesets
- **`cmc diff`**: Show files changed since last check
- **`cmc dry-run`**: Preview what would be checked without running
- **`cmc report`**: Generate detailed reports (stdout and HTML)

### 8.2 Community Rulesets

Share and extend rulesets across projects:

```toml
[extends]
rulesets = [
  "github:check-my-code/rulesets/typescript-strict",
  "github:check-my-code/rulesets/python-prod",
]
```

### 8.3 Smart Checking

Track file hashes to skip unchanged files:

- State stored in `.cmc/state.json`
- `--all` flag to force full check
- Cache invalidation on ruleset changes

### 8.4 Enhanced CLI Experience

- Interactive init wizard (`cmc init --interactive`)
- Progress indicators and spinners
- Colored output
- Verbose (`-v`) and quiet (`-q`) modes
- Shell completion (bash, zsh, fish)

### 8.5 JSON Schema Validation

Validate `cmc.toml` against a JSON Schema for configuration correctness.

---

## 9. Technical Specifications

### 9.1 Technology Stack

| Component       | Technology           |
| --------------- | -------------------- |
| Language        | TypeScript (Node.js) |
| Package Manager | npm                  |
| CLI Framework   | Commander.js         |
| Config Parsing  | @iarna/toml          |
| File Discovery  | glob                 |

### 9.2 Directory Structure

```
check-my-code/
├── src/
│   ├── cli/
│   │   ├── index.ts           # CLI entry point
│   │   └── commands/
│   │       ├── check.ts
│   │       ├── generate.ts
│   │       └── context.ts
│   ├── config/
│   │   └── loader.ts          # Config discovery and parsing
│   ├── linter.ts              # ESLint and Ruff execution
│   └── types.ts               # TypeScript interfaces
├── package.json
├── tsconfig.json
└── README.md
```

### 9.3 External Dependencies

**Runtime:**

- Node.js >= 18

**Linters (user-installed):**

- ESLint (TypeScript/JavaScript)
- Ruff (Python)

---

## 10. User Workflows

### 10.1 Initial Setup

```bash
# Install globally
npm install -g check-my-code

# In project directory, create minimal config
echo '[project]
name = "my-project"' > cmc.toml

# Run first check
cmc check
```

### 10.2 Daily Development with AI Agent

```bash
# Get context for AI agent
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

### 10.4 Generating Linter Configs

```bash
# Define rules in cmc.toml
cat >> cmc.toml << 'EOF'
[rulesets.eslint.rules]
no-var = "error"
prefer-const = "error"

[rulesets.ruff.lint]
select = ["E", "F"]
EOF

# Generate configs
cmc generate eslint
cmc generate ruff

# Check code
cmc check
```

---

## 11. Glossary

| Term        | Definition                                                |
| ----------- | --------------------------------------------------------- |
| **Ruleset** | A collection of linter rules defined in `cmc.toml` format |
| **Rule**    | A single linter configuration (e.g., `"no-var": "error"`) |
| **Context** | Rules formatted for consumption by AI coding agents       |
| **Agent**   | An AI coding tool (Claude Code, Codex, Gemini CLI)        |

---

_End of Document_
