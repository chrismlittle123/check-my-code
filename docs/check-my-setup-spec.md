# check-my-setup (cms) - Product Specification

**Version:** 1.0
**Date:** December 2025
**Status:** Draft

---

## Executive Summary

`check-my-setup` (`cms`) is a CLI tool that verifies a developer's local environment is correctly configured to work on a project. It complements `check-my-code` (`cmc`) which verifies the codebase itself.

| Tool  | Purpose                | Runs in CI? | Checks                                        |
| ----- | ---------------------- | ----------- | --------------------------------------------- |
| `cmc` | Verify the codebase    | Yes         | Code quality, repo files, linter configs      |
| `cms` | Verify the environment | No          | Local tools, versions, MCP servers, IDE setup |

---

## Problem Statement

Development teams need to ensure all developers have:

- Correct tool versions installed (Node 20+, Python 3.12+)
- Required CLI tools available (docker, gh, aws)
- MCP servers configured for AI-assisted development
- IDE extensions installed for consistent development experience

Currently, this is handled via README checklists that developers forget to follow, leading to "works on my machine" issues and inconsistent AI tooling across the team.

---

## Core Principles

1. **Local-only** - Never runs in CI; it's about the developer's machine
2. **Non-blocking** - Reports issues but doesn't prevent work
3. **Fast** - Quick checks, no network calls except for update checks
4. **Cross-platform** - Works on macOS, Linux, Windows
5. **Shared config** - Reads `[setup]` section from `cmc.toml` (no separate config file)

---

## Configuration

`cms` reads from the `[setup]` section in `cmc.toml`. No separate config file needed - one file for both tools.

```toml
[project]
name = "my-project"

# ─────────────────────────────────────────────────────────
# cmc config (code quality, CI-checkable)
# ─────────────────────────────────────────────────────────

[requirements]
files = ["CLAUDE.md", "CHANGELOG.md"]
tools = ["gitleaks", "knip"]

[rulesets.eslint.rules]
"no-console" = "error"

[rulesets.tsc]
strict = true

# ─────────────────────────────────────────────────────────
# cms config (local environment, not CI-checkable)
# ─────────────────────────────────────────────────────────

# Tool version requirements
[setup.versions]
node = ">=20"
python = ">=3.12"
npm = ">=10"
docker = "*"          # Any version
gh = ">=2.0"

# CLI tools that must be available in PATH
[setup.cli]
tools = ["docker", "gh", "aws", "terraform"]

# MCP server requirements
[setup.mcp]
servers = ["cmc", "context7", "supabase"]
platforms = ["claude", "cursor"]  # Optional: defaults to all detected

# VS Code extension requirements
[setup.vscode]
extensions = [
  "dbaeumer.vscode-eslint",
  "ms-python.python",
  "anthropic.claude-code",
  "esbenp.prettier-vscode"
]

# Optional: Cursor extensions (if different from VS Code)
[setup.cursor]
extensions = [
  "dbaeumer.vscode-eslint"
]

# Claude Code settings (local .claude/settings.json)
[setup.claude]
extends = "github:company/standards/claude-settings@v1"

# AI context templates (generates CLAUDE.md, .cursorrules, etc.)
[setup.context]
templates = ["internal/typescript/5.5", "internal/python/3.12"]
source = "github:company/prompts@v1"  # Optional: defaults to community repo
```

**Why one file:**

- No "death by toml" - single source of truth
- `cmc` ignores `[setup]`, `cms` only reads `[setup]`
- Clear separation within the file
- Both tools share `[project.name]`

---

## CLI Commands

### Main Command

```bash
cms                    # Run all checks
cms check              # Alias for above
```

### Category-Specific Checks

```bash
cms versions           # Check tool versions only
cms cli                # Check CLI tool availability only
cms mcp                # Check MCP server configuration only
cms vscode             # Check VS Code extensions only
cms cursor             # Check Cursor extensions only
cms claude             # Check Claude Code settings
cms context            # Generate AI context files (CLAUDE.md, etc.)
```

### Options

```bash
cms --json             # JSON output for tooling integration
cms --quiet            # Exit code only, no output
cms --fix              # Attempt to fix issues (future)
cms --config <path>    # Specify config file path
```

### Utility Commands

```bash
cms init               # Create cms.toml interactively
cms doctor             # Detailed diagnostic report
```

---

## Feature Specifications

### 1. Version Checking (`[versions]`)

**Purpose:** Verify installed tool versions meet project requirements.

**Supported Tools:**

- `node` - Node.js runtime
- `npm` - Node package manager
- `python` - Python interpreter (checks `python3`)
- `pip` - Python package manager
- `docker` - Container runtime
- `gh` - GitHub CLI
- `git` - Git version control
- `aws` - AWS CLI
- `terraform` - Infrastructure as code
- `kubectl` - Kubernetes CLI
- Extensible for additional tools

