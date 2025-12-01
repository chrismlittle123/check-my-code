## TypeScript Coding Standards

You MUST follow these TypeScript coding standards when writing or modifying code:

### Variable Declarations

- NEVER use `var`. Always use `const` for values that won't be reassigned, or `let` when reassignment is necessary.
- Prefer `const` over `let` whenever possible.

### Type Safety

- NEVER use `any` type. Use `unknown` if the type is truly unknown, then narrow it with type guards.
- Always provide explicit return types for functions.
- Use strict null checks - handle `null` and `undefined` explicitly.

### Equality

- ALWAYS use strict equality (`===` and `!==`). Never use loose equality (`==` and `!=`).

### Error Handling

- Always handle errors explicitly. Never swallow errors silently.
- Use typed error handling where possible.

### Imports

- Use ES module imports (`import`/`export`), not CommonJS (`require`/`module.exports`).
- Sort imports: external dependencies first, then internal modules.
