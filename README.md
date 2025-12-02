# check-my-code (cmc)

A CLI tool that runs ESLint and Ruff linters on your code with a unified interface.

## Features

- **Unified linting**: Run ESLint (TypeScript/JavaScript) and Ruff (Python) with a single command
- **Configuration management**: Generate and verify linter configs from a central `cmc.toml`
- **AI context**: Export coding standards for AI coding agents (Claude, Cursor, Copilot)
- **Graceful degradation**: Works with whatever linters you have installed

## Installation

```bash
npm install -g check-my-code
```

Requires Node.js >= 18.

## Quick Start

1. Create a `cmc.toml` in your project root:

```toml
[project]
name = "my-project"
```

2. Run the linter:

```bash
cmc check
```

## Commands

### `cmc check`

Run linters on project files and report violations.

```bash
cmc check                     # Check entire project
cmc check src/                # Check specific directory
cmc check src/main.ts         # Check specific file
cmc check --json              # Output as JSON
```

### `cmc generate`

Generate linter config files from `cmc.toml` ruleset.

```bash
cmc generate eslint           # Generate eslint.config.js
cmc generate ruff             # Generate ruff.toml
cmc generate eslint --force   # Overwrite existing config
cmc generate eslint --stdout  # Output to stdout
```

### `cmc verify`

Check that linter configs match the ruleset defined in `cmc.toml`.

```bash
cmc verify                    # Verify all linter configs
cmc verify eslint             # Verify only ESLint config
cmc verify ruff               # Verify only Ruff config
```

### `cmc context`

Append coding standards context to AI agent configuration files.

```bash
cmc context --target claude   # Appends to CLAUDE.md
cmc context --target cursor   # Appends to .cursorrules
cmc context --target copilot  # Appends to .github/copilot-instructions.md
cmc context --stdout          # Output to stdout
```

## Configuration

### Basic `cmc.toml`

```toml
[project]
name = "my-project"
```

### With Custom Rules

```toml
[project]
name = "my-project"

# ESLint rules
[rulesets.eslint.rules]
"no-console" = "error"
"@typescript-eslint/no-explicit-any" = "error"

# Ruff configuration
[rulesets.ruff]
line-length = 100

[rulesets.ruff.lint]
select = ["E", "F", "I", "UP"]
```

### With AI Context

```toml
[project]
name = "my-project"

[prompts]
templates = ["typescript/5.5", "python/3.12"]
```

## AI Context Templates

The `cmc context` command fetches templates from the [check-my-code-community](https://github.com/chrismlittle123/check-my-code-community) repository.

**Available templates:**

| Template         | Description                                  |
| ---------------- | -------------------------------------------- |
| `typescript/5.5` | TypeScript 5.5 coding standards (Node.js 20) |
| `python/3.12`    | Python 3.12 coding standards                 |

Use them in your `cmc.toml`:

```toml
[prompts]
templates = ["typescript/5.5", "python/3.12"]
```

You can pin a specific version:

```toml
[prompts]
templates = ["typescript/5.5@1.0.0"]
```

You can also use a custom source repository:

```toml
[prompts]
templates = ["my-template"]
source = "github:myorg/my-templates/prompts@v1.0.0"
```

## Exit Codes

| Code | Meaning                 |
| ---- | ----------------------- |
| 0    | Success (no violations) |
| 1    | Violations found        |
| 2    | Configuration error     |
| 3    | Runtime error           |

## Supported File Types

| Extensions                                   | Linter |
| -------------------------------------------- | ------ |
| `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` | ESLint |
| `.py`, `.pyi`                                | Ruff   |

## Requirements

- Node.js >= 18
- ESLint (for TypeScript/JavaScript linting)
- Ruff (for Python linting)

Linters are optional - cmc gracefully skips files if the corresponding linter isn't installed.

## Troubleshooting

### ESLint not found

```
Skipping ESLint: not installed
```

Install ESLint in your project:

```bash
npm install eslint @eslint/js typescript-eslint --save-dev
```

Or globally:

```bash
npm install -g eslint
```

### Ruff not found

```
Skipping Ruff: not installed
```

Install Ruff:

```bash
# macOS
brew install ruff

# pip
pip install ruff

# pipx
pipx install ruff
```

### No cmc.toml found

```
Error: No cmc.toml found
```

Create a `cmc.toml` file in your project root:

```toml
[project]
name = "my-project"
```

### Template not found

```
Error: Template "my-template" not found
```

Check that the template name matches one of the [available templates](#prompts-templates), or verify your custom source repository contains the template file.

### Git not available (for remote templates)

```
Error: git is not installed or not in PATH
```

The `cmc context` command uses git to fetch remote templates. Install git:

```bash
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt install git

# Windows
winget install Git.Git
```

## License

MIT
