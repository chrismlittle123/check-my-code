# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Process

**IMPORTANT:** Follow the process defined in `docs/PROCESS.md`. Key rules:

### Branching

- **NEVER commit directly to main** - main branch is protected
- Create a branch for every feature, bugfix, or change
- Branch naming pattern: `(feature|fix|hotfix|docs)/vX.Y.Z/description`
  - `feature/v1.5.0/colored-output` - new features
  - `fix/v1.4.2/audit-bug` - bug fixes
  - `hotfix/v1.4.1/critical-security-fix` - urgent fixes
  - `docs/v1.6.5/update-readme` - documentation changes
- **Enforced by CI** - PRs with invalid branch names will fail

### Before Making Changes

```bash
git checkout main
git pull origin main
git checkout -b feature/v1.5.0/my-feature
```

### Code Quality

- Run `cmc check src/` periodically to verify code follows standards
- Keep PRs small (~200-300 lines changed)
- One feature or fix per PR
- Update `CHANGELOG.md` for any functionality changes

### Releasing (Changesets)

This project uses [Changesets](https://github.com/changesets/changesets) for versioning. **Do NOT manually bump `package.json` version.**

**CRITICAL: Every PR that changes functionality MUST include a changeset file.** Without a changeset, no release will be created when the PR is merged.

**To release a new version:**

1. **ALWAYS create a changeset file** in `.changeset/` describing the change:

   ```bash
   npx changeset
   ```

   Or manually create `.changeset/<name>.md`:

   ```md
   ---
   "check-my-code": patch
   ---

   Description of the change
   ```

   Use `patch` for bug fixes, `minor` for new features, `major` for breaking changes.

2. Merge your PR to main (keep `package.json` version unchanged)

3. The release workflow automatically:
   - Creates a "chore: release" PR (bumps version, updates CHANGELOG)
   - Auto-merges the release PR
   - Publishes to npm and creates git tag

**How it works:**

The release workflow uses changesets action with `publish` option. When you merge a PR with a changeset:

1. Workflow detects changesets → Creates "chore: release" PR → Auto-merges it
2. Auto-merge triggers another workflow run → No changesets found → Publishes to npm

Everything is automatic after merging your feature PR. No manual intervention needed.

**Common mistakes:**

- Do NOT bump `package.json` version AND add a changeset. This causes a double version bump.
- Do NOT forget to include a changeset file. **If you merge a PR without a changeset, no release will be created.** You will need to create a follow-up PR with just the changeset to trigger a release.

### Before Pushing

Pre-push hooks run automatically, but you can verify manually:

```bash
npm run typecheck
npm run lint
npm run build
cmc check src/
npm run test:run
```

## Project Overview

check-my-code (`cmc`) is a CLI tool that runs ESLint, Ruff, and TypeScript type checking on code. It provides a unified way to enforce coding standards and type safety across TypeScript/JavaScript and Python files without per-repository configuration overhead.

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
node dist/cli/index.js audit
node dist/cli/index.js validate
node dist/cli/index.js registry validate
node dist/cli/index.js mcp-server
node dist/cli/index.js info              # Show supported languages/tools
node dist/cli/index.js info --json       # JSON output

# Run a single test file
npm test -- tests/unit/config.test.ts

# Generate JSON schema from Zod
npm run generate:schema
```

## E2E Testing

Most E2E tests run directly using the `run()` helper from `runner.ts`, which executes the CLI in test project directories. Some tests (like `audit.ts`) use Docker for isolated environments.

```bash
# Run all e2e tests
npm run test:run tests/e2e/

# Run specific e2e test file
npm run test:run tests/e2e/check.test.ts

# Run tests matching a pattern
npm run test:run -- -t "type error"
```

Test projects in `tests/e2e/projects/` contain `cmc.toml` and test files organized by command (check, audit, generate, etc.).

## Architecture

```
src/
├── cli/
│   ├── index.ts          # CLI entry point (Commander.js)
│   └── commands/
│       ├── check.ts      # Run linters and report violations
│       ├── context.ts    # Append AI context from remote templates
│       ├── generate.ts   # Generate linter configs from cmc.toml
│       ├── audit.ts      # Audit linter configs match cmc.toml
│       ├── validate.ts   # Validate cmc.toml against JSON schema
│       ├── registry.ts   # Manage prompts/rulesets registries
│       └── mcp-server.ts # Start MCP server for AI agents
├── config/
│   └── loader.ts         # cmc.toml discovery and parsing (Zod validation)
├── mcp/
│   ├── server.ts         # MCP server setup (stdio transport)
│   ├── tools.ts          # MCP tool definitions and handlers
│   └── state.ts          # Session state management
├── remote/
│   └── fetcher.ts        # Git-based remote file fetching for templates
├── linter.ts             # ESLint, Ruff, and tsc execution
└── types.ts              # TypeScript interfaces and constants
```

**Key flows:**

1. **check**: Finds `cmc.toml` → discovers files → runs ESLint/Ruff/tsc → outputs violations
2. **context**: Loads `cmc.toml` → fetches `prompts.json` manifest from remote → resolves template versions → fetches template files → appends to target file
3. **generate**: Loads `cmc.toml` rulesets → generates `eslint.config.js`, `ruff.toml`, or `tsconfig.json`
4. **audit**: Compares generated config against existing config files (eslint, ruff, tsc)
5. **validate**: Validates cmc.toml against JSON schema using Ajv
6. **registry**: Manages prompts/rulesets registries (validate, list, check, sync, bump)
7. **mcp-server**: Starts MCP server exposing linting tools to AI agents

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

# Optional: AI context templates (format: <tier>/<language>/<version>)
# Available tiers: prototype, internal, production
[prompts]
templates = ["internal/typescript/5.5", "internal/python/3.12"]

# Optional: ESLint rules
[rulesets.eslint.rules]
"no-console" = "error"

# Optional: TypeScript type checking
[rulesets.tsc]
strict = true
noUncheckedIndexedAccess = true

# Optional: Ruff configuration
[rulesets.ruff]
line-length = 100

# Optional: Inherit rulesets from remote (schema only - runtime not implemented yet)
[extends]
eslint = "github:owner/repo/rulesets/path@version"
tsc = "github:owner/repo/rulesets/path@version"
```

### TypeScript Type Checking

When `[rulesets.tsc]` is configured:

- `cmc check` runs `tsc --noEmit` using the project's `tsconfig.json`
- `cmc audit tsc` verifies `tsconfig.json` has the required settings
- `cmc generate tsc` generates `tsconfig.json` from cmc.toml settings

The `[rulesets.tsc]` section defines what settings your `tsconfig.json` **must have**:

```toml
[rulesets.tsc]
strict = true
noUncheckedIndexedAccess = true
```

This is the same pattern as ESLint/Ruff - cmc.toml is the source of truth, and the actual config file (`tsconfig.json`) is audited/generated from it.

## Exit Codes

- 0: Success (no violations)
- 1: Violations found
- 2: Configuration error (invalid/missing cmc.toml)
- 3: Runtime error (linter failed)

## MCP Server

The `mcp-server` command starts an MCP (Model Context Protocol) server that exposes linting functionality to AI agents.

**Setup for Claude Code:**

```bash
claude mcp add cmc -- npx -y check-my-code mcp-server
```

**Setup for Cursor/Claude Desktop** (add to MCP config):

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

**Available MCP tools:**

- `check_files` - Lint specific files
- `check_project` - Lint entire project or subdirectory
- `fix_files` - Auto-fix violations using ESLint --fix / Ruff --fix
- `get_guidelines` - Fetch coding standards templates
- `get_status` - Get session state and statistics
- `suggest_config` - Generate cmc.toml from project description
- `validate_config` - Validate TOML against cmc.toml schema

## Related Documentation

| Document             | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `docs/PROCESS.md`    | Full development workflow                                  |
| `docs/ROADMAP.md`    | Feature planning and tracking                              |
| `docs/STANDARDS.md`  | Coding standards                                           |
| `CHANGELOG.md`       | Version history                                            |
| `compatibility.yaml` | Supported languages/tools (source of truth for `cmc info`) |

<!-- cmc:context:start:510bdadf27b5 -->

## TypeScript 5.5 Coding Standards - INTERNAL

Standards for internal tools, services, and team-facing applications.

### Target Version

- Target TypeScript 5.5 specifically.
- Target Node.js 20 runtime.
- Use TypeScript 5.5 features where appropriate.

### Variable Declarations

- NEVER use `var`. Always use `const` for values that won't be reassigned, or `let` when reassignment is necessary.
- Prefer `const` over `let` whenever possible.

### Type Safety

- Avoid `any` type. Use `unknown` if the type is truly unknown, then narrow it with type guards.
- Provide explicit return types for public functions.
- Use strict null checks - handle `null` and `undefined` explicitly.

### TypeScript 5.5 Features

- Use inferred type predicates for cleaner type narrowing.
- Use `const` type parameters where appropriate.
- Use `satisfies` operator for type validation without widening.
- Use `import type` and `export type` for type-only imports/exports.

### Equality

- ALWAYS use strict equality (`===` and `!==`). Never use loose equality.

### Error Handling

- Handle errors explicitly. Never swallow errors silently.
- Prefer `unknown` over `any` in catch clauses.

### Imports

- Use ES module imports (`import`/`export`), not CommonJS.
- Sort imports: external dependencies first, then internal modules.
- Use `import type` for type-only imports.

### Node.js 20

- Use native fetch API (no need for node-fetch).
- Use ES modules (`"type": "module"` in package.json).

<!-- cmc:context:end -->
