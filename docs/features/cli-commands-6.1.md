# CLI Commands Feature PRD (Section 7.1)

**Parent Document:** check-my-code-prd.md
**Version:** 1.0
**Status:** Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [v1 MVP Commands](#2-v1-mvp-commands)
   - 2.1 [cmc init](#21-cmc-init)
   - 2.2 [cmc check](#22-cmc-check)
   - 2.3 [cmc generate](#23-cmc-generate)
   - 2.4 [cmc verify](#24-cmc-verify)
   - 2.5 [cmc update](#25-cmc-update)
   - 2.6 [cmc context](#26-cmc-context)
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

### 2.1 `cmc init`

**Purpose:** Generate a minimal configuration file for the current project.

#### 2.1.1 Usage

```bash
cmc init [options]
```

#### 2.1.2 Options

| Option    | Short | Description                   | Default |
| --------- | ----- | ----------------------------- | ------- |
| `--force` | `-f`  | Overwrite existing `cmc.toml` | `false` |

#### 2.1.3 Behavior

1. Check if `cmc.toml` already exists
   - If exists and no `--force`: exit with error code 1
2. Detect project characteristics:
   - Languages present (by file extensions: `.ts`, `.js`, `.py`, etc.)
   - Existing linter configs (eslint.config.js, ruff.toml)
3. Generate minimal `cmc.toml` with placeholders
4. Print next steps to stdout

#### 2.1.4 Generated File

**Minimal `cmc.toml`:**

```toml
[project]
name = "my-project"
category = "production"  # Options: production, prototype, internal

# Extend community rulesets (optional)
# [extends]
# rulesets = [
#   "github:check-my-code/rulesets/typescript-strict",
# ]

# ESLint rules - uses exact ESLint config syntax
# [rulesets.eslint.rules]
# no-var = "error"
# prefer-const = "error"

# Ruff configuration - uses exact Ruff config syntax
# [rulesets.ruff]
# line-length = 120
#
# [rulesets.ruff.lint]
# select = ["E", "F", "I"]
```

#### 2.1.5 Output

**Success:**

```
Created cmc.toml

Next steps:
1. Edit cmc.toml to configure your rules
2. Run 'cmc generate eslint' or 'cmc generate ruff' to create linter configs
3. Run 'cmc check' to verify your code

Documentation: https://github.com/check-my-code/docs
```

**File exists error:**

```
Error: cmc.toml already exists

Use --force to overwrite.
```

#### 2.1.6 Exit Codes

| Code | Condition                                   |
| ---- | ------------------------------------------- |
| 0    | Configuration created successfully          |
| 1    | Configuration already exists (no `--force`) |
| 2    | Invalid path or permission error            |

---

### 2.2 `cmc check`

**Purpose:** Verify linter configs match ruleset requirements, then run linters.

#### 2.2.1 Usage

```bash
cmc check [options] [<path>]
```

#### 2.2.2 Arguments

| Argument | Description                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| `<path>` | Optional path to check. Can be a file or directory. If omitted, checks entire project from `cmc.toml` location. |

#### 2.2.3 Options

| Option        | Short | Description                                      | Default |
| ------------- | ----- | ------------------------------------------------ | ------- |
| `--no-verify` |       | Skip linter config verification against cmc.toml | `false` |
| `--json`      |       | Output results as JSON                           | `false` |

#### 2.2.4 Behavior

**Execution flow:**

1. Discover configuration file (`cmc.toml`)
2. Validate `cmc.toml` against JSON Schema
3. Resolve community rulesets (if `[extends]` present)
4. Merge rules (local overrides community)
5. **Verify linter configs** (unless `--no-verify`):
   - Parse project's eslint.config.js and/or ruff.toml
   - Check all required rules from `cmc.toml` are present and at least as strict
   - If verification fails, exit with error showing missing/weak rules
6. Determine files in scope:
   - If `<path>` provided: files matching path
   - If no path: all source files under config directory
7. Run linter checks using project's native config files
8. Collect all violations
9. Output results (format based on flags)
10. Exit with appropriate code

#### 2.2.5 Output Formats

**Default output:**

```
src/main.py:15:1 F401 'os' imported but unused
src/main.py:42:10 E501 Line too long (120 > 100)
src/utils.ts:8:5 no-var Unexpected var, use let or const instead

3 violations found
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
    },
    {
      "file": "src/utils.ts",
      "line": 8,
      "column": 5,
      "rule": "no-var",
      "message": "Unexpected var, use let or const instead"
    }
  ],
  "summary": {
    "total": 3,
    "files": 2
  }
}
```

#### 2.2.6 Verification Failure Output

```
Error: Linter config verification failed

ESLint config missing required rules:
  - eqeqeq (required by cmc.toml)
  - max-lines-per-function (required by cmc.toml)

ESLint config has weaker rules:
  - no-var: "warn" (required: "error")

Run 'cmc generate eslint' to create a compliant config.
Or run 'cmc check --no-verify' to skip verification.
```

#### 2.2.7 Exit Codes

| Code | Condition                                                                 |
| ---- | ------------------------------------------------------------------------- |
| 0    | No violations found                                                       |
| 1    | Violations found                                                          |
| 2    | Configuration error (missing config, invalid syntax, verification failed) |
| 3    | Runtime error (linter failed, linter not installed)                       |

#### 2.2.8 Edge Cases

| Scenario                         | Behavior                                     |
| -------------------------------- | -------------------------------------------- |
| No files match path              | Warning to stderr, exit 0                    |
| Empty project                    | Warning "No files to check", exit 0          |
| Linter not installed             | Exit 3 with installation instructions        |
| Linter config missing            | Exit 2 with suggestion to run `cmc generate` |
| Linter config verification fails | Exit 2 with list of missing/weak rules       |

---

### 2.3 `cmc generate`

**Purpose:** Generate linter config files from `cmc.toml` ruleset.

#### 2.3.1 Usage

```bash
cmc generate <linter>
cmc generate eslint           # Generate eslint.config.js
cmc generate ruff             # Generate ruff.toml
```

#### 2.3.2 Arguments

| Argument   | Description                                         |
| ---------- | --------------------------------------------------- |
| `<linter>` | Which linter config to generate: `eslint` or `ruff` |

#### 2.3.3 Options

| Option     | Short | Description                      | Default |
| ---------- | ----- | -------------------------------- | ------- |
| `--force`  | `-f`  | Overwrite existing config file   | `false` |
| `--stdout` |       | Output to stdout instead of file | `false` |

#### 2.3.4 Behavior

1. Load and validate `cmc.toml`
2. Resolve community rulesets (if `[extends]` present)
3. Merge rules (local overrides community)
4. Check if target config file already exists
   - If exists and no `--force`: exit with error
5. Generate linter config with all merged rules
6. Write to standard location (or stdout if `--stdout`)
7. Print success message

**Generated File Locations:**

- ESLint: `eslint.config.js` (flat config format)
- Ruff: `ruff.toml`

#### 2.3.5 Generated File Examples

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

#### 2.3.6 Output

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

#### 2.3.7 Exit Codes

| Code | Condition                                                             |
| ---- | --------------------------------------------------------------------- |
| 0    | Config generated successfully                                         |
| 1    | Config file already exists (no `--force`)                             |
| 2    | Configuration error (invalid cmc.toml, no ruleset defined for linter) |

---

### 2.4 `cmc verify`

**Purpose:** Verify project linter configs match ruleset requirements (without running linters).

#### 2.4.1 Usage

```bash
cmc verify                    # Verify all linter configs
cmc verify eslint             # Verify only ESLint config
cmc verify ruff               # Verify only Ruff config
```

#### 2.4.2 Arguments

| Argument   | Description                                                                             |
| ---------- | --------------------------------------------------------------------------------------- |
| `<linter>` | Optional: which linter config to verify (`eslint` or `ruff`). If omitted, verifies all. |

#### 2.4.3 Options

| Option   | Short | Description    | Default |
| -------- | ----- | -------------- | ------- |
| `--json` |       | Output as JSON | `false` |

#### 2.4.4 Behavior

1. Load and validate `cmc.toml`
2. Resolve community rulesets (if `[extends]` present)
3. Merge rules (local overrides community)
4. For each linter (or specified linter):
   a. Parse project's linter config file
   b. Extract enabled rules and their severity
   c. Compare against required rules from merged ruleset
   d. Identify: missing rules, weaker rules
5. Output verification results
6. Exit with appropriate code

**Verification Logic:**

| Scenario                            | Result                                    |
| ----------------------------------- | ----------------------------------------- |
| Rule present and at least as strict | Pass                                      |
| Rule present but less strict        | Fail (e.g., "warn" when "error" required) |
| Rule missing                        | Fail                                      |
| Extra rules in linter config        | Pass (allowed)                            |

**Strictness ordering:** `error` > `warn` > `off`

#### 2.4.5 Output Formats

**Default (issues found):**

```
Verifying ESLint config against cmc.toml...

✗ Missing rules:
  - eqeqeq (required by cmc.toml)
  - max-lines-per-function (required by cmc.toml)

✗ Weaker rules:
  - no-var: "warn" (required: "error")

3 issues found.
```

**All pass:**

```
Verifying ESLint config against cmc.toml...

✓ All 5 required rules are present and sufficiently strict.

Verifying Ruff config against cmc.toml...

✓ All required settings are present.

All linter configs are valid.
```

**JSON:**

```json
{
  "eslint": {
    "valid": false,
    "missing": ["eqeqeq", "max-lines-per-function"],
    "weaker": [{ "rule": "no-var", "current": "warn", "required": "error" }]
  },
  "ruff": {
    "valid": true,
    "missing": [],
    "weaker": []
  }
}
```

#### 2.4.6 Exit Codes

| Code | Condition                                           |
| ---- | --------------------------------------------------- |
| 0    | All required rules present and sufficiently strict  |
| 1    | Verification failed (missing or weaker rules)       |
| 2    | Configuration error (no cmc.toml, no linter config) |

---

### 2.5 `cmc update`

**Purpose:** Fetch latest versions of configured community rulesets.

#### 2.5.1 Usage

```bash
cmc update
```

#### 2.5.2 Behavior

1. Load `cmc.toml`
2. Find `[extends].rulesets` entries
3. For each community ruleset reference:
   a. Parse the reference (e.g., `github:check-my-code/rulesets/typescript-strict`)
   b. Fetch from Git repository
   c. Store in local cache (`~/.cmc/rulesets/`)
4. Report what was updated

#### 2.5.3 Output

**Success:**

```
Updating community rulesets...

✓ github:check-my-code/rulesets/typescript-strict (updated)
✓ github:check-my-code/rulesets/python-prod (already up to date)

2 rulesets checked, 1 updated.
```

**No rulesets configured:**

```
No community rulesets configured in cmc.toml.

Add rulesets to extend:
  [extends]
  rulesets = ["github:check-my-code/rulesets/typescript-strict"]
```

#### 2.5.4 Exit Codes

| Code | Condition                                    |
| ---- | -------------------------------------------- |
| 0    | Update successful (or no rulesets to update) |
| 2    | Configuration error (invalid cmc.toml)       |
| 3    | Network error or Git fetch failed            |

---

### 2.6 `cmc context`

**Purpose:** Output active rules formatted for AI agent consumption.

#### 2.6.1 Usage

```bash
cmc context
```

#### 2.6.2 Behavior

1. Load and validate `cmc.toml`
2. Resolve community rulesets (if `[extends]` present)
3. Merge rules (local overrides community)
4. Format rules as markdown
5. Output to stdout

#### 2.6.3 Output Format

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

#### 2.6.4 Exit Codes

| Code | Condition                              |
| ---- | -------------------------------------- |
| 0    | Success                                |
| 2    | Configuration error (invalid cmc.toml) |

---

## 3. v2 Future Commands

The following commands are planned for v2:

### 3.1 `cmc diff`

Show files changed since last check.

```bash
cmc diff                      # List changed files
cmc diff --stat               # Show change statistics
```

### 3.2 `cmc dry-run`

Preview what would be checked without running checks.

```bash
cmc dry-run                   # Show files and rules that would be checked
```

### 3.3 `cmc report`

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

Run 'cmc init' to create a configuration file.
```

### 5.2 Common Errors

| Error                             | Exit Code | Suggestion                        |
| --------------------------------- | --------- | --------------------------------- |
| No cmc.toml found                 | 2         | Run `cmc init`                    |
| Invalid cmc.toml syntax           | 2         | Check TOML syntax                 |
| JSON Schema validation failed     | 2         | Fix cmc.toml structure            |
| Linter config missing             | 2         | Run `cmc generate`                |
| Linter config verification failed | 2         | Run `cmc generate --force`        |
| Linter not installed              | 3         | Install the required linter       |
| Community ruleset fetch failed    | 3         | Check network, verify ruleset URL |

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
import { initCommand } from './commands/init';
import { generateCommand } from './commands/generate';
import { verifyCommand } from './commands/verify';
import { updateCommand } from './commands/update';
import { contextCommand } from './commands/context';

const program = new Command();

program.name('cmc').description('Verify code against configurable rulesets').version(VERSION);

program.addCommand(initCommand);
program.addCommand(checkCommand);
program.addCommand(generateCommand);
program.addCommand(verifyCommand);
program.addCommand(updateCommand);
program.addCommand(contextCommand);

program.parse();
```

### 6.3 Command Structure

Each command is a separate module:

```typescript
// src/cli/commands/check.ts
import { Command } from 'commander';

export const checkCommand = new Command('check')
  .description('Run verification checks')
  .argument('[path]', 'path to check')
  .option('--no-verify', 'skip config verification')
  .option('--json', 'JSON output')
  .action(async (path, options) => {
    // Implementation
  });
```

---

_End of Document_
