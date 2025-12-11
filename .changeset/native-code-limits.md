---
"check-my-code": minor
---

Add native code limits for file and function complexity

New `[limits]` configuration section in cmc.toml to enforce code complexity limits without external linters:

- `file-lines`: Maximum lines per file
- `function-lines`: Maximum lines per function
- `parameters`: Maximum function parameters
- `nesting`: Maximum nested block depth

Supports TypeScript/JavaScript and Python files with AST-based analysis.
