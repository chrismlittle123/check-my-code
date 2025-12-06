# Coding Standards

This document contains the coding standards for this project, generated via `cmc context`.

## TypeScript 5.5 Coding Standards - INTERNAL

Standards for internal tools, services, and team-facing applications.

### Target Version

- Target TypeScript 5.5 specifically.
- Target Node.js 20 runtime.
- Use TypeScript 5.5 features where appropriate.

### Variable Declarations

- NEVER use `var`. Always use `const` for values that won't be reassigned, or `let` when reassignment is necessary.
- Prefer `const` over `let` whenever possible.

### Type Safety

- Avoid `any` type. Use `unknown` if the type is truly unknown, then narrow it with type guards.
- Provide explicit return types for public functions.
- Use strict null checks - handle `null` and `undefined` explicitly.

### TypeScript 5.5 Features

- Use inferred type predicates for cleaner type narrowing.
- Use `const` type parameters where appropriate.
- Use `satisfies` operator for type validation without widening.
- Use `import type` and `export type` for type-only imports/exports.

### Equality

- ALWAYS use strict equality (`===` and `!==`). Never use loose equality.

### Error Handling

- Handle errors explicitly. Never swallow errors silently.
- Prefer `unknown` over `any` in catch clauses.

### Imports

- Use ES module imports (`import`/`export`), not CommonJS.
- Sort imports: external dependencies first, then internal modules.
- Use `import type` for type-only imports.

### Node.js 20

- Use native fetch API (no need for node-fetch).
- Use ES modules (`"type": "module"` in package.json).
