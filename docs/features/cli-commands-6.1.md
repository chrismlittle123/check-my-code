# CLI Commands Feature PRD (Section 6.1)

**Parent Document:** check-my-code-prd.md
**Version:** 1.0
**Status:** Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [Command Reference](#2-command-reference)
   - 2.1 [cmc check](#21-cmc-check)
   - 2.2 [cmc init](#22-cmc-init)
   - 2.3 [cmc diff](#23-cmc-diff)
   - 2.4 [cmc context](#24-cmc-context)
   - 2.5 [cmc report](#25-cmc-report)
   - 2.6 [cmc update](#26-cmc-update)
   - 2.7 [cmc dry-run](#27-cmc-dry-run)
3. [Global Options](#3-global-options)
4. [Error Handling](#4-error-handling)
5. [Help System](#5-help-system)
6. [Shell Completion](#6-shell-completion)
7. [Technical Implementation](#7-technical-implementation)
8. [Open Questions](#8-open-questions)

---

## 1. Overview

### 1.1 Purpose

This document provides detailed specifications for all CLI commands in `check-my-code` (`cmc`). It expands on section 6.1 of the main PRD with implementation details, edge cases, and behavioral specifications.

### 1.2 Design Principles

- **Predictable behavior:** Commands behave consistently across invocations
- **Fail-fast:** Invalid input or missing prerequisites cause immediate, clear errors
- **Progressive disclosure:** Simple usage by default, power-user options available
- **Unix philosophy:** Commands work well with pipes, redirects, and scripting

### 1.3 Command Naming Convention

All commands use lowercase, single-word names. Subcommands are not used in v1 to keep the CLI surface simple.

---

## 2. Command Reference

### 2.1 `cmc check`

**Purpose:** Run verification checks against configured rulesets.

#### 2.1.1 Usage

```bash
cmc check [options] [<path>]
cmc check [options] --paths <path1> <path2> ...
```

#### 2.1.2 Arguments

| Argument | Description |
|----------|-------------|
| `<path>` | Optional single path to check. Can be a file or directory. If omitted, checks entire project from `cmc.toml` location. |
| `--paths <path>...` | Required when checking multiple paths. Accepts two or more paths. |

**Note:** To check multiple specific paths, you must use the `--paths` flag. A single positional path argument is allowed for convenience.

#### 2.1.3 Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--paths` | `-p` | Check multiple specific paths (required for >1 path) | — |
| `--all` | `-a` | Force check all files, ignoring smart checking cache | `false` |
| `--no-ai` | | Skip AI-assisted checks | `false` |
| `--no-cache` | | Do not update the state cache after check | `false` |
| `--verbose` | `-v` | Show detailed progress and violation messages | `false` |
| `--quiet` | `-q` | Only output violation count, no details | `false` |
| `--json` | | Output results as JSON | `false` |
| `--config` | `-c` | Path to `cmc.toml` config file | Auto-discovered |

**Option Conflicts:** The `--verbose` and `--quiet` flags are mutually exclusive. If both are provided, `cmc` will exit with error code 2 and display: `Error: --verbose and --quiet cannot be used together`

#### 2.1.4 Behavior

**Normal execution flow:**

1. Discover configuration file (`cmc.toml`)
2. Parse and validate configuration
3. Resolve all referenced rulesets (fetch if needed)
4. Determine files in scope:
   - If `<path>` or `--paths` provided: files matching path(s)
   - If no path specified: all source files under config directory (excludes hidden files/directories by default)
5. Apply smart checking (unless `--all`):
   - Load `.cmc/state.json`
   - Filter to files with changed hashes or new files
6. Display progress indicator (spinner) during check execution
7. For each file in scope:
   a. Run linter checks (parallel by language)
   b. Run simple checks
   c. Run script checks
   d. Run AI checks (unless `--no-ai`)
8. Collect all violations
9. Output results (format based on flags)
10. Update `.cmc/state.json` (unless `--no-cache`)
11. Exit with appropriate code

**Progress Indicators:**

During check execution, `cmc` displays a spinner with current status:
```
⠋ Checking files... [ruff] 12/24 files
```

Progress is shown for:
- Ruleset fetching
- Linter execution (per linter)
- AI-assisted checks
- File processing count

Progress output goes to stderr so stdout remains clean for piping.

**Parallel execution:**

- Linter checks for different languages run in parallel
- File-level checks within a language are parallelized
- AI checks are sequential (rate limiting consideration)

**Interrupt Handling (Ctrl+C):**

When interrupted mid-check, `cmc` immediately terminates and discards all partial state. The `.cmc/state.json` file is not updated, preserving the previous check state. No cleanup prompt is shown.

**Hidden Files:**

By default, `cmc` excludes hidden files and directories (those starting with `.`) from checks. To include specific hidden paths, specify them explicitly:
```bash
cmc check --paths .github/workflows src/
```

#### 2.1.5 Output Formats

**Default output:**
```
src/main.py:15 max-file-length
src/main.py:42 require-docstrings
src/utils.py:8 meaningful-names

3 violations found
```

**Verbose output (`-v`):**
```
Checking 24 files against 3 rulesets...

[ruff] Running Python linter...
[eslint] Running TypeScript linter...
[ai:claude] Running AI-assisted checks...

src/main.py:15 max-file-length
  File exceeds 500 lines (current: 523)

src/main.py:42 require-docstrings
  Function 'process_data' missing docstring

src/utils.py:8 meaningful-names
  Function name 'x' is not descriptive

3 violations in 2 files
Checked 24 files in 2.3s (18 cached, 6 checked)
```

**Quiet output (`-q`):**
```
3
```

**JSON output (`--json`):**
```json
{
  "summary": {
    "files_checked": 6,
    "files_cached": 18,
    "violations_total": 3,
    "duration_ms": 2300
  },
  "violations": [
    {
      "file": "src/main.py",
      "line": 15,
      "column": null,
      "rule": "max-file-length",
      "message": "File exceeds 500 lines (current: 523)",
      "ruleset": "community/python-fastapi-prod@1.0.0"
    }
  ]
}
```

#### 2.1.6 Exit Codes

| Code | Condition |
|------|-----------|
| 0 | No violations found |
| 1 | Violations found |
| 2 | Configuration error (missing config, invalid syntax, conflicting options) |
| 3 | Runtime error (linter failed, agent unavailable, network error) |

**Mixed Result Handling:** If code checks pass but an AI check fails due to agent unavailability (not a code violation), the exit code is **3** (runtime error). Runtime errors take precedence over violation reporting.

#### 2.1.7 Edge Cases

- **No files match path:** Warning to stderr, exit 0
- **Empty project:** Warning "No files to check", exit 0
- **All files cached:** Message "All files up to date", exit with cached violation count
- **Linter not installed:** Exit 3 with installation instructions
- **AI agent unavailable:** Exit 3 with configuration guidance

---

### 2.2 `cmc init`

**Purpose:** Generate a configuration file for the current project.

#### 2.2.1 Usage

```bash
cmc init [options]
```

#### 2.2.2 Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--interactive` | `-i` | Launch interactive setup wizard | `false` |
| `--force` | `-f` | Overwrite existing `cmc.toml` | `false` |
| `--path` | `-p` | Directory to create config in | Current directory |

#### 2.2.3 Behavior

**Minimal mode (default):**

1. Check if `cmc.toml` already exists
   - If exists and no `--force`: exit with error
2. Detect project characteristics:
   - Languages present (by file extensions)
   - Existing linter configs
3. Generate minimal `cmc.toml` with placeholders
4. Print next steps to stdout

**Interactive mode (`-i`):**

1. Same initial checks as minimal
2. Prompt sequence:
   a. "What is this project's name?" (default: directory name)
   b. "What category best describes this project?" (production/prototype/internal/other)
   c. "Which languages does this project use?" (auto-detected, confirm)
   d. "Would you like to use community rulesets?" (Y/n)
   e. If yes: present language-appropriate community rulesets
   f. "Which AI agent do you primarily use?" (claude/codex/gemini/none)
3. Generate `cmc.toml` based on responses
4. Create `.cmc/` directory
5. Print summary and next steps

**Interrupt Handling:** If the user presses Ctrl+C during interactive mode, any partial configuration is discarded. No files are written.

#### 2.2.4 Generated Files

**Minimal `cmc.toml`:**
```toml
[project]
name = "my-project"
category = "production"  # Change to: prototype, internal, etc.

[rulesets]
default = [
  # Add rulesets here. Examples:
  # "community/general-best-practices@1.0.0"
  # "git@github.com:yourcompany/standards.git#base@1.0.0"
]

# Uncomment and configure for language-specific rules:
# [rulesets.python]
# paths = ["**/*.py"]
# rules = ["community/python-base@1.0.0"]

# [rulesets.typescript]
# paths = ["**/*.ts", "**/*.tsx"]
# rules = ["community/typescript-base@1.0.0"]

[ai]
enabled = false  # Set to true to enable AI-assisted checks
```

#### 2.2.5 Output

**After minimal init:**
```
Created cmc.toml

Next steps:
1. Edit cmc.toml to configure rulesets for your project
2. Run 'cmc check' to verify your code
3. Run 'cmc context' to generate rules for your AI agent

Documentation: https://github.com/check-my-code/docs
```

#### 2.2.6 Exit Codes

| Code | Condition |
|------|-----------|
| 0 | Configuration created successfully |
| 1 | Configuration already exists (no `--force`) |
| 2 | Invalid path or permission error |

---

### 2.3 `cmc diff`

**Purpose:** Show what has changed since the last check.

#### 2.3.1 Usage

```bash
cmc diff [options]
```

#### 2.3.2 Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--stat` | `-s` | Show change statistics | `false` |
| `--json` | | Output as JSON | `false` |

#### 2.3.3 Behavior

1. Load `.cmc/state.json`
   - If not exists: treat all files as new
2. Scan all files in scope
3. Compare current file hashes to cached hashes
4. Categorize files:
   - **New:** Not in cache
   - **Modified:** Hash changed
   - **Deleted:** In cache but not on disk
   - **Unchanged:** Hash matches
5. Output changed files

#### 2.3.4 Output Formats

**Default:**
```
M src/main.py
M src/utils.py
A src/new_feature.py
D src/deprecated.py

3 modified, 1 added, 1 deleted
```

**With stats (`--stat`):**
```
M src/main.py         +15 -3
M src/utils.py        +42 -10
A src/new_feature.py  +120
D src/deprecated.py   -85

3 modified, 1 added, 1 deleted
Lines: +177 -98
```

**JSON:**
```json
{
  "modified": ["src/main.py", "src/utils.py"],
  "added": ["src/new_feature.py"],
  "deleted": ["src/deprecated.py"],
  "unchanged_count": 45
}
```

#### 2.3.5 Exit Codes

| Code | Condition |
|------|-----------|
| 0 | Success (changes or no changes) |
| 2 | Configuration error |

---

### 2.4 `cmc context`

**Purpose:** Output active rules formatted for AI agent consumption.

#### 2.4.1 Usage

```bash
cmc context [options]
```

#### 2.4.2 Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--agent` | `-a` | Target agent (claude/codex/gemini) | From config |
| `--format` | `-f` | Output format (markdown/json/text) | `markdown` |
| `--include-meta` | | Include ruleset metadata and versions | `false` |

#### 2.4.3 Behavior

1. Load configuration
2. Determine target agent:
   - From `--agent` flag if provided
   - From `CMC_AGENT` environment variable
   - From `.cmc/profile.local.yml`
   - From `~/.cmcconfig`
   - **Error if none configured** (exit code 2)
3. Resolve all active rulesets
4. Merge rules (later rulesets override earlier)
5. Deduplicate identical rules
6. Group by category (general, language-specific)
7. Format output for target agent
8. Output to stdout

**No Default Agent:** If no agent is configured anywhere and `--agent` is not provided, `cmc context` exits with error code 2:
```
Error: No AI agent configured

Configure an agent using one of:
  - CMC_AGENT environment variable
  - ~/.cmcconfig file
  - .cmc/profile.local.yml file
  - --agent flag

Example: cmc context --agent=claude
```

#### 2.4.4 Output Formats

**Markdown (default):**
```markdown
# Code Standards for this Project

You MUST follow these rules when writing code:

## General Rules
- Maximum file length: 500 lines
- All functions must have docstrings
- No print/console.log statements in production code

## Python Rules
- Use type hints for all function parameters and return values
- Follow NumPy docstring format
- Use snake_case for function and variable names

## TypeScript Rules
- All exported functions must have JSDoc comments
- Use explicit return types
- No `any` types
```

**JSON:**
```json
{
  "project": "my-project",
  "category": "production",
  "rules": {
    "general": [
      {"id": "max-file-length", "description": "Maximum file length: 500 lines"}
    ],
    "python": [
      {"id": "require-type-hints", "description": "Use type hints for all parameters"}
    ]
  }
}
```

**Text (minimal):**
```
RULES:
- Max file length: 500 lines
- Functions must have docstrings
- Python: Use type hints
- TypeScript: Use explicit return types
```

#### 2.4.5 Agent-Specific Formatting

Different agents may benefit from different phrasings:

- **Claude:** Uses assertive language ("You MUST...")
- **Codex:** May prefer bullet points
- **Gemini:** May prefer structured sections

(Note: v1 may use identical formatting; agent-specific tuning is a potential enhancement)

#### 2.4.6 Exit Codes

| Code | Condition |
|------|-----------|
| 0 | Success |
| 2 | Configuration error |

---

### 2.5 `cmc report`

**Purpose:** Generate a detailed report of violations.

#### 2.5.1 Usage

```bash
cmc report [options]
```

#### 2.5.2 Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--html` | | Generate HTML report | `false` (stdout) |
| `--output` | `-o` | Output file path | `stdout` or `cmc-report.html` |
| `--all` | `-a` | Force check all files | `false` |
| `--no-ai` | | Skip AI-assisted checks | `false` |

#### 2.5.3 Behavior

1. Run full check (equivalent to `cmc check`)
2. Format results as report
3. Output to destination (overwrites existing file without prompting)

#### 2.5.4 Output Formats

**Stdout (default):**
```
=== check-my-code Report ===
Generated: 2025-11-30T14:30:00Z
Project: my-project

SUMMARY
-------
Files checked: 24
Violations: 3
Rulesets: 3

VIOLATIONS BY FILE
------------------
src/main.py (2 violations)
  Line 15: max-file-length - File exceeds 500 lines (current: 523)
  Line 42: require-docstrings - Function 'process_data' missing docstring

src/utils.py (1 violation)
  Line 8: meaningful-names - Function name 'x' is not descriptive

VIOLATIONS BY RULE
------------------
max-file-length (1)
  - src/main.py:15

require-docstrings (1)
  - src/main.py:42

meaningful-names (1)
  - src/utils.py:8
```

**HTML report:** Self-contained HTML file with:
- Summary dashboard
- Expandable file sections
- Rule groupings
- Timestamp and version info
- Sortable/filterable tables

#### 2.5.5 Exit Codes

| Code | Condition |
|------|-----------|
| 0 | Report generated (regardless of violations) |
| 2 | Configuration error |
| 3 | Runtime error |

---

### 2.6 `cmc update`

**Purpose:** Fetch latest versions of configured rulesets.

#### 2.6.1 Usage

```bash
cmc update [options]
```

#### 2.6.2 Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--dry-run` | `-n` | Show what would be updated without fetching | `false` |
| `--force` | `-f` | Re-fetch even if cached | `false` |

#### 2.6.3 Behavior

1. Parse configuration for all ruleset references
2. For each ruleset:
   - If pinned version and cached: skip (unless `--force`)
   - If pinned version and not cached: fetch
   - If unpinned: fetch latest
3. Display update summary

#### 2.6.4 Output

**Normal update:**
```
Updating rulesets...

community/python-fastapi-prod@1.0.0: cached (up to date)
community/typescript-react-prod: 1.0.0 -> 1.1.0 (updated)
git@github.com:mycompany/standards.git#base@2.1.0: fetched

Changes in typescript-react-prod 1.1.0:
  - Added rule: no-implicit-any
  - Updated rule: max-file-length (400 -> 350)

Updated 1 ruleset, fetched 1, 1 cached
```

**Dry run (`--dry-run`):**
```
Would update:
  community/typescript-react-prod: 1.0.0 -> 1.1.0

Would fetch:
  git@github.com:mycompany/standards.git#base@2.1.0

Already cached:
  community/python-fastapi-prod@1.0.0
```

#### 2.6.5 Exit Codes

| Code | Condition |
|------|-----------|
| 0 | Success |
| 2 | Configuration error |
| 3 | Network/fetch error |

---

### 2.7 `cmc dry-run`

**Purpose:** Show what would be checked without running checks.

#### 2.7.1 Usage

```bash
cmc dry-run [options] [<path>...]
```

#### 2.7.2 Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--json` | | Output as JSON | `false` |

#### 2.7.3 Behavior

1. Load configuration
2. Resolve all rulesets
3. Determine files in scope
4. Categorize by check type (linter/simple/script/AI)
5. Output summary without executing any checks

#### 2.7.4 Output

**Default:**
```
=== Dry Run ===

FILES (24 total, 6 would be checked)
  Cached (unchanged): 18
  To check: 6
    - src/main.py
    - src/utils.py
    - src/new_feature.py
    - frontend/App.tsx
    - frontend/utils.ts
    - frontend/api.ts

CHECKS
  Linter checks:
    - ruff (Python): 3 files
    - eslint (TypeScript): 3 files

  Simple checks: 5 rules
    - max-file-length
    - require-docstrings
    - require-type-hints
    - require-jsdoc
    - no-console

  AI-assisted checks: 1 rule
    - meaningful-names (requires: claude)

RULESETS
  - community/python-fastapi-prod@1.0.0
  - community/typescript-react-prod@1.0.0
  - git@github.com:mycompany/standards.git#base@2.1.0
```

#### 2.7.5 Exit Codes

| Code | Condition |
|------|-----------|
| 0 | Success |
| 2 | Configuration error |

---

## 3. Global Options

These options are available on all commands:

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help for command |
| `--version` | `-V` | Show cmc version (format: `X.Y.Z` only) |
| `--no-color` | | Disable colored output |
| `--debug` | | Show debug information |

**Version Output:** The `--version` flag outputs only the semantic version number (e.g., `1.0.0`), with no additional metadata.

---

## 4. Error Handling

### 4.1 Error Message Format

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

### 4.2 Common Errors

| Error | Exit Code | Suggestion |
|-------|-----------|------------|
| No cmc.toml found | 2 | Run `cmc init` |
| Invalid cmc.toml syntax | 2 | Check TOML syntax |
| Conflicting options | 2 | Remove conflicting flags |
| No agent configured | 2 | Configure agent or use `--agent` flag |
| Empty ruleset list | 0 | Warning only; no error |
| Ruleset not found | 3 | Check ruleset reference, run `cmc update` |
| Linter not installed | 3 | Install the required linter |
| AI agent not found | 3 | Install agent or configure different one |
| Git authentication failed | 3 | Check SSH keys or tokens |

**Empty Rulesets:** If `cmc.toml` exists but has no rulesets defined, `cmc check` prints a warning to stderr and exits with code 0:
```
Warning: No rulesets configured in cmc.toml. Nothing to check.
```

---

## 5. Help System

### 5.1 Main Help (`cmc --help`)

```
check-my-code - Verify code against configurable rulesets

Usage: cmc <command> [options]

Commands:
  check      Run verification checks
  init       Generate configuration file
  diff       Show changes since last check
  context    Output rules for AI agents
  report     Generate detailed violation report
  update     Fetch latest rulesets
  dry-run    Preview what would be checked

Options:
  -h, --help     Show help
  -V, --version  Show version
  --no-color     Disable colors
  --debug        Debug output

Run 'cmc <command> --help' for command-specific help.
```

### 5.2 Command Help (`cmc check --help`)

```
Run verification checks against configured rulesets

Usage: cmc check [options] [<path>...]

Arguments:
  <path>...    Files or directories to check (default: entire project)

Options:
  -a, --all       Check all files, ignore cache
  --no-ai         Skip AI-assisted checks
  --no-cache      Don't update state cache
  -v, --verbose   Detailed output
  -q, --quiet     Minimal output (violation count only)
  --json          JSON output
  -c, --config    Path to cmc.toml

Examples:
  cmc check                    Check entire project
  cmc check -p backend/        Check backend directory
  cmc check --all              Force check all files
  cmc check --no-ai            Skip AI checks
```

---

## 6. Shell Completion

### 6.1 Supported Shells

- Bash
- Zsh
- Fish

### 6.2 Installation

```bash
# Bash
cmc completion bash >> ~/.bashrc

# Zsh
cmc completion zsh >> ~/.zshrc

# Fish
cmc completion fish > ~/.config/fish/completions/cmc.fish
```

### 6.3 Completion Behavior

- Commands: Complete on first argument
- Options: Complete after `-` or `--`
- Paths: Complete file/directory paths for relevant commands
- Agent names: Complete for `--agent` option

---

## 7. Technical Implementation

### 7.1 CLI Framework

Use Commander.js for:
- Command parsing
- Option handling
- Help generation
- Subcommand routing

### 7.2 Entry Point Structure

```typescript
// src/cli/index.ts
import { Command } from 'commander';
import { checkCommand } from './commands/check';
import { initCommand } from './commands/init';
// ... other commands

const program = new Command();

program
  .name('cmc')
  .description('Verify code against configurable rulesets')
  .version(VERSION);

program.addCommand(checkCommand);
program.addCommand(initCommand);
// ... other commands

program.parse();
```

### 7.3 Command Structure

Each command is a separate module:

```typescript
// src/cli/commands/check.ts
import { Command } from 'commander';

export const checkCommand = new Command('check')
  .description('Run verification checks')
  .argument('[path...]', 'paths to check')
  .option('-a, --all', 'check all files')
  .option('--no-ai', 'skip AI checks')
  .option('-v, --verbose', 'detailed output')
  .option('-q, --quiet', 'minimal output')
  .option('--json', 'JSON output')
  .option('-c, --config <path>', 'config file path')
  .action(async (paths, options) => {
    // Implementation
  });
```

---

## 8. Resolved Questions

The following questions have been clarified:

| # | Question | Resolution |
|---|----------|------------|
| 1 | Path argument handling | Single path allowed as positional arg; multiple paths require `--paths` flag |
| 2 | Conflicting options (`--verbose --quiet`) | Error out with exit code 2 |
| 3 | Progress indicators | Display spinner with status during long-running checks |
| 4 | Interrupt handling (Ctrl+C) | Discard everything; do not update state |
| 6 | Watch mode | Deferred; not needed for v1 |
| 7 | Verbosity levels | Single `-v` flag is sufficient |
| 8 | Exit code for mixed results | Runtime error (exit 3) takes precedence |
| 9 | Output file conflicts | Overwrite without prompting |
| 10 | Default agent selection | Error if no agent configured |
| 12 | Empty ruleset handling | Warn but exit 0 |
| 13 | Interactive init cancellation | Discard partial config |
| 14 | Version format | Semantic version only (`X.Y.Z`) |
| 15 | Hidden/dotfile handling | Excluded by default; require explicit `--paths` inclusion |

---

## 9. Open Questions

The following items still require clarification:

### 9.1 Stdin Input Support

Should any commands accept file lists from stdin?

**Example use case:**
```bash
git diff --name-only | cmc check -
```

**Options:**
- A) Support `-` as special argument to read paths from stdin
- B) No stdin support in v1; users can use `xargs` instead
- C) Support stdin but only for specific commands (which ones?)

**Considerations:**
- Useful for integration with other tools
- Adds complexity to argument parsing
- `xargs` workaround: `git diff --name-only | xargs cmc check --paths`

---

### 9.2 Parallelism Configuration

Should the number of parallel file checks be configurable?

**Options:**
- A) Hardcoded sensible default (e.g., CPU cores)
- B) Configurable via flag (`--parallel=N` or `--jobs=N`)
- C) Configurable via config file only
- D) Both flag and config file

**Considerations:**
- CI environments may benefit from limiting parallelism
- Most users won't need to adjust
- Linters may have their own parallelism settings

---

### 9.3 Additional Questions

1. **Color scheme:** What specific colors should be used?
   - Errors: red?
   - Warnings: yellow?
   - Success: green?
   - File paths: cyan/blue?
   - Rule names: bold?

2. **Config precedence with `--config`:** If `--config /other/path/cmc.toml` is provided, what is the "project root" for relative paths in the config?
   - A) Directory containing the specified `cmc.toml`
   - B) Current working directory
   - C) Error if paths don't resolve

3. **Shell completion command:** Should this be:
   - A) `cmc completion <shell>` subcommand
   - B) `cmc --completion-<shell>` flag
   - C) Separate script bundled with package

4. **Deprecation warnings:** When options/commands are deprecated in future versions, how should users be notified?
   - A) Warning to stderr, continue execution
   - B) Warning only in verbose mode
   - C) Include in `cmc --help` output

---

*End of Document*
