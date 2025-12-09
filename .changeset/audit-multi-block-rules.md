---
"check-my-code": patch
---

Improve audit ESLint rule extraction and comparison:

- Extract rules from all config blocks (not just the first one)
- Keep stricter severity when a rule appears in multiple blocks
- Allow extra rules beyond the required ruleset
- Accept array format rules when ruleset specifies string format
- Accept stricter severity (error satisfies warn requirement)
- Handle deeply nested rule options with proper brace matching
