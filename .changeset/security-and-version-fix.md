---
"check-my-code": patch
---

fix: patch MCP path traversal vulnerability and simplify version semantics

- Security: Added path validation in MCP server to reject path traversal attacks via searchPath
- Simplified remote fetcher to always clone default branch - @version now only used for manifest lookup
