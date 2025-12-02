# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

check-my-code (`cmc`) is a CLI tool that runs ESLint and Ruff linters on code. It provides a unified way to enforce coding standards across TypeScript/JavaScript and Python files without per-repository configuration overhead.

## Commands

```bash
# Build TypeScript
npm run build

# Run tests (watch mode)
npm test

# Run tests once
npm run test:run

# Type checking
npm run typecheck

# Lint
npm run lint
npm run lint:fix

# Format
npm run format

# Run the CLI locally
node dist/cli/index.js check [path]
node dist/cli/index.js context --target claude
node dist/cli/index.js generate eslint

# Run a single test file
npm test -- tests/unit/config.test.ts
```

## E2E Testing

E2E tests use Docker to create isolated environments with/without linters. They require Docker to be installed and running.

```bash
# Run e2e tests (auto-skips if Docker unavailable)
npm test tests/e2e/check.test.ts
```

Test projects in `tests/e2e/projects/` each have a Dockerfile that builds an isolated environment. Tests verify:

- TypeScript-only projects (ESLint)
- Python-only projects (Ruff)
- Mixed-language projects (both linters)
- Graceful degradation when linters are missing

## Architecture

```
src/
├── cli/
│   ├── index.ts          # CLI entry point (Commander.js)
│   └── commands/
│       ├── check.ts      # Main check command
│       ├── context.ts    # Append AI context from templates
│       └── generate.ts   # Generate linter configs from cmc.toml
├── config/
│   └── loader.ts         # cmc.toml discovery and parsing
├── linter.ts             # ESLint and Ruff execution
└── types.ts              # TypeScript interfaces

community-assets/
└── ai-contexts/          # AI context templates (typescript-strict.md, python-prod.md)
```

**Key flow:**

1. `check.ts` finds project root by locating `cmc.toml`
2. Discovers files matching `*.ts,tsx,js,jsx,mjs,cjs,py,pyi`
3. `linter.ts` runs ESLint for JS/TS files and Ruff for Python files
4. Violations are collected and output (text or JSON)

**Linter integration (`linter.ts`):**

- Checks if linters exist before running (graceful skip if missing)
- Uses local `node_modules/.bin/eslint` if available, falls back to global
- Parses JSON output from both linters into a unified `Violation` format

## Configuration

Projects require a `cmc.toml` file:

```toml
[project]
name = "project-name"
```

## Exit Codes

- 0: Success (no violations)
- 1: Violations found
- 2: Configuration error (invalid/missing cmc.toml)
- 3: Runtime error (linter failed)
