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
node dist/cli/index.js verify

# Run a single test file
npm test -- tests/unit/config.test.ts

# Generate JSON schema from Zod
npm run generate:schema
```

## E2E Testing

E2E tests use Docker with shared base images for speed. They require Docker to be installed and running.

```bash
# Run all e2e tests (auto-skips if Docker unavailable)
npm run test:run tests/e2e/

# Run specific e2e test file
npm run test:run tests/e2e/check.test.ts

# Run tests matching a pattern
npm run test:run -- -t "private repo"
```

**Base images** (in `tests/e2e/`):

- `Dockerfile.base` - Full image with ESLint, Ruff, git, SSH
- `Dockerfile.base-no-linters` - For testing graceful degradation

Test projects in `tests/e2e/projects/` contain only `cmc.toml` and test files - Dockerfiles are auto-generated from base images.

## Architecture

```
src/
├── cli/
│   ├── index.ts          # CLI entry point (Commander.js)
│   └── commands/
│       ├── check.ts      # Run linters and report violations
│       ├── context.ts    # Append AI context from remote templates
│       ├── generate.ts   # Generate linter configs from cmc.toml
│       └── verify.ts     # Verify linter configs match cmc.toml
├── config/
│   └── loader.ts         # cmc.toml discovery and parsing (Zod validation)
├── remote/
│   └── fetcher.ts        # Git-based remote file fetching for templates
├── linter.ts             # ESLint and Ruff execution
└── types.ts              # TypeScript interfaces and constants
```

**Key flows:**

1. **check**: Finds `cmc.toml` → discovers files → runs ESLint/Ruff → outputs violations
2. **context**: Loads `cmc.toml` → fetches `prompts.json` manifest from remote → resolves template versions → fetches template files → appends to target file
3. **generate**: Loads `cmc.toml` rulesets → generates `eslint.config.js` or `ruff.toml`
4. **verify**: Compares generated config against existing config files

**Remote template system** (`context.ts` + `fetcher.ts`):

- Templates fetched from `github:owner/repo/path@version` format
- Default source: `github:chrismlittle123/check-my-code-community/prompts@latest`
- Manifest-based resolution via `prompts.json` for per-template versioning
- Git clone to `~/.cmc/cache/` with SSH support for private repos

## Configuration

Projects require a `cmc.toml` file:

```toml
[project]
name = "project-name"

# Optional: AI context templates
[ai-context]
templates = ["typescript/5.5", "python/3.12"]

# Optional: ESLint rules
[rulesets.eslint.rules]
"no-console" = "error"

# Optional: Ruff configuration
[rulesets.ruff]
line-length = 100
```

## Exit Codes

- 0: Success (no violations)
- 1: Violations found
- 2: Configuration error (invalid/missing cmc.toml)
- 3: Runtime error (linter failed)
