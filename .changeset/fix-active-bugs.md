---
"check-my-code": minor
---

Add audit warnings during check and validate template format

- `cmc check` now performs a quick audit before linting, showing warnings when config files are missing or don't match cmc.toml
- Template names in `[prompts] templates` are now validated to match `tier/language/version` format (e.g., `internal/typescript/5.5`)
- Added JSONC support for parsing tsconfig.json files with comments and trailing commas
- Refactored audit logic into shared `src/audit/` module for reuse between audit and check commands
