// This file has ESLint violations but they should not be reported
// because eslint is disabled via [tools]
var x = 1; // no-var violation
let y = 2; // prefer-const violation (unused, not reassigned)
console.log(x);