**Version Syntax:**

- `">=20"` - Minimum version
- `"^3.12"` - Compatible with (semver)
- `"~20.10"` - Approximately equivalent
- `"*"` - Any version (just check presence)
- `"20.11.0"` - Exact version

**Implementation:**

```bash
# How versions are detected
node --version          # v20.11.0 -> 20.11.0
python3 --version       # Python 3.12.1 -> 3.12.1
docker --version        # Docker version 24.0.7 -> 24.0.7
```

**Output:**

```
Versions:
  ✓ node: 20.11.0 (required >=20)
  ✓ python: 3.12.1 (required >=3.12)
  ✗ npm: 9.8.1 (required >=10)
```

---

### 2. CLI Tool Availability (`[cli]`)

**Purpose:** Verify required CLI tools are installed and available in PATH.

**Implementation:**

- Use `which <tool>` on Unix, `where <tool>` on Windows
- Report path if found, error if not

**Output:**

```
CLI Tools:
  ✓ docker: /usr/local/bin/docker
  ✓ gh: /opt/homebrew/bin/gh
  ✗ aws: not found
```

---

### 3. MCP Server Configuration (`[mcp]`)

**Purpose:** Verify MCP servers are configured for AI coding assistants.

**Supported Platforms:**

| Platform    | Config Location                                               |
| ----------- | ------------------------------------------------------------- |
| Claude Code | `~/.claude.json` → `projects[cwd].mcpServers` or `mcpServers` |
| Cursor      | `~/.cursor/mcp.json` or `.cursor/mcp.json`                    |
| Windsurf    | TBD                                                           |
| Continue    | `~/.continue/config.json`                                     |

**Claude Code Config Structure:**

```json
{
  "projects": {
    "/path/to/project": {
      "mcpServers": {
        "cmc": {
          "command": "npx",
          "args": ["-y", "check-my-code", "mcp-server"]
        },
        "context7": {
          "command": "npx",
          "args": ["-y", "@context7/mcp"]
        }
      }
    }
  }
}
```

**Cursor Config Structure:**

```json
{
  "mcpServers": {
    "cmc": {
      "command": "npx",
      "args": ["-y", "check-my-code", "mcp-server"]
    }
  }
}
```

**Behavior:**

- Check each specified platform (or auto-detect available ones)
- Look for server by name in mcpServers object
- Report which servers are missing on which platforms

**Output:**

```
MCP Servers:
  Claude Code (~/.claude.json):
    ✓ cmc: configured
    ✓ context7: configured
  Cursor (~/.cursor/mcp.json):
    ✓ cmc: configured
    ✗ context7: not configured
```

---

### 4. VS Code Extensions (`[vscode]`)

**Purpose:** Verify required VS Code extensions are installed.

**Implementation:**

```bash
code --list-extensions
```

**Fallback:** Read `~/.vscode/extensions/extensions.json` if CLI unavailable.

**Output:**

```
VS Code Extensions:
  ✓ dbaeumer.vscode-eslint
  ✓ ms-python.python
  ✗ anthropic.claude-code
  ✗ esbenp.prettier-vscode
```

**Graceful Degradation:**

- If VS Code CLI not available, warn and skip
- If extensions directory not found, warn and skip

---

### 5. Cursor Extensions (`[cursor]`)

**Purpose:** Verify Cursor-specific extensions (if different from VS Code).

**Implementation:** Similar to VS Code, using Cursor's extension directory.

---

## Output Formats

### Text Output (Default)

```
check-my-setup v1.0.0

Versions:
  ✓ node: 20.11.0 (required >=20)
  ✓ python: 3.12.1 (required >=3.12)
  ✗ npm: 9.8.1 (required >=10)

CLI Tools:
  ✓ docker: /usr/local/bin/docker
  ✓ gh: /opt/homebrew/bin/gh
  ✗ aws: not found

MCP Servers:
  Claude Code:
    ✓ cmc
    ✗ context7
  Cursor:
    ✓ cmc
    ✓ context7

VS Code Extensions:
  ✓ dbaeumer.vscode-eslint
  ✗ anthropic.claude-code

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3 issues found

To fix:
  • npm: Run `npm install -g npm@latest`
  • aws: Run `brew install awscli` or visit https://aws.amazon.com/cli/
  • context7 (Claude): Add to ~/.claude.json
  • anthropic.claude-code: Run `code --install-extension anthropic.claude-code`
```

### JSON Output (`--json`)

