// Multiple violations in file-a.ts
var a1 = 1; // no-var violation at line 2
var a2 = 2; // no-var violation at line 3
let a3 = 3; // prefer-const violation at line 4
if (a1 == a2) {
} // eqeqeq violation at line 5
console.log(a1, a2, a3);
