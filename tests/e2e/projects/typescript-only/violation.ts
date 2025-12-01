// This file has intentional ESLint violations

// @ts-nocheck - disable TS checks so ESLint violations are clear

var x = 1; // no-var: use let or const instead
let unused = 2; // @typescript-eslint/no-unused-vars

export function test() {
  console.log(x);
}
