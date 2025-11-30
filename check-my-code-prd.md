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
6. [Feature Specifications](#6-feature-specifications)
   - 6.1 [CLI Commands](#61-cli-commands)
   - 6.2 [Configuration System](#62-configuration-system)
   - 6.3 [Ruleset System](#63-ruleset-system)
   - 6.4 [Smart Checking](#64-smart-checking)
   - 6.5 [Linter & Formatter Integration](#65-linter--formatter-integration)
   - 6.6 [AI Agent Integration](#66-ai-agent-integration)
   - 6.7 [Output & Reporting](#67-output--reporting)
   - 6.8 [CI/CD Integration](#68-cicd-integration)
7. [Technical Specifications](#7-technical-specifications)
8. [User Workflows](#8-user-workflows)
9. [Out of Scope (v1)](#9-out-of-scope-v1)
10. [Glossary](#10-glossary)

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

1. **Verifies code** against configurable rulesets
2. **Provides context** to AI coding agents so they write compliant code
3. **Reports violations** with file paths and line numbers
4. **Integrates with CI/CD** to gate pull requests

### What cmc Does NOT Do (v1)

- Auto-fix code (delegates to existing pre-commit hooks)
- Replace linters (uses them as a first pass)
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

`cmc` always uses existing project linters/formatters (ESLint, Ruff) as the first verification pass. AI-assisted checks are only used for rules that cannot be mechanically verified.

### 5.3 Smart Checking

`cmc` tracks which files have been checked and skips unchanged files on subsequent runs, reducing verification time.

### 5.4 Agent-Agnostic

`cmc` works with any AI coding tool by providing standardised context output and supporting multiple invocation methods.

### 5.5 Centralised Standards, Distributed Execution

Rulesets are managed centrally (in Git repositories) but executed locally in each project without requiring per-repo ruleset copies.

---

## 6. Feature Specifications

### 6.1 CLI Commands

#### 6.1.1 `cmc check`

**Purpose:** Run verification checks against the configured rulesets.

**Usage:**
```bash
cmc check                     # Check entire project
cmc check -p backend/         # Check specific path
cmc check --all               # Force check all files (ignore cache)
```

**Behaviour:**
- Reads project configuration from `cmc.toml`
- Fetches required rulesets (if not cached)
- Runs linter checks first (ESLint, Ruff)
- Runs AI-assisted checks for subjective rules (if configured)
- Outputs violations to stdout
- Exits with code 0 (no violations) or 1 (violations found)

**Flags:**
| Flag | Description |
|------|-------------|
| `-p, --path <path>` | Check specific path or file |
| `--all` | Check all files, ignoring cache |
| `--no-ai` | Skip AI-assisted checks |
| `--verbose` | Show detailed progress |

---

#### 6.1.2 `cmc init`

**Purpose:** Generate a minimal configuration file.

**Usage:**
```bash
cmc init                      # Generate minimal cmc.toml
cmc init --interactive        # Interactive setup wizard
```

**Behaviour (minimal):**
- Creates `cmc.toml` with placeholder values
- Prints instructions for next steps

**Behaviour (interactive):**
- Prompts for project category (e.g., production, prototype)
- Prompts for languages used
- Suggests relevant community rulesets
- Prompts for AI agent preference
- Creates fully configured `cmc.toml`

---

#### 6.1.3 `cmc diff`

**Purpose:** Show what has changed since the last check.

**Usage:**
```bash
cmc diff                      # List changed files
cmc diff --stat               # Show change statistics
```

**Behaviour:**
- Compares current file states against cached check state
- Lists files that would be checked on next `cmc check`

---

#### 6.1.4 `cmc context`

**Purpose:** Output active rules formatted for a specific AI agent.

**Usage:**
```bash
cmc context                           # Output for default agent
cmc context --agent=claude            # Output for Claude Code
cmc context --agent=codex             # Output for Codex
cmc context --agent=gemini            # Output for Gemini CLI
cmc context --format=markdown         # Explicit markdown format
cmc context --format=json             # JSON format for programmatic use
```

**Behaviour:**
- Resolves all active rulesets for the current project
- Merges and deduplicates rules
- Outputs rules in agent-appropriate format
- Uses strict language ("you MUST follow these rules")

**Output Example (markdown):**
```markdown
# Code Standards for this Project

You MUST follow these rules when writing code:

## Python Rules
- All functions must have docstrings
- Maximum file length: 500 lines
- Use type hints for all function parameters and return values
- Function names must be descriptive and use snake_case

## TypeScript Rules
- All exported functions must have JSDoc comments
- Maximum file length: 400 lines
- Use explicit return types on all functions
```

---

#### 6.1.5 `cmc report`

**Purpose:** Generate a detailed report of violations.

**Usage:**
```bash
cmc report                    # Output to stdout
cmc report --html             # Generate HTML report
cmc report --html -o report.html  # Save to specific file
```

**Behaviour:**
- Runs full check (equivalent to `cmc check`)
- Formats output as detailed report
- HTML report includes: summary, violations by file, violations by rule

---

#### 6.1.6 `cmc update`

**Purpose:** Fetch latest versions of configured rulesets.

**Usage:**
```bash
cmc update                    # Update all rulesets
cmc update --dry-run          # Show what would be updated
```

**Behaviour:**
- Fetches latest versions of unpinned rulesets
- Updates cached rulesets for pinned versions if not present
- Displays changelog/diff for updated rulesets

---

#### 6.1.7 `cmc dry-run`

**Purpose:** Show what would be checked without running checks.

**Usage:**
```bash
cmc dry-run
```

**Behaviour:**
- Lists all files that would be checked
- Lists all rules that would be applied
- Shows which checks are linter-based vs AI-assisted

---

### 6.2 Configuration System

#### 6.2.1 Project Configuration File

**File:** `cmc.toml` (located in project root)

**Purpose:** Defines which rulesets apply to the project and how.

**Required:** Yes — `cmc` refuses to run without this file.

**Schema:**
```toml
# Project metadata
[project]
name = "my-project"
category = "production"  # User-defined: production, prototype, internal, etc.

# Rulesets to apply (order matters - later overrides earlier)
[rulesets]
default = [
  "community/general-best-practices@1.0.0",
  "git@github.com:mycompany/code-standards.git#base@2.1.0"
]

# Language-specific rulesets
[rulesets.python]
paths = ["backend/", "scripts/"]
rules = [
  "community/python-fastapi-prod@1.0.0",
  "git@github.com:mycompany/code-standards.git#python-strict@1.0.0"
]

[rulesets.typescript]
paths = ["frontend/", "shared/"]
rules = [
  "community/typescript-react-prod@1.0.0"
]

# Supported AI agents for this project
[agents]
supported = ["claude", "codex", "gemini"]

# AI-assisted checks configuration
[ai]
enabled = true  # Set to false to disable AI checks globally
```

**Path Matching:**
- Paths are relative to project root
- Supports glob patterns: `src/**/*.py`
- If a file matches multiple path rules, all matching rulesets apply

---

#### 6.2.2 User Configuration (Per-User Defaults)

**Precedence (highest to lowest):**

1. **Environment variable:** `CMC_AGENT=claude`
2. **Local project file:** `.cmc/profile.local.yml` (gitignored)
3. **Global user config:** `~/.cmcconfig`

**Global Config (`~/.cmcconfig`):**
```yaml
agent: claude
```

**Local Profile (`.cmc/profile.local.yml`):**
```yaml
agent: codex
```

**Purpose:** Allows each developer to set their preferred AI agent without affecting team configuration.

---

#### 6.2.3 Agent Configuration

**File:** `.cmc/agents.yml`

**Purpose:** Pre-configures which agents are available and how to invoke them.

**Schema:**
```yaml
agents:
  claude:
    command: "claude"
    prompt_flag: "--prompt"
    
  codex:
    command: "codex"
    prompt_flag: "-p"
    
  gemini:
    command: "gemini"
    prompt_flag: "--prompt"
```

---

#### 6.2.4 Configuration Discovery

When `cmc` runs, it discovers configuration by:

1. Looking for `cmc.toml` in current directory
2. If not found, traversing up to find `cmc.toml`
3. If no config found, exiting with error:
   ```
   Error: No cmc.toml found. Run 'cmc init' to create one.
   ```

**Subdirectory Configs:**
- `cmc check` from project root auto-discovers configs in subdirectories
- Example: `/backend/cmc.toml` and `/frontend/cmc.toml` are both discovered and run
- Use `cmc check -p backend/` to check only a specific subdirectory

---

### 6.3 Ruleset System

#### 6.3.1 Ruleset Structure

A ruleset is a collection of rules stored in a Git repository as YAML/TOML files.

**Directory Structure:**
```
my-rulesets/
├── python-fastapi-prod/
│   ├── ruleset.toml
│   └── scripts/
│       └── check_docstrings.py
├── typescript-react-prod/
│   └── ruleset.toml
└── general-best-practices/
    └── ruleset.toml
```

**Ruleset File (`ruleset.toml`):**
```toml
[meta]
name = "python-fastapi-prod"
version = "1.0.0"
description = "Production standards for FastAPI Python projects"
languages = ["python"]
extends = ["community/python-base@1.0.0"]  # Optional inheritance

# Declarative rules
[rules.max-file-length]
type = "simple"
check = "file-length"
max = 500
message = "Files must not exceed 500 lines"

[rules.require-docstrings]
type = "simple"
check = "require-docstrings"
scope = "functions"  # functions, classes, modules
message = "All functions must have docstrings"

# Linter-based rules (delegates to existing linter)
[rules.ruff-checks]
type = "linter"
linter = "ruff"
config = { select = ["E", "F", "I"], ignore = ["E501"] }

# Script-based rules (custom verification logic)
[rules.custom-docstring-format]
type = "script"
command = "python scripts/check_docstrings.py"
message = "Docstrings must follow NumPy format"

# AI-assisted rules (for subjective checks)
[rules.meaningful-names]
type = "ai"
prompt = "Review these function names and identify any that are not descriptive or meaningful"
extractor = "python scripts/extract_function_names.py"
message = "Function names must be meaningful and descriptive"
```

---

#### 6.3.2 Rule Types

| Type | Description | Execution |
|------|-------------|-----------|
| `simple` | Declarative, built-in checks | Executed by `cmc` core |
| `linter` | Delegates to external linter | Shells out to linter CLI |
| `script` | Custom verification script | Executes script, parses output |
| `ai` | AI-assisted subjective check | Invokes AI agent with extracted context |

---

#### 6.3.3 Built-in Simple Checks

| Check | Parameters | Description |
|-------|------------|-------------|
| `file-length` | `max: number` | Maximum lines per file |
| `require-docstrings` | `scope: functions\|classes\|modules` | Require documentation |
| `require-type-hints` | `scope: parameters\|returns\|all` | Require type annotations (Python) |
| `require-jsdoc` | `scope: exported\|all` | Require JSDoc comments (TypeScript) |
| `no-console` | — | Disallow console.log statements |
| `no-print` | — | Disallow print statements (Python) |

---

#### 6.3.4 Ruleset References

**Community Rulesets:**
```
community/python-fastapi-prod@1.0.0
community/typescript-react-prod@2.0.0
```

Resolved to: `https://github.com/checkmycode-community/rulesets` (public repository)

**Private/Organisation Rulesets:**
```
git@github.com:mycompany/code-standards.git#python-strict@1.0.0
```

Uses developer's existing Git credentials (SSH keys, tokens).

**Reference Format:**
```
<source>/<ruleset-name>@<version>
```

Where source is:
- `community` — resolves to public community repository
- `git@...` or `https://...` — direct Git repository reference

---

#### 6.3.5 Ruleset Composition & Inheritance

**Composition (multiple rulesets):**
```toml
[rulesets.python]
rules = [
  "community/python-base@1.0.0",
  "community/python-security@1.0.0",
  "git@github.com:mycompany/code-standards.git#python-internal@1.0.0"
]
```

All rulesets are merged. Later rulesets override earlier ones for conflicting rules.

**Inheritance (extends):**
```toml
# In mycompany/python-internal/ruleset.toml
[meta]
extends = ["community/python-base@1.0.0"]

# Override specific rules
[rules.max-file-length]
max = 300  # Stricter than base
```

---

#### 6.3.6 Ruleset Versioning

- Rulesets use Git tags for versioning (e.g., `v1.0.0`, `v2.1.0`)
- Pinned versions: `@1.0.0` — exact version
- Latest: omit version — always fetches latest (not recommended for production)

**Changelog:**
- `cmc update` shows diffs when rulesets are updated
- Ruleset maintainers should include CHANGELOG.md

---

#### 6.3.7 Ruleset Caching

**Cache Location:** `.cmc/cache/`

**Structure:**
```
.cmc/
├── cache/
│   ├── community/
│   │   └── python-fastapi-prod@1.0.0/
│   │       └── ruleset.toml
│   └── github.com/
│       └── mycompany/
│           └── code-standards/
│               └── python-strict@1.0.0/
│                   └── ruleset.toml
└── state.json
```

**Cache Behaviour:**
- Pinned versions are cached indefinitely
- `cmc update` refreshes cache
- Missing versions are fetched on demand

---

### 6.4 Smart Checking

#### 6.4.1 State Tracking

**State File:** `.cmc/state.json`

**Schema:**
```json
{
  "last_check": "2025-11-30T14:30:00Z",
  "files": {
    "src/main.py": {
      "hash": "abc123...",
      "checked_at": "2025-11-30T14:30:00Z",
      "violations": []
    },
    "src/utils.py": {
      "hash": "def456...",
      "checked_at": "2025-11-30T14:30:00Z",
      "violations": [
        {
          "rule": "max-file-length",
          "line": null,
          "message": "File exceeds 500 lines (current: 523)"
        }
      ]
    }
  },
  "ruleset_versions": {
    "community/python-fastapi-prod": "1.0.0"
  }
}
```

---

#### 6.4.2 Change Detection

On each `cmc check`:

1. Hash each file in scope
2. Compare to cached hashes in `state.json`
3. Skip files with matching hashes
4. Check files with changed/missing hashes
5. Update `state.json` with new results

**Force Full Check:**
```bash
cmc check --all  # Ignores cache, checks everything
```

---

#### 6.4.3 Cache Invalidation

Cache is invalidated when:
- File content changes (hash mismatch)
- Ruleset version changes
- `cmc check --all` is used
- `state.json` is deleted

---

### 6.5 Linter & Formatter Integration

#### 6.5.1 Supported Linters (v1)

| Language | Linter | Detection |
|----------|--------|-----------|
| Python | Ruff | `pyproject.toml`, `ruff.toml`, `.ruff.toml` |
| TypeScript | ESLint | `eslint.config.js`, `.eslintrc.*`, `package.json` |

---

#### 6.5.2 Linter Execution Order

1. `cmc` detects project linter configuration
2. Runs linter with project's existing config
3. Overlays ruleset-specified linter settings (if any)
4. Collects violations
5. Proceeds to script/AI checks

---

#### 6.5.3 Linter Rule Configuration

**In ruleset.toml:**
```toml
[rules.ruff-checks]
type = "linter"
linter = "ruff"
config = { 
  select = ["E", "F", "I", "UP"],
  ignore = ["E501"],
  line-length = 120
}
```

**Behaviour:**
- If project has existing Ruff config, ruleset config is merged (ruleset takes precedence)
- If no project config, ruleset config is used directly

---

#### 6.5.4 Missing Linter Handling

If a ruleset requires a linter that isn't installed:

```
Error: Ruleset 'python-fastapi-prod' requires 'ruff' but it is not installed.
Install with: pip install ruff
```

Check fails entirely (does not skip).

---

### 6.6 AI Agent Integration

#### 6.6.1 Supported Agents (v1)

| Agent | CLI Command | Supported |
|-------|-------------|-----------|
| Claude Code | `claude` | Yes |
| Codex | `codex` | Yes |
| Gemini CLI | `gemini` | Yes |

---

#### 6.6.2 Context Generation

**Command:** `cmc context`

**Purpose:** Generates rules in a format suitable for AI agents.

**Use Cases:**
1. Copy/paste into agent chat
2. Pipe into agent CLI
3. Include in `CLAUDE.md` or equivalent
4. Use via MCP server (future)

**Example Output:**
```markdown
# Coding Standards

You MUST follow these rules when writing or modifying code in this project:

## General Rules
1. Maximum file length: 500 lines
2. All functions must have docstrings
3. No print statements in production code

## Python-Specific Rules
1. Use type hints for all function parameters and return values
2. Follow NumPy docstring format
3. Use snake_case for function and variable names
4. Function names must be descriptive (no single-letter names except for loop variables)

## TypeScript-Specific Rules
1. All exported functions must have JSDoc comments
2. Use explicit return types
3. No `any` types
```

---

#### 6.6.3 AI-Assisted Checks

**Purpose:** Verify subjective rules that cannot be mechanically checked.

**Example Rule:**
```toml
[rules.meaningful-names]
type = "ai"
prompt = "Review these function names and identify any that are not descriptive or meaningful. Output a JSON array of objects with 'name' and 'reason' fields for each problematic name."
extractor = "python scripts/extract_function_names.py"
message = "Function names must be meaningful and descriptive"
```

**Execution Flow:**

1. **Extract:** Run extractor script to get relevant code snippets
   ```bash
   python scripts/extract_function_names.py src/
   ```
   Output:
   ```json
   {"file": "src/main.py", "line": 15, "name": "fn"}
   {"file": "src/main.py", "line": 42, "name": "process_user_data"}
   {"file": "src/utils.py", "line": 8, "name": "x"}
   ```

2. **Prompt:** Send to AI agent
   ```bash
   echo "<extracted_data>\n<prompt>" | claude
   ```

3. **Parse:** Parse agent response for violations
   ```json
   [
     {"name": "fn", "reason": "Non-descriptive, unclear purpose"},
     {"name": "x", "reason": "Single letter, no indication of purpose"}
   ]
   ```

4. **Report:** Map back to file/line and report violations

---

#### 6.6.4 Agent Invocation

`cmc` shells out to agent CLI using user's existing authentication:

```bash
# Claude Code
echo "<prompt>" | claude --print

# Codex
echo "<prompt>" | codex -p

# Gemini
echo "<prompt>" | gemini --prompt
```

**Configuration (`.cmc/agents.yml`):**
```yaml
agents:
  claude:
    command: "claude"
    args: ["--print"]
    input: "stdin"
    
  codex:
    command: "codex"
    args: ["-p"]
    input: "stdin"
    
  gemini:
    command: "gemini"
    args: ["--prompt"]
    input: "stdin"
```

---

#### 6.6.5 Agent Unavailability

If an AI agent is required but unavailable:

```
Error: AI-assisted checks require 'claude' but command not found.
Install Claude Code or configure a different agent in .cmc/profile.local.yml
```

**Behaviour:** Entire check fails (does not skip AI rules).

---

### 6.7 Output & Reporting

#### 6.7.1 CLI Output Format

**Default (minimal):**
```
src/main.py:15 max-file-length
src/main.py:42 require-docstrings
src/utils.py:8 meaningful-names

3 violations found
```

**Verbose (`--verbose`):**
```
Checking 24 files against 3 rulesets...

Running linter checks (ruff)...
Running linter checks (eslint)...
Running AI-assisted checks...

src/main.py:15 max-file-length
  File exceeds 500 lines (current: 523)

src/main.py:42 require-docstrings
  Function 'process_data' missing docstring

src/utils.py:8 meaningful-names
  Function name 'x' is not descriptive

3 violations in 2 files
Checked 24 files in 2.3s
```

---

#### 6.7.2 HTML Report

**Command:** `cmc report --html -o report.html`

**Contents:**
- Summary: total files, violations, by severity
- Violations by file (collapsible sections)
- Violations by rule (grouped view)
- Timestamp and ruleset versions

---

#### 6.7.3 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No violations |
| 1 | Violations found |
| 2 | Configuration error |
| 3 | Runtime error (linter failed, agent unavailable, etc.) |

---

### 6.8 CI/CD Integration

#### 6.8.1 Basic Usage

```yaml
# GitHub Actions example
- name: Check code standards
  run: |
    npm install -g check-my-code
    cmc check
```

---

#### 6.8.2 PR Comments (Future Enhancement)

Not in v1, but designed for:
```yaml
- name: Check code standards
  run: cmc check --format=github-actions
```

Would output annotations visible in PR diff.

---

#### 6.8.3 Non-Blocking Checks

`cmc` reports violations but does not block merges. Teams decide how to handle:

```yaml
# Warning only
- name: Check code standards
  run: cmc check || echo "::warning::Code standards violations found"
  continue-on-error: true

# Blocking
- name: Check code standards
  run: cmc check
```

---

## 7. Technical Specifications

### 7.1 Technology Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript (Node.js) |
| Package Manager | npm |
| CLI Framework | Commander.js or similar |
| Config Parsing | TOML (via `@iarna/toml` or similar) |
| Git Operations | simple-git |
| File Hashing | Node.js crypto (SHA-256) |

---

### 7.2 Directory Structure

```
check-my-code/
├── src/
│   ├── cli/
│   │   ├── index.ts           # CLI entry point
│   │   ├── commands/
│   │   │   ├── check.ts
│   │   │   ├── init.ts
│   │   │   ├── context.ts
│   │   │   ├── diff.ts
│   │   │   ├── report.ts
│   │   │   └── update.ts
│   ├── config/
│   │   ├── loader.ts          # Config discovery and parsing
│   │   ├── schema.ts          # Config validation
│   │   └── defaults.ts
│   ├── rulesets/
│   │   ├── fetcher.ts         # Git-based ruleset fetching
│   │   ├── cache.ts           # Local ruleset cache
│   │   ├── resolver.ts        # Ruleset composition/inheritance
│   │   └── parser.ts          # Ruleset file parsing
│   ├── checks/
│   │   ├── runner.ts          # Main check orchestrator
│   │   ├── simple.ts          # Built-in simple checks
│   │   ├── linter.ts          # Linter integration
│   │   ├── script.ts          # Script-based checks
│   │   └── ai.ts              # AI-assisted checks
│   ├── agents/
│   │   ├── invoker.ts         # Agent CLI invocation
│   │   ├── context.ts         # Context generation
│   │   └── parsers/           # Agent-specific response parsers
│   ├── state/
│   │   ├── tracker.ts         # File hash tracking
│   │   └── cache.ts           # Check result caching
│   ├── output/
│   │   ├── cli.ts             # CLI output formatting
│   │   └── html.ts            # HTML report generation
│   └── utils/
│       ├── git.ts
│       ├── hash.ts
│       └── glob.ts
├── templates/
│   ├── cmc.toml               # Default config template
│   └── report.html            # HTML report template
├── package.json
├── tsconfig.json
└── README.md
```

---

### 7.3 External Dependencies

**Runtime:**
- Node.js >= 18
- Git (for ruleset fetching)

**Linters (user-installed):**
- Ruff (Python)
- ESLint (TypeScript)

**AI Agents (user-installed, optional):**
- Claude Code
- Codex
- Gemini CLI

---

### 7.4 Performance Considerations

- **Parallel linter execution:** Run linters for different languages concurrently
- **File hashing:** Use streaming hash to handle large files
- **Ruleset caching:** Avoid re-fetching pinned versions
- **Incremental checking:** Skip unchanged files (smart checking)

---

## 8. User Workflows

### 8.1 Initial Setup

```bash
# Install globally
npm install -g check-my-code

# In project directory
cmc init --interactive

# Follow prompts to:
# - Select project category
# - Choose languages
# - Select community rulesets
# - Configure AI agent preference
```

---

### 8.2 Daily Development (with AI Agent)

**Before writing code:**
```bash
# Generate context for AI agent
cmc context | pbcopy  # Copy to clipboard

# Or directly inject into Claude Code
cmc context >> CLAUDE.md
```

**After writing code:**
```bash
# Quick check
cmc check

# If violations found, fix and re-check
```

---

### 8.3 Pre-Push Check

```bash
# Full check before pushing
cmc check --all

# Generate report for team review
cmc report --html -o code-review.html
```

---

### 8.4 CI/CD Pipeline

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
          npm install -g eslint
          
      - name: Check code standards
        run: cmc check
        
      - name: Generate report
        if: failure()
        run: cmc report --html -o standards-report.html
        
      - name: Upload report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: standards-report
          path: standards-report.html
```

---

### 8.5 Team Ruleset Updates

```bash
# Check for ruleset updates
cmc update --dry-run

# Apply updates
cmc update

# Review changes in team meeting
# Update pinned versions in cmc.toml if adopting new versions
```

---

## 9. Out of Scope (v1)

The following features are explicitly NOT included in v1:

| Feature | Reason |
|---------|--------|
| Auto-fix code | Delegates to existing pre-commit hooks |
| Severity levels (error/warning/info) | Adds complexity; all violations equal for v1 |
| Historical tracking | Future enhancement |
| Commit message / PR description checks | Focus on code only |
| Branch naming checks | Focus on code only |
| Folder structure checks | Focus on code only |
| Monorepo support | Different architecture needed |
| Languages beyond Python/TypeScript | Limited scope for v1 |
| Linters beyond Ruff/ESLint | Limited scope for v1 |
| MCP server | Future integration method |
| Ruleset authoring documentation | Separate documentation project |
| Community governance | Maintained by author only for v1 |

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **Ruleset** | A versioned collection of rules stored in a Git repository |
| **Rule** | A single code quality check (e.g., "max file length: 500") |
| **Simple check** | A built-in, declarative check executed by `cmc` |
| **Linter check** | A check delegated to an external linter (Ruff, ESLint) |
| **Script check** | A custom check implemented as an executable script |
| **AI check** | A subjective check evaluated by an AI coding agent |
| **Community ruleset** | A publicly available ruleset from the official repository |
| **Private ruleset** | An organisation-specific ruleset hosted in a private Git repo |
| **Smart checking** | Skipping unchanged files based on cached hash comparison |
| **Context** | Rules formatted for consumption by AI coding agents |
| **Agent** | An AI coding tool (Claude Code, Codex, Gemini CLI) |

---

## Appendix A: Configuration Reference

### A.1 cmc.toml (Full Schema)

```toml
# Required: Project metadata
[project]
name = "string"           # Project name (for reporting)
category = "string"       # User-defined: production, prototype, internal, etc.

# Required: Rulesets
[rulesets]
default = ["string"]      # Rulesets applied to all files

# Optional: Language-specific rulesets
[rulesets.<language>]
paths = ["string"]        # Glob patterns for files
rules = ["string"]        # Rulesets for this language

# Optional: AI agent configuration
[agents]
supported = ["string"]    # Agents allowed for this project

# Optional: AI check settings
[ai]
enabled = true            # Enable/disable AI checks globally
```

---

### A.2 ruleset.toml (Full Schema)

```toml
[meta]
name = "string"           # Ruleset identifier
version = "string"        # Semantic version
description = "string"    # Human-readable description
languages = ["string"]    # Applicable languages
extends = ["string"]      # Parent rulesets (optional)

[rules.<rule-id>]
type = "simple|linter|script|ai"
# Type-specific fields...
message = "string"        # Violation message
```

---

### A.3 ~/.cmcconfig (User Config)

```yaml
agent: claude             # Default AI agent
```

---

### A.4 .cmc/profile.local.yml (Local Override)

```yaml
agent: codex              # Override agent for this project
```

---

### A.5 .cmc/agents.yml (Agent Configuration)

```yaml
agents:
  <agent-name>:
    command: "string"     # CLI command
    args: ["string"]      # Default arguments
    input: "stdin"        # How to pass prompt
```

---

*End of Document*
