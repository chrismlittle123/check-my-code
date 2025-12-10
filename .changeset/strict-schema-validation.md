---
"check-my-code": patch
---

Reject unknown properties in cmc.toml validation. Unknown top-level sections like `[totally_made_up_section]` and unknown properties in `[project]` now produce validation errors instead of being silently ignored.
