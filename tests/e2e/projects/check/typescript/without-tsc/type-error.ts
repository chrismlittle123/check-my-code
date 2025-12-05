// This file has a type error but tsc is NOT enabled in cmc.toml
// So cmc check should pass (only ESLint runs)

function add(a: number, b: number): number {
  return a + b;
}

// Type error that tsc would catch, but ESLint won't
const result = add('hello', 42);

export { result };
