## Python Coding Standards

You MUST follow these Python coding standards when writing or modifying code:

### Imports

- Remove all unused imports.
- Sort imports in the standard order: standard library, third-party, local.
- Use absolute imports over relative imports.

### Code Style

- Maximum line length: 120 characters.
- Use f-strings for string formatting, not `.format()` or `%` formatting.
- Use modern Python syntax (3.10+) including match statements, type unions with `|`, etc.

### Type Hints

- Add type hints to all function signatures.
- Use `from __future__ import annotations` for forward references.

### Error Handling

- Be specific with exception types. Avoid bare `except:` clauses.
- Use context managers (`with` statements) for resource management.

### Naming

- Use `snake_case` for functions and variables.
- Use `PascalCase` for classes.
- Use `SCREAMING_SNAKE_CASE` for constants.
