/**
 * Deep equality utilities for comparing complex values.
 */

/** Deep equality check for comparing values */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    return arraysEqual(a, b);
  }

  if (typeof a === "object" && typeof b === "object") {
    return objectsEqual(
      a as Record<string, unknown>,
      b as Record<string, unknown>,
    );
  }

  return false;
}

/** Compare two arrays for deep equality */
function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => deepEqual(val, b[i]));
}

/** Compare two objects for deep equality */
function objectsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEqual(a[key], b[key]));
}
