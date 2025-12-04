# Standards-as-Code Suite

> Define once, enforce everywhere.

## The Idea

A toolkit that lets engineering teams define their standards in a **machine-readable format** (TOML), then **enforce compliance** across repositories.

Teams can share standards like code — import another team's standards file and your repo is instantly held to the same bar.

```
┌─────────────────────────────────────────────────────────────┐
│  STANDARDS-AS-CODE (SOURCE OF TRUTH)                        │
│  TOML files — portable, shareable, versionable              │
│                                                             │
│  • code.toml     — how code should be written               │
│  • process.toml  — how work should flow                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ enforces against
┌─────────────────────────────────────────────────────────────┐
│  EXISTING CONFIGS + SYSTEMS                                 │
│                                                             │
│  • ruff.toml, .eslintrc — do they match standards?          │
│  • GitHub branch protection — is it configured correctly?   │
│  • CI workflows — do required checks exist?                 │
│  • PR settings — are reviewer requirements met?             │
└─────────────────────────────────────────────────────────────┘
```

---

## The Two Domains

| Domain      | Core Question              | What It Governs                                      |
| ----------- | -------------------------- | ---------------------------------------------------- |
| **Code**    | Is the artifact correct?   | Linting, formatting, testing, dependencies, security |
| **Process** | Did we build it correctly? | Git, PRs, branching, CI/CD, releases                 |

---

## Structure

```
.standards/
│
├── config.toml              # Inheritance, overrides, metadata
│
├── code/
│   ├── linting.toml         # Linter rules, complexity limits
│   ├── formatting.toml      # Formatter settings
│   ├── testing.toml         # Coverage thresholds, test structure
│   ├── dependencies.toml    # Lockfiles, security scanning
│   └── security.toml        # SAST, secrets, container scanning
│
└── process/
    ├── git.toml             # Commit format, branch naming
    ├── pr.toml              # Size limits, reviewers, ticket linking
    └── cicd.toml            # Required stages, checks, gates
```

---

## What Gets Checked

### Code Domain

| Area             | What the Standard Defines                      | What the Enforcer Checks                |
| ---------------- | ---------------------------------------------- | --------------------------------------- |
| **Linting**      | Max complexity, required rules, banned ignores | ruff.toml, .eslintrc match requirements |
| **Formatting**   | Line length, formatter choice                  | Config exists and matches               |
| **Testing**      | Min coverage, CI gate required                 | pytest/jest config, coverage in CI      |
| **Dependencies** | Lockfile required, scanner enabled             | File exists, dependabot.yml or similar  |
| **Security**     | Secret scanning, SAST tool                     | Pre-commit config, CI workflow          |

### Process Domain

| Area      | What the Standard Defines                | What the Enforcer Checks                |
| --------- | ---------------------------------------- | --------------------------------------- |
| **Git**   | Commit format, branch naming pattern     | Git history, branch protection (API)    |
| **PRs**   | Max size, min reviewers, ticket required | GitHub API, CODEOWNERS exists           |
| **CI/CD** | Required jobs, status checks             | Workflow files, branch protection (API) |

---

## Supported Tools (v1)

| Area         | Python               | JavaScript                   |
| ------------ | -------------------- | ---------------------------- |
| Linting      | Ruff                 | ESLint                       |
| Formatting   | Ruff                 | Prettier                     |
| Testing      | pytest + coverage    | Jest                         |
| Dependencies | poetry.lock, uv.lock | package-lock.json, yarn.lock |
| Git/CI       | GitHub               | GitHub                       |

---

## Example Standards

### code/linting.toml

```toml
[python]
tool = "ruff"
config_files = ["ruff.toml", "pyproject.toml"]

[python.rules]
max_complexity = { max = 10 }
required_rule_sets = ["E", "F", "I"]
banned_global_ignores = ["E501"]

[javascript]
tool = "eslint"
config_files = [".eslintrc*", "eslint.config.*"]

[javascript.rules]
no_console = "error"
no_unused_vars = "error"
```

### process/pr.toml

```toml
[size]
max_files = 20
max_lines = 400

[reviews]
min_approvals = 2
require_codeowners = true
dismiss_stale = true

[tickets]
required = true
pattern = "[A-Z]+-[0-9]+"
check_in = ["title", "branch"]
```

---

## Inheritance

Teams can import and extend other teams' standards:

```toml
# .standards/config.toml

[inherits]
from = "github.com/acme/platform-standards"
ref = "v2.3.0"

[overrides]
code.linting.python.rules.max_complexity = { max = 15 }
process.pr.reviews.min_approvals = 1

[disable]
rules = ["code.testing.mutation_required"]
```

---

## CLI Usage

```bash
# Check all standards
$ standards check
✓ code.linting.python.max_complexity: 10 (max: 10)
✓ code.linting.python.required_rule_sets: E, F, I present
✗ code.testing.coverage.min_threshold: 65% (min: 80%)
✓ process.pr.reviews.min_approvals: 2 configured
✗ process.pr.reviews.dismiss_stale: not enabled

4 passed, 2 failed

# Check specific domain
$ standards check code
$ standards check process

# Check against remote standards
$ standards check --from=github.com/acme/platform-standards

# Diff your config against a standard
$ standards diff github.com/acme/platform-standards
```

---

## CI Integration

```yaml
# .github/workflows/standards.yml
name: Standards Check
on: [pull_request]

jobs:
  standards:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: standards-as-code/action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Why This Works

- **Portable** — Share standards between teams with a URL
- **Tool-specific** — Standards map directly to real configs (Ruff, ESLint, GitHub)
- **Enforceable** — Runs in CI, blocks non-compliant PRs
- **Incremental** — Start with one rule, expand over time
- **Auditable** — Standards are versioned, changes are tracked

---

## Ownership Model

| Domain  | Typical Owner                     |
| ------- | --------------------------------- |
| Code    | All developers                    |
| Process | Tech leads / engineering managers |

---

## Adoption Path

1. **Start** → `code/linting.toml` (immediate value, low friction)
2. **Expand** → `code/testing.toml` + `code/dependencies.toml`
3. **Coordinate** → `process/pr.toml` + `process/git.toml`
4. **Enforce** → `process/cicd.toml` (full CI integration)
