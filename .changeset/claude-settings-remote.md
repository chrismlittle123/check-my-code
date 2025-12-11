---
"check-my-code": minor
---

Add Claude settings from remote feature (v1.10.x)

- Add `[ai.claude]` configuration section with `extends` option in cmc.toml
- Add `cmc generate claude` command to generate `.claude/settings.json` from remote config
- Add `cmc audit claude` command to verify local settings match remote
- Fetch Claude Code settings from manifest-based remote repositories
- Add Zod validation for fetched Claude settings
