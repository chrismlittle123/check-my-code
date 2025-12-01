// TypeScript file with violations in mixed project

// @ts-nocheck

var badVar = 1; // no-var violation
let unusedVar = 2; // unused-vars violation

export function getValue() {
  return badVar;
}
