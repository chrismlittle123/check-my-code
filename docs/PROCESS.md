# Development Process

This document describes the development workflow for check-my-code.

## Overview

```
ROADMAP → PRD → Branch → Develop → PR → Code Review → Merge → Auto-Publish
```

---

## 1. Planning

### Select Next Feature

1. Check `docs/ROADMAP.md` for the next planned feature
2. Features are organized by version (v1.5.x, v1.6.x, etc.)
3. Pick items in order unless priorities change

### Create PRD

For each release, create a PRD in `docs/features/`:

```
docs/features/v1.5-cli-polish.md
docs/features/v1.6-sync-command.md
```

PRD should include:

- **Problem statement** - What problem are we solving?
- **Proposed solution** - How will we solve it?
- **API/CLI design** - Command syntax, flags, output format
- **Implementation steps** - Broken into small, mergeable chunks
- **Edge cases** - Error handling, validation
- **Testing strategy** - Unit tests, e2e tests, manual verification

---

## 2. Branching

### Branch Protection

- `main` branch is protected - never commit directly
- All changes go through pull requests
- CodeRabbit reviews all PRs automatically

### Branch Naming Patterns

| Type     | Pattern                           | Example                       |
| -------- | --------------------------------- | ----------------------------- |
| Feature  | `feature/<version>/<description>` | `feature/v1.5/colored-output` |
| Bug fix  | `fix/<version>/<description>`     | `fix/v1.4/audit-tsc-missing`  |
| Refactor | `refactor/<description>`          | `refactor/loader-cleanup`     |
| Docs     | `docs/<description>`              | `docs/process-update`         |
| Hotfix   | `hotfix/<description>`            | `hotfix/critical-bug`         |

### Creating a Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/v1.5/my-feature
```

---

## 3. Development

### Keep PRs Small

- **Target ~200-300 lines changed per PR**
- One feature or fix per PR
- Break large features into multiple PRs
- Each PR should be independently mergeable

### Code Standards

Code must follow standards defined in:

- `cmc.toml` - Linter rules
- `docs/STANDARDS.md` - Coding guidelines (pulled via `cmc context`)
- `CLAUDE.md` - AI agent instructions

### Automated Checks

Claude Code automatically runs `cmc check` after file edits via PostToolUse hook (configured in `.claude/settings.json`).

Manual checks:

```bash
cmc check src/           # Check code follows standards
cmc audit                # Verify linter configs match cmc.toml
```

### Testing

- **80% unit test coverage required**
- Write tests alongside code

```bash
npm run test:run              # Run all tests
npm run test:run tests/unit/  # Unit tests only
npm run test:run tests/e2e/   # E2E tests only
npm test                      # Watch mode
```

### Pre-Push Hooks

Husky runs automatically on `git push`:

1. TypeScript type-check
2. ESLint
3. Build
4. `cmc audit`
5. `cmc check src/`

---

## 4. Pull Request

### Before Opening PR

```bash
# Ensure all checks pass locally
npm run typecheck
npm run lint
npm run build
npm run test:run
cmc check src/
```

### PR Guidelines

- **Small, focused changes** - One feature/fix per PR
- **Clear description** - What changed and why
- **Link to ROADMAP** - Reference the item being implemented
- **Test plan** - How to verify the changes work

### PR Description Template

```markdown
## Summary

Brief description of changes.

## Related

- Implements ROADMAP item: v1.5.x - Colored output

## Changes

- Added chalk dependency
- Updated check command output

## Test Plan

- [ ] `cmc check` shows colored output
- [ ] `cmc check --json` still works
- [ ] All e2e tests pass
```

---

## 5. Code Review

### Automated Review

CodeRabbit automatically reviews all PRs for:

- Code quality issues
- Security vulnerabilities
- Test coverage
- Style consistency

### Review Checklist

- [ ] Code follows `docs/STANDARDS.md`
- [ ] Tests cover new functionality
- [ ] No regressions in existing tests
- [ ] Error handling is appropriate
- [ ] Documentation updated if needed
- [ ] CHANGELOG.md updated

---

## 6. CI/CD Pipeline

### GitHub Actions

Runs automatically on every PR and push to main:

| Job       | What it does                                                     |
| --------- | ---------------------------------------------------------------- |
| `test`    | Type check, lint, build, unit tests, cmc check (Node 18, 20, 22) |
| `e2e`     | Full e2e test suite (Node 20)                                    |
| `publish` | Auto-publish to npm if version changed (main only)               |

### Auto-Publishing

When a PR is merged to main:

1. CI runs all tests
2. If tests pass and `package.json` version differs from npm, auto-publishes
3. No manual `npm publish` needed

To trigger a release, bump the version in your PR:

```bash
# In your feature branch, before merging
npm version patch  # or minor, major
```

---

## 7. Versioning

### Semantic Versioning

| Type              | When to use                        | Example         |
| ----------------- | ---------------------------------- | --------------- |
| **Patch** (x.x.1) | Bug fixes, minor improvements      | `1.4.3 → 1.4.4` |
| **Minor** (x.1.0) | New features, backwards compatible | `1.4.4 → 1.5.0` |
| **Major** (1.0.0) | Breaking changes                   | `1.5.0 → 2.0.0` |

### Changelog

Update `CHANGELOG.md` in every PR that changes functionality:

```markdown
## [Unreleased]

### Added

- New feature description

### Changed

- Modified behavior

### Fixed

- Bug fix description
```

---

## 8. Hotfix Process

For critical bugs that need immediate fix:

1. Create branch: `hotfix/critical-bug`
2. Make minimal fix
3. Open PR with `[HOTFIX]` prefix
4. Fast-track review (still requires CI to pass)
5. Merge and auto-publish

---

## Quick Reference

```bash
# Start new feature
git checkout main && git pull
git checkout -b feature/v1.5/my-feature

# Development loop
# (Claude auto-runs cmc check after edits)
npm run test:run
npm run typecheck

# Ready for PR
git push -u origin feature/v1.5/my-feature
# Open PR on GitHub - CodeRabbit reviews automatically

# Before merge - bump version if releasing
npm version patch

# After merge - auto-publishes to npm
```

---

## Related Documents

| Document                   | Purpose                       |
| -------------------------- | ----------------------------- |
| `docs/ROADMAP.md`          | Feature planning and tracking |
| `docs/STANDARDS.md`        | Coding standards              |
| `CHANGELOG.md`             | Version history               |
| `CLAUDE.md`                | AI agent instructions         |
| `.github/workflows/ci.yml` | CI/CD configuration           |
| `.claude/settings.json`    | Claude Code hooks             |
