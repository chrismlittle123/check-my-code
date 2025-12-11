---
"check-my-code": patch
---

Fix release workflow to automatically publish after release PR merge

- Consolidate release workflow to single job using changesets action's publish option
- Add publishConfig to package.json for provenance and public access
- Update CLAUDE.md with corrected release instructions
