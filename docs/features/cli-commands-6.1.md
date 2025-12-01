# CLI Commands Feature PRD (Section 7.1)

**Parent Document:** check-my-code-prd.md
**Version:** 1.1
**Status:** Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [v1 MVP Commands](#2-v1-mvp-commands)
   - 2.1 [cmc check](#21-cmc-check)
   - 2.2 [cmc generate](#22-cmc-generate)
   - 2.3 [cmc context](#23-cmc-context)
3. [v2 Future Commands](#3-v2-future-commands)
4. [Global Options](#4-global-options)
5. [Error Handling](#5-error-handling)
6. [Technical Implementation](#6-technical-implementation)

---

## 1. Overview

### 1.1 Purpose

This document provides detailed specifications for all CLI commands in `check-my-code` (`cmc`). It expands on section 7.1 of the main PRD with implementation details, edge cases, and behavioral specifications.

### 1.2 Design Principles

- **Predictable behavior:** Commands behave consistently across invocations
- **Fail-fast:** Invalid input or missing prerequisites cause immediate, clear errors
- **Unix philosophy:** Commands work well with pipes, redirects, and scripting
- **Minimal v1:** Focus on core functionality, defer enhancements to v2

### 1.3 Command Naming Convention

All commands use lowercase, single-word names. Subcommands are not used in v1 to keep the CLI surface simple.

---

## 2. v1 MVP Commands

### 2.1 `cmc check`

**Purpose:** Run linters on project files and report violations.

#### 2.1.1 Usage

```bash
cmc check [options] [<path>]
```

#### 2.1.2 Arguments

| Argument | Description                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| `<path>` | Optional path to check. Can be a file or directory. If omitted, checks entire project from `cmc.toml` location. |

#### 2.1.3 Options

| Option   | Short | Description            | Default |
| -------- | ----- | ---------------------- | ------- |
| `--json` |       | Output results as JSON | `false` |

#### 2.1.4 Behavior

**Execution flow:**

1. Discover configuration file (`cmc.toml`) by walking up from current directory
2. Validate `cmc.toml` has required `[project] name` field
3. Determine files in scope:
   - If `<path>` provided: files matching path
   - If no path: all source files under project root
4. Filter files by extension:
   - TypeScript/JavaScript: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`
   - Python: `.py`, `.pyi`
5. Run appropriate linters:
   - ESLint for JS/TS files (uses project's `eslint.config.js`)
   - Ruff for Python files (uses project's `ruff.toml`)
6. Collect all violations
7. Output results (format based on flags)
8. Exit with appropriate code

**Ignored directories:**

- `node_modules/`
- `.git/`
- `dist/`
- `build/`
- `__pycache__/`
- `.venv/`

#### 2.1.5 Output Formats

**Default output:**

```
src/main.py:15 [ruff/F401] 'os' imported but unused
src/utils.ts:8 [eslint/no-var] Unexpected var, use let or const instead

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
    },
    {
      "file": "src/utils.ts",
      "line": 8,
      "column": 5,
      "rule": "no-var",
      "message": "Unexpected var, use let or const instead",
      "linter": "eslint"
    }
  ],
  "summary": {
    "files_checked": 10,
    "violations_count": 2
  }
}
```

#### 2.1.6 Exit Codes

| Code | Condition                                              |
| ---- | ------------------------------------------------------ |
| 0    | No violations found                                    |
| 1    | Violations found                                       |
| 2    | Configuration error (missing cmc.toml, invalid syntax) |
| 3    | Runtime error (linter not installed)                   |

#### 2.1.7 Edge Cases

| Scenario              | Behavior                                         |
| --------------------- | ------------------------------------------------ |
| No files match path   | Warning to stderr, exit 0                        |
| Empty project         | Warning "No files to check", exit 0              |
| Linter not installed  | Silently skip that linter (graceful degradation) |
| Linter config missing | Linter runs with defaults or skips               |
| Path not found        | Warning to stderr, exit 0                        |

---

### 2.2 `cmc generate`

**Purpose:** Generate linter config files from `cmc.toml` ruleset.

#### 2.2.1 Usage

```bash
cmc generate <linter>
cmc generate eslint           # Generate eslint.config.js
cmc generate ruff             # Generate ruff.toml
```

#### 2.2.2 Arguments

| Argument   | Description                                         |
| ---------- | --------------------------------------------------- |
| `<linter>` | Which linter config to generate: `eslint` or `ruff` |

#### 2.2.3 Options

| Option     | Short | Description                      | Default |
| ---------- | ----- | -------------------------------- | ------- |
| `--force`  | `-f`  | Overwrite existing config file   | `false` |
| `--stdout` |       | Output to stdout instead of file | `false` |

#### 2.2.4 Behavior

1. Load and validate `cmc.toml`
2. Read ruleset configuration from `[rulesets.eslint]` or `[rulesets.ruff]`
3. Check if target config file already exists
   - If exists and no `--force`: exit with error
4. Generate linter config with all defined rules
5. Write to standard location (or stdout if `--stdout`)
6. Print success message

**Generated File Locations:**

- ESLint: `eslint.config.js` (flat config format)
- Ruff: `ruff.toml`

#### 2.2.5 Generated File Examples

**eslint.config.js:**

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

**ruff.toml:**

```toml
# Generated by cmc - do not edit directly
# Source: cmc.toml
# To regenerate: cmc generate ruff --force

line-length = 120

[lint]
select = ["E", "F", "I", "UP"]
ignore = ["E501"]
```

#### 2.2.6 Output

**Success:**

```
Generated eslint.config.js from cmc.toml

Rules included:
  - no-var
  - prefer-const
  - eqeqeq
  - max-lines-per-function
  - @typescript-eslint/no-explicit-any

Run 'cmc check' to lint your code.
```

**File exists error:**

```
Error: eslint.config.js already exists

Use --force to overwrite, or manually merge the rules.
```

#### 2.2.7 Exit Codes

| Code | Condition                                                             |
| ---- | --------------------------------------------------------------------- |
| 0    | Config generated successfully                                         |
| 1    | Config file already exists (no `--force`)                             |
| 2    | Configuration error (invalid cmc.toml, no ruleset defined for linter) |

---

### 2.3 `cmc context`

**Purpose:** Output active rules formatted for AI agent consumption.

#### 2.3.1 Usage

```bash
cmc context
```

#### 2.3.2 Behavior

1. Load and validate `cmc.toml`
2. Read ruleset configuration
3. Format rules as markdown
4. Output to stdout

#### 2.3.3 Output Format

```markdown
# Code Standards for this Project

You MUST follow these rules when writing code:

## ESLint Rules (TypeScript/JavaScript)

| Rule                               | Setting                   |
| ---------------------------------- | ------------------------- |
| no-var                             | error                     |
| prefer-const                       | error                     |
| eqeqeq                             | ["error", "always"]       |
| max-lines-per-function             | ["error", { "max": 100 }] |
| @typescript-eslint/no-explicit-any | error                     |

## Ruff Rules (Python)

| Setting     | Value                 |
| ----------- | --------------------- |
| line-length | 120                   |
| select      | ["E", "F", "I", "UP"] |
| ignore      | ["E501"]              |
```

#### 2.3.4 Exit Codes

| Code | Condition                              |
| ---- | -------------------------------------- |
| 0    | Success                                |
| 2    | Configuration error (invalid cmc.toml) |

---

## 3. v2 Future Commands

The following commands are planned for v2:

### 3.1 `cmc init`

Generate a minimal configuration file for new projects.

```bash
cmc init                      # Generate minimal cmc.toml
cmc init --force              # Overwrite existing config
```

### 3.2 `cmc verify`

Verify project linter configs match ruleset requirements (without running linters).

```bash
cmc verify                    # Verify all linter configs
cmc verify eslint             # Verify only ESLint config
```

### 3.3 `cmc update`

Fetch latest versions of configured community rulesets.

```bash
cmc update                    # Update all community rulesets
```

### 3.4 `cmc diff`

Show files changed since last check.

```bash
cmc diff                      # List changed files
cmc diff --stat               # Show change statistics
```

### 3.5 `cmc dry-run`

Preview what would be checked without running checks.

```bash
cmc dry-run                   # Show files and rules that would be checked
```

### 3.6 `cmc report`

Generate detailed violation reports.

```bash
cmc report                    # Detailed stdout report
cmc report --html             # Generate HTML report
cmc report --html -o report.html
```

---

## 4. Global Options

These options are available on all commands:

| Option      | Short | Description                             |
| ----------- | ----- | --------------------------------------- |
| `--help`    | `-h`  | Show help for command                   |
| `--version` | `-V`  | Show cmc version (format: `X.Y.Z` only) |

**v2 additions:**

- `--no-color` - Disable colored output
- `--verbose` / `-v` - Show detailed progress
- `--quiet` / `-q` - Minimal output
- `--debug` - Show debug information

---

## 5. Error Handling

### 5.1 Error Message Format

```
Error: <brief description>

<detailed explanation>

<suggested action>
```

**Example:**

```
Error: Configuration file not found

No cmc.toml found in current directory or parent directories.

Create a cmc.toml file with:
  [project]
  name = "your-project"
```

### 5.2 Common Errors

| Error                         | Exit Code | Suggestion                              |
| ----------------------------- | --------- | --------------------------------------- |
| No cmc.toml found             | 2         | Create cmc.toml manually                |
| Invalid cmc.toml syntax       | 2         | Check TOML syntax                       |
| Missing [project] name        | 2         | Add `name` to `[project]` section       |
| Linter config missing         | -         | Linter runs with defaults or skips      |
| Linter not installed          | -         | Silently skipped (graceful degradation) |
| Config file exists (generate) | 1         | Use `--force` to overwrite              |

---

## 6. Technical Implementation

### 6.1 CLI Framework

Use Commander.js for:

- Command parsing
- Option handling
- Help generation
- Subcommand routing

### 6.2 Entry Point Structure

```typescript
// src/cli/index.ts
import { Command } from 'commander';
import { checkCommand } from './commands/check';
import { generateCommand } from './commands/generate';
import { contextCommand } from './commands/context';

const program = new Command();

program.name('cmc').description('Run ESLint and Ruff linters on your code').version(VERSION);

program.addCommand(checkCommand);
program.addCommand(generateCommand);
program.addCommand(contextCommand);

program.parse();
```

### 6.3 Command Structure

Each command is a separate module:

```typescript
// src/cli/commands/check.ts
import { Command } from 'commander';

export const checkCommand = new Command('check')
  .description('Run ESLint and Ruff checks')
  .argument('[path]', 'path to check')
  .option('--json', 'JSON output')
  .action(async (path, options) => {
    // Implementation
  });
```

---

_End of Document_
