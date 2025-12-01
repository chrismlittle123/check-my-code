import type { ErrorObject } from 'ajv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(join(__dirname, 'schema.json'), 'utf-8'));

export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Singleton validator instance - using any to avoid ESM/CJS type issues with Ajv
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ajvInstance: any = null;

async function getValidator(): Promise<{
  getSchema: (
    name: string
  ) => (((data: unknown) => boolean) & { errors?: ErrorObject[] }) | undefined;
}> {
  if (!ajvInstance) {
    // Dynamic import with type assertions to handle ESM/CJS interop
    const AjvModule = await import('ajv');
    const addFormatsModule = await import('ajv-formats');

    // Handle default exports
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ajv = (AjvModule as any).default ?? AjvModule;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addFormats = (addFormatsModule as any).default ?? addFormatsModule;

    ajvInstance = new Ajv({
      allErrors: true,
      verbose: true,
      strict: true,
    });
    addFormats(ajvInstance);
    ajvInstance.addSchema(schema, 'cmc-toml');
  }
  return ajvInstance;
}

/**
 * Validates a parsed TOML config object against the cmc.toml schema
 */
export async function validateConfig(config: unknown): Promise<ValidationResult> {
  const ajv = await getValidator();
  const validate = ajv.getSchema('cmc-toml');

  if (!validate) {
    throw new Error('Schema not loaded');
  }

  const valid = validate(config);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = (validate.errors ?? []).map((err: ErrorObject) => ({
    path: err.instancePath || '/',
    message: err.message ?? 'Unknown error',
    keyword: err.keyword,
    params: err.params as Record<string, unknown>,
  }));

  return { valid: false, errors };
}

/**
 * Formats validation errors into human-readable messages
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return '';
  }

  const lines = errors.map((err) => {
    const path = err.path === '' ? 'root' : err.path;

    switch (err.keyword) {
      case 'required':
        return `Missing required field: ${path}/${err.params.missingProperty}`;
      case 'enum':
        return `Invalid value at ${path}: must be one of ${(err.params.allowedValues as string[]).join(', ')}`;
      case 'type':
        return `Invalid type at ${path}: expected ${err.params.type}`;
      case 'pattern':
        return `Invalid format at ${path}: ${err.message}`;
      case 'minLength':
        return `Value at ${path} is too short (minimum ${err.params.limit} characters)`;
      case 'maxLength':
        return `Value at ${path} is too long (maximum ${err.params.limit} characters)`;
      case 'minimum':
        return `Value at ${path} is too small (minimum ${err.params.limit})`;
      case 'maximum':
        return `Value at ${path} is too large (maximum ${err.params.limit})`;
      case 'additionalProperties':
        return `Unknown field at ${path}: ${err.params.additionalProperty}`;
      default:
        return `${path}: ${err.message}`;
    }
  });

  return lines.join('\n');
}