```json
{
  "version": "1.0.0",
  "passed": false,
  "summary": {
    "total": 12,
    "passed": 9,
    "failed": 3
  },
  "versions": {
    "passed": false,
    "checks": [
      {
        "tool": "node",
        "required": ">=20",
        "actual": "20.11.0",
        "satisfied": true
      },
      {
        "tool": "python",
        "required": ">=3.12",
        "actual": "3.12.1",
        "satisfied": true
      },
      {
        "tool": "npm",
        "required": ">=10",
        "actual": "9.8.1",
        "satisfied": false
      }
    ]
  },
  "cli": {
    "passed": false,
    "checks": [
      { "tool": "docker", "installed": true, "path": "/usr/local/bin/docker" },
      { "tool": "gh", "installed": true, "path": "/opt/homebrew/bin/gh" },
      { "tool": "aws", "installed": false, "path": null }
    ]
  },
  "mcp": {
    "passed": false,
    "platforms": [
      {
        "name": "claude",
        "configPath": "~/.claude.json",
        "configExists": true,
        "servers": [
          { "name": "cmc", "configured": true },
          { "name": "context7", "configured": false }
        ]
      },
      {
        "name": "cursor",
        "configPath": "~/.cursor/mcp.json",
        "configExists": true,
        "servers": [
          { "name": "cmc", "configured": true },
          { "name": "context7", "configured": true }
        ]
      }
    ]
  },
  "vscode": {
    "passed": false,
    "available": true,
    "extensions": [
      { "id": "dbaeumer.vscode-eslint", "installed": true },
      { "id": "anthropic.claude-code", "installed": false }
    ]
  }
}
```

---

## Exit Codes

| Code | Meaning                                |
| ---- | -------------------------------------- |
| 0    | All checks passed                      |
| 1    | One or more checks failed              |
| 2    | Configuration error (invalid cms.toml) |

---

### 6. Claude Code Settings (`[claude]`)

**Purpose:** Verify and generate `.claude/settings.json` from remote templates.

**Why in cms, not cmc:**

- `.claude/settings.json` is typically gitignored (local IDE config)
- It's about configuring the developer's local Claude Code environment
- Different developers may have different permission levels

**Configuration:**

```toml
[claude]
extends = "github:company/standards/claude-settings@v1"
```

**Remote Settings Template:**

```json
{
  "$schema": "https://json.schemastore.org/claude-settings.json",
  "permissions": {
    "allow": [
      "Bash(npm run build:*)",
      "Bash(npm run test:*)",
      "WebFetch(domain:docs.company.com)"
    ],
    "deny": ["Bash(rm -rf *)", "Bash(*--force*)"]
  }
}
```

**Commands:**

```bash
cms claude              # Audit: verify settings match remote
cms claude --generate   # Generate .claude/settings.json from remote
cms claude --diff       # Show differences between local and remote
```

**Output:**

```
Claude Code Settings:
  Remote: github:company/standards/claude-settings@v1
  Local: .claude/settings.json

  ✗ Settings do not match remote template

  Missing permissions.allow:
    + Bash(npm run test:*)

  Extra permissions.allow:
    - Bash(rm -rf *)

  Run `cms claude --generate` to update
```

**Behavior:**

