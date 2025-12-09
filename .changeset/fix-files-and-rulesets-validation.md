---
"check-my-code": patch
---

Fix two configuration validation bugs:

1. **[files] section now works**: The `include` and `exclude` patterns in the `[files]` section of cmc.toml are now respected. Previously, these patterns were completely ignored and all files were checked regardless of configuration.

2. **Invalid linter names now rejected**: Invalid linter names in `[rulesets]` (e.g., `[rulesets.invalidlinter]`) are now rejected during validation. Previously, unknown linter names were silently ignored. Only `eslint`, `ruff`, and `tsc` are valid.

Additionally, both the `[files]` and `[rulesets]` sections now reject unknown keys.
