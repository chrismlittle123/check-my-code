// This file intentionally has console.log violations

export function processData(data: unknown): void {
  console.log('Processing data:', data);

  // Do some processing
  const result = JSON.stringify(data);

  console.log('Result:', result);
}

export function debugFunction(): void {
  console.log('Debug info');
  console.warn('Warning message');
  console.error('Error message');
}
