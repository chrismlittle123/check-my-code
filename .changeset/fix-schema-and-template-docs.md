---
"check-my-code": patch
---

Fix schemas directory missing from npm package and correct template name format in documentation

- **BUG-004**: `cmc validate` no longer crashes with "ENOENT: no such file or directory" - the `schemas/` directory is now included in the npm package distribution
- **BUG-005**: Fixed incorrect template name format in documentation and help text. Templates now correctly show the full path format `<tier>/<language>/<version>` (e.g., `internal/typescript/5.5`) instead of the abbreviated format