- Fetches remote template via git (same as cmc's remote fetching)
- Compares with local `.claude/settings.json`
- Reports differences
- Can generate/overwrite with `--generate`

---

### 7. AI Context Templates (`[setup.context]`)

**Purpose:** Generate AI coding instructions for CLAUDE.md, .cursorrules, etc.

**Note:** This feature migrates from `cmc context` to `cms context`. While the output files are committed to the repo, the feature is fundamentally about setting up AI development tooling, which fits `cms`'s domain.

**Configuration:**

```toml
[setup.context]
templates = ["internal/typescript/5.5", "internal/python/3.12"]
source = "github:company/prompts@v1"  # Optional: defaults to community repo
```

**Template Format:**
Templates are tier/language/version combinations:

- Tiers: `prototype`, `internal`, `production`
- Languages: `typescript`, `python`
- Example: `internal/typescript/5.5`

**Commands:**

```bash
cms context                      # Generate for all configured targets
cms context --target claude      # Generate CLAUDE.md only
cms context --target cursor      # Generate .cursorrules only
cms context --target copilot     # Generate .github/copilot-instructions.md
cms context --stdout             # Output to stdout instead of file
```

**Output Files:**
| Target | File |
|--------|------|
| claude | `CLAUDE.md` |
| cursor | `.cursorrules` |
| copilot | `.github/copilot-instructions.md` |

**Behavior:**

1. Fetches `prompts.json` manifest from source repository
2. Resolves template versions from manifest
3. Fetches template content
4. Appends to target file with markers:
   ```markdown
   <!-- cms:context:start:hash -->

   ## TypeScript 5.5 Coding Standards - INTERNAL

   ...

   <!-- cms:context:end -->
   ```
5. Re-running updates content between markers

**Output:**

```
AI Context:
  Templates: internal/typescript/5.5, internal/python/3.12
  Source: github:company/prompts@v1

  ✓ CLAUDE.md updated (2 templates applied)
```

---

## Future Features (v2+)

### Auto-Fix (`--fix`)

```bash
cms --fix              # Attempt to fix all issues
cms mcp --fix          # Fix MCP configuration only
```

Potential fixes:

- Install missing npm packages globally
- Add MCP server configs to Claude/Cursor
- Install VS Code extensions via CLI
- Provide copy-paste commands for manual fixes

### Remote Templates

```toml
[extends]
source = "github:company/standards/setup@v1"
```

Inherit setup requirements from a central repository.

### Team Dashboard

Integration with a web service to track team setup compliance.

### Shell Completions

```bash
cms completion bash > /etc/bash_completion.d/cms
cms completion zsh > ~/.zfunc/_cms
```

### Init Wizard

```bash
cms init
# Interactive prompts to detect and configure requirements
```

---

## Technical Requirements

### Runtime

- Node.js 20+
- Single binary distribution (pkg or similar) for non-Node users

### Dependencies

- `semver` - Version comparison
- `commander` - CLI framework
- Minimal dependencies to keep it fast

### Platform Support

- macOS (primary)
- Linux
- Windows (WSL and native)

---

## Relationship to check-my-code

| Aspect         | check-my-code (`cmc`)    | check-my-setup (`cms`)          |
| -------------- | ------------------------ | ------------------------------- |
| Config file    | `cmc.toml`               | `[setup]` section in `cmc.toml` |
| What it checks | Code quality, repo files | Local environment, AI tooling   |
| Runs in CI     | Yes                      | No                              |
| Deterministic  | Yes                      | No (varies by machine)          |
| Blocks PRs     | Can                      | Should not                      |
| npm package    | `check-my-code`          | `check-my-setup`                |
| Binary name    | `cmc`                    | `cms`                           |

### Feature Ownership

| Feature                               | Owner | Reason                          |
| ------------------------------------- | ----- | ------------------------------- |
| ESLint/Ruff/tsc checking              | `cmc` | Code quality                    |
| Code limits (line length, etc.)       | `cmc` | Code quality                    |
| Required files exist                  | `cmc` | Repo-level, CI-checkable        |
| Required tools configured             | `cmc` | Repo-level (config files exist) |
| Config generation (eslint, ruff, tsc) | `cmc` | Repo-level config files         |
| Tool versions installed               | `cms` | Local environment               |
| CLI tools available                   | `cms` | Local environment               |
| MCP servers configured                | `cms` | Local environment               |
| VS Code/Cursor extensions             | `cms` | Local environment               |
| Claude Code settings                  | `cms` | Local IDE config                |
| AI context templates                  | `cms` | AI tooling setup                |

### Migration from cmc

These features move from `cmc` to `cms`:

- `cmc context` → `cms context`
- `cmc generate claude` → `cms claude --generate`
- `cmc audit claude` → `cms claude`
- `[prompts]` config → `[setup.context]`
- `[ai.claude]` config → `[setup.claude]`

### Usage Together

A project typically uses both:

```bash
# In CI (GitHub Actions)
cmc check src/           # Lint, type-check, verify requirements

# Locally (developer machine)
cms                      # Verify environment is set up correctly
cms context              # Generate AI instructions
```

---

## Open Questions

1. **MCP platform priority:** Which platforms to support first? (Claude Code, Cursor, Windsurf, Continue)
2. **Fix behavior:** How aggressive should `--fix` be?
3. **Monorepo vs separate repo:** Should `cms` live in the same repo as `cmc` or separate?
4. **Shared code:** How much code should be shared between `cmc` and `cms`? (remote fetching, TOML parsing, output formatting)

---

## Appendix: MCP Server Config Examples

### Adding cmc to Claude Code

```bash
claude mcp add cmc -- npx -y check-my-code mcp-server
```

### Adding context7 to Claude Code

```bash
claude mcp add context7 -- npx -y @context7/mcp
```

### Manual Claude Code Config

Edit `~/.claude.json`:

```json
{
  "mcpServers": {
    "cmc": {
      "command": "npx",
      "args": ["-y", "check-my-code", "mcp-server"]
    }
  }
}
```

### Manual Cursor Config

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cmc": {
      "command": "npx",
      "args": ["-y", "check-my-code", "mcp-server"]
    }
  }
}
```
