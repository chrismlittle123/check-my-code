// This file has a type error that tsc will catch

function add(a: number, b: number): number {
  return a + b;
}

// Type error: passing string to number parameter
const result = add("hello", 42);

export { result };
