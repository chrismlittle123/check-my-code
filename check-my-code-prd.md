# Product Requirements Document: check-my-code (cmc)

**Version:** 1.1
**Date:** November 2025
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
7. [Feature Specifications (v2 Future)](#7-feature-specifications-v2-future)
8. [Technical Specifications](#8-technical-specifications)
9. [Glossary](#9-glossary)

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

## 4. Core Principles

### 4.1 Read-Only Verification

`cmc` tells you what's wrong but never modifies files. Auto-fixing remains the responsibility of existing pre-commit hooks and formatters.

### 4.2 Linter-First

`cmc` uses existing project linters (ESLint, Ruff) as the verification mechanism. It delegates actual linting to native tools.

### 4.3 Graceful Degradation

If a linter is not installed, `cmc` silently skips it rather than failing. This allows gradual adoption.

### 4.4 Agent-Agnostic

`cmc` works with any AI coding tool by providing standardised context output.

---

## 5. Version Scope

### v1 MVP

The minimum viable product focuses on core functionality:

**Commands:**

- `cmc check` - Run linters and report violations
- `cmc generate` - Create linter configs from `cmc.toml` ruleset
- `cmc context` - Output rules for AI agents
- `cmc verify` - Check linter configs match ruleset (without running linters)

**Features:**

- ESLint + Ruff support
- Unified output format (text and JSON)
- Standard exit codes
- Graceful handling of missing linters
- JSON Schema validation of `cmc.toml`

### v2 Future

Features deferred to future versions:

- `cmc diff` - Show changes since last check
- `cmc dry-run` - Preview what would be checked
- `cmc report` - Generate detailed reports (including HTML)
- Community ruleset extension/merging
- Smart checking (file hash caching)
- Colored output, progress indicators

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

#### 6.1.3 `cmc context`

**Purpose:** Output active rules formatted for AI agent consumption.

**Usage:**

```bash
cmc context                   # Output markdown for AI agents
cmc context >> CLAUDE.md      # Append to AI context file
```

**Behaviour:**

1. Reads `cmc.toml` ruleset configuration
2. Formats rules as markdown in natural English
3. Outputs to stdout with strict language ("you MUST follow these rules")

---

#### 6.1.4 `cmc verify`

**Purpose:** Check that linter config files match the ruleset defined in `cmc.toml` without running the linters.

**Usage:**

```bash
cmc verify                    # Verify all linter configs match cmc.toml
cmc verify eslint             # Verify only ESLint config
cmc verify ruff               # Verify only Ruff config
```

**Behaviour:**

1. Reads `cmc.toml` ruleset configuration
2. Reads the corresponding linter config file(s)
3. Compares rules defined in `cmc.toml` against linter config
4. Reports any mismatches (missing rules, different values, extra rules)
5. Exits with appropriate code

**Output:**

```
✓ eslint.config.js matches cmc.toml ruleset
✗ ruff.toml has mismatches:
  - missing rule: line-length = 120
  - different value: select (expected ["E", "F", "I", "UP"], got ["E", "F"])
```

**Exit Codes:**

| Code | Meaning                                |
| ---- | -------------------------------------- |
| 0    | All configs match                      |
| 1    | Mismatches found                       |
| 2    | Configuration error (missing cmc.toml) |
| 3    | Linter config file not found           |

---

### 6.2 Configuration System

#### 6.2.1 Project Configuration File

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

#### 6.2.2 Configuration Discovery

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

## 7. Feature Specifications (v2 Future)

### 7.1 Community Rulesets

Share and extend rulesets across projects:

```toml
[extends]
rulesets = [
  "github:check-my-code/rulesets/typescript-strict",
  "github:check-my-code/rulesets/python-prod",
]
```

### 7.2 Smart Checking

Track file hashes to skip unchanged files:

- State stored in `.cmc/state.json`
- `--all` flag to force full check
- Cache invalidation on ruleset changes

### 7.3 Additional Commands

- `cmc diff` - Show changes since last check
- `cmc dry-run` - Preview what would be checked
- `cmc report` - Generate detailed reports (including HTML)

### 7.4 Enhanced Output

- Colored output
- Progress indicators

---

## 8. Technical Specifications

### 8.1 Technology Stack

| Component       | Technology           |
| --------------- | -------------------- |
| Language        | TypeScript (Node.js) |
| Package Manager | npm                  |
| CLI Framework   | Commander.js         |
| Config Parsing  | @iarna/toml          |
| File Discovery  | glob                 |

### 8.2 Directory Structure

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

---

_End of Document_
