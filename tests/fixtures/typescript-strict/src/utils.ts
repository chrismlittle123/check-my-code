/**
 * Utility functions
 * @module utils
 */

/**
 * Formats a date to ISO string
 * @param date - The date to format
 * @returns ISO formatted date string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Checks if a value is defined (not null or undefined)
 * @param value - The value to check
 * @returns True if the value is defined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Delays execution for a specified time
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
