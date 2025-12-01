#!/bin/bash
# =============================================================================
# Check that directory names in tests/e2e/projects use kebab-case
# =============================================================================
# Enforces consistent naming convention for test project directories.
# Valid: my-project, typescript-and-python, no-language
# Invalid: my_project, myProject, My-Project
# =============================================================================

set -e

# Find directories whose names contain underscores or uppercase letters
# Only checks the directory name itself, not the full path
invalid_dirs=""

while IFS= read -r dir; do
  dirname=$(basename "$dir")
  # Check if directory name contains underscore or uppercase
  if echo "$dirname" | grep -qE '[_A-Z]'; then
    invalid_dirs="$invalid_dirs$dir"$'\n'
  fi
done < <(find tests/e2e/projects -type d 2>/dev/null)

# Remove trailing newline
invalid_dirs=$(echo "$invalid_dirs" | sed '/^$/d')

if [ -n "$invalid_dirs" ]; then
  echo "❌ Directory names must use kebab-case (lowercase with hyphens):"
  echo "$invalid_dirs" | while read -r dir; do
    echo "   - $dir"
  done
  echo ""
  echo "Please rename directories to use kebab-case (e.g., my_project -> my-project)"
  exit 1
fi

echo "✓ All directory names use kebab-case"
