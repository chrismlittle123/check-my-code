---
"check-my-code": patch
---

fix: three bug fixes

- `--json` flag now takes precedence over `--quiet` (outputs JSON instead of nothing)
- Invalid `[extends]` entries are now rejected with validation errors
- `[tools]` section now properly enables/disables linters (`eslint=false`, `ruff=false`, `tsc=true/false`)
