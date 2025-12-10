---
"check-my-code": patch
---

Fix race condition when multiple cmc processes fetch the same remote repository concurrently. Add cross-process file locking using proper-lockfile. Also deduplicate template entries to avoid duplicated content in output files.
