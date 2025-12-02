// Multiple violations in file-b.ts
var b1 = 10; // no-var violation at line 2
let b2 = 20; // prefer-const violation at line 3
if (b1 != b2) {
} // eqeqeq violation at line 4
console.log(b1, b2);
