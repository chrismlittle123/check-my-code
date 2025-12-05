// Clean file - no violations
const greeting = "Hello, World!";
const count = 42;

function greet(name: string): string {
  return `${greeting}, ${name}! Count: ${count}`;
}

export { greet };
