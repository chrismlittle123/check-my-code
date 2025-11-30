import type { CheckOptions } from '../types.js';

export interface Spinner {
  start(text: string): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  warn(text?: string): void;
  text: string;
}

class RealSpinner implements Spinner {
  private ora: any;
  private spinner: any;
  private _text: string = '';

  constructor(ora: any) {
    this.ora = ora;
  }

  start(text: string): void {
    if (this.spinner) {
      this.spinner.stop();
    }
    this._text = text;
    this.spinner = this.ora(text).start();
  }

  succeed(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
  }

  fail(text?: string): void {
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
  }

  warn(text?: string): void {
    if (this.spinner) {
      this.spinner.warn(text);
      this.spinner = null;
    }
  }

  get text(): string {
    return this._text;
  }

  set text(value: string) {
    this._text = value;
    if (this.spinner) {
      this.spinner.text = value;
    }
  }
}

class SilentSpinner implements Spinner {
  private _text: string = '';

  start(_text: string): void {
    // No output in quiet mode
  }

  succeed(_text?: string): void {
    // No output in quiet mode
  }

  fail(_text?: string): void {
    // No output in quiet mode
  }

  warn(_text?: string): void {
    // No output in quiet mode
  }

  get text(): string {
    return this._text;
  }

  set text(value: string) {
    this._text = value;
  }
}

class SimpleSpinner implements Spinner {
  private _text: string = '';

  start(text: string): void {
    this._text = text;
    process.stderr.write(`${text}\n`);
  }

  succeed(text?: string): void {
    if (text) {
      process.stderr.write(`✓ ${text}\n`);
    }
  }

  fail(text?: string): void {
    if (text) {
      process.stderr.write(`✗ ${text}\n`);
    }
  }

  warn(text?: string): void {
    if (text) {
      process.stderr.write(`⚠ ${text}\n`);
    }
  }

  get text(): string {
    return this._text;
  }

  set text(value: string) {
    this._text = value;
  }
}

export async function createSpinner(options: CheckOptions): Promise<Spinner> {
  // Use silent spinner for quiet or JSON mode
  if (options.quiet || options.json) {
    return new SilentSpinner();
  }

  // Try to use ora for nice spinners
  try {
    const { default: ora } = await import('ora');
    return new RealSpinner(ora);
  } catch {
    // Fall back to simple output if ora isn't available
    return new SimpleSpinner();
  }
}
