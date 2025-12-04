# Standards-as-Code Suite

> Define once, enforce everywhere, document automatically.

## The Idea

A unified toolkit that lets engineering teams define their standards in a **machine-readable format** (TOML/YAML), then automatically:

1. **Generate tool configs** (ruff.toml, eslint, codecov, CI pipelines, etc.)
2. **Generate human-readable documentation** (the "engineering handbook")
3. **Enforce compliance** across all standards

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Human-Readable Docs (GENERATED)                   │
│  Always in sync because it's derived output                 │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ generate
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: Standards-as-Code (SOURCE OF TRUTH)               │
│  TOML/YAML files — this is what the team maintains          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ generate
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: Tool Configs (GENERATED)                          │
│  Linters, CI pipelines, pre-commit hooks — never hand-edit  │
└─────────────────────────────────────────────────────────────┘
```

---

## The Four Domains

| Domain            | Core Question              | What It Governs                                |
| ----------------- | -------------------------- | ---------------------------------------------- |
| **Code**          | Is the artifact correct?   | Static analysis of everything in the repo      |
| **Process**       | Did we build it correctly? | How changes flow from idea → merged → deployed |
| **Documentation** | Can others understand it?  | Captured knowledge for humans                  |
| **Operations**    | Is it safe to run?         | Production readiness and observability         |

---

## Structure

```
standards/
│
├── code/
│   ├── style.toml              # Linting, formatting, complexity
│   ├── testing.toml            # Coverage, mutation, structure
│   ├── dependencies.toml       # Vulnerabilities, licenses, staleness
│   ├── api.toml                # Spec validity, versioning, breaking changes
│   ├── infrastructure.toml     # Terraform, tagging, naming
│   ├── security.toml           # SAST, secrets, container scanning
│   └── accessibility.toml      # WCAG compliance
│
├── process/
│   ├── git.toml                # Commit format, branch naming
│   ├── pr.toml                 # Size limits, reviewers, ticket linking
│   ├── cicd.toml               # Required stages, gates, timeouts
│   └── release.toml            # Versioning, promotion, approvals
│
├── documentation/
│   ├── readme.toml             # Required sections, completeness
│   ├── decisions.toml          # ADR format and requirements
│   ├── changelog.toml          # Format, automation
│   └── api-docs.toml           # Rendered docs, examples
│
└── operations/
    ├── logging.toml            # Format, required fields
    ├── metrics.toml            # Naming conventions, required metrics
    ├── tracing.toml            # Propagation, coverage
    ├── alerts.toml             # Required alerts, runbook links
    └── security.toml           # Permissions, auth patterns
```

---

## Why This Works

- **Tool agnostic** — Same standards, different linters (Ruff vs Flake8, ESLint vs Biome)
- **System agnostic** — Swap Jira for Linear, GitHub for GitLab — standards stay the same
- **Tiered enforcement** — Prototype vs Internal vs Production quality gates
- **Always in sync** — Docs are generated, never stale
- **Incremental adoption** — Start with `code/style.toml`, expand over time

---

## Ownership Model

| Domain        | Typical Owner                     |
| ------------- | --------------------------------- |
| Code          | All developers                    |
| Process       | Tech leads / engineering managers |
| Documentation | Senior devs / tech writers        |
| Operations    | Platform team / SRE               |

---

## Adoption Path

1. **Start** → `code.style` + `code.testing` (immediate CI value)
2. **Grow** → `process.pr` + `process.git` (team coordination)
3. **Scale** → `documentation.*` (knowledge sharing)
4. **Mature** → `operations.*` (production readiness)
