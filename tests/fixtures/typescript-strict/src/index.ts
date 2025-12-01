/**
 * Main entry point for the application
 * @module index
 */

/**
 * Adds two numbers together
 * @param a - First number
 * @param b - Second number
 * @returns The sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Multiplies two numbers
 * @param a - First number
 * @param b - Second number
 * @returns The product of a and b
 */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Application configuration
 */
export interface AppConfig {
  /** Application name */
  name: string;
  /** Application version */
  version: string;
  /** Debug mode flag */
  debug: boolean;
}

/**
 * Default configuration
 */
export const defaultConfig: AppConfig = {
  name: 'my-app',
  version: '1.0.0',
  debug: false,
};
