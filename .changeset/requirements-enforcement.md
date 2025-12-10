---
"check-my-code": minor
---

Add requirements enforcement feature (v1.7.x)

New `[requirements]` configuration section allows enforcing:

- **Required files**: Specify files that must exist in the project (e.g., CLAUDE.md, CHANGELOG.md)
- **Required tools**: Verify that specific tools are configured (policy enforcer, not tool runner)
  - Supported tools: ty, gitleaks, npm-audit, pip-audit, knip, vulture

CLI changes:

- `cmc check` now validates requirements before running linters
- `cmc audit` can audit requirements with `cmc audit requirements`
- `--skip-requirements` flag to bypass requirements validation

Example configuration:

```toml
[requirements]
files = ["CLAUDE.md", "CHANGELOG.md", ".nvmrc"]
tools = ["gitleaks", "npm-audit", "knip"]
```
