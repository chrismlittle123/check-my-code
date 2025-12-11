// A clean file within all limits
function add(a: number, b: number): number {
  return a + b;
}

function greet(name: string): string {
  if (name) {
    return `Hello, ${name}!`;
  }
  return "Hello!";
}

export { add, greet };
