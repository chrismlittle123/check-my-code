import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { findProjectRoot, stripSymbolKeys } from '../../config/loader.js';
import { ExitCode } from '../../types.js';

interface AjvErrorObject {
  instancePath: string;
  keyword: string;
  message?: string;
  params: Record<string, unknown>;
}

interface ValidationError {
  path: string;
  message: string;
  keyword: string;
}

interface ValidateResult {
  valid: boolean;
  errors: ValidationError[];
  configPath: string;
}

export const validateCommand = new Command('validate')
  .description('Validate cmc.toml against the JSON schema')
  .argument('[path]', 'Path to cmc.toml (default: auto-discover from current directory)')
  .option('--json', 'Output results as JSON', false)
  .option('-v, --verbose', 'Show detailed error information', false)
  .addHelpText(
    'after',
    `
Examples:
  $ cmc validate                Validate cmc.toml in current project
  $ cmc validate ./cmc.toml     Validate specific file
  $ cmc validate --json         Output as JSON for CI/tooling
  $ cmc validate --verbose      Show detailed validation errors`
  )
  .action(async (path: string | undefined, options: { json?: boolean; verbose?: boolean }) => {
    try {
      const result = await runValidation(path);
      outputResults(result, options.json ?? false, options.verbose ?? false);
      process.exit(result.valid ? ExitCode.SUCCESS : ExitCode.CONFIG_ERROR);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (options.json) {
        console.log(JSON.stringify({ valid: false, error: message }, null, 2));
      } else {
        console.error(`Error: ${message}`);
      }
      process.exit(ExitCode.RUNTIME_ERROR);
    }
  });

async function runValidation(path?: string): Promise<ValidateResult> {
  // Determine config path
  let configPath: string;
  if (path) {
    configPath = resolve(path);
  } else {
    const projectRoot = findProjectRoot();
    configPath = join(projectRoot, 'cmc.toml');
  }

  // Check if file exists
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  // Load schema from package
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const schemaPath = join(__dirname, '../../../schema.json');
  const schemaContent = await readFile(schemaPath, 'utf-8');
  const schema = JSON.parse(schemaContent);

  // Load and parse TOML config
  const configContent = await readFile(configPath, 'utf-8');
  const TOML = await import('@iarna/toml');

  let parsed: unknown;
  try {
    parsed = TOML.parse(configContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parse error';
    return {
      valid: false,
      errors: [{ path: '', message: `Invalid TOML syntax: ${message}`, keyword: 'syntax' }],
      configPath,
    };
  }

  // Strip Symbol keys added by @iarna/toml
  parsed = stripSymbolKeys(parsed);

  // Validate against JSON schema using Ajv 2020-12 (for JSON Schema draft 2020-12)
  const ajvModule = await import('ajv/dist/2020.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ajv2020 = ajvModule.default as any;
  const ajv = new Ajv2020({ allErrors: true, verbose: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(parsed);

  if (valid) {
    return { valid: true, errors: [], configPath };
  }

  // Convert Ajv errors to our format
  const errors = (
    ((validate as { errors?: AjvErrorObject[] }).errors ?? []) as AjvErrorObject[]
  ).map((err) => ({
    path: err.instancePath || '/',
    message: formatAjvError(err),
    keyword: err.keyword,
  }));

  return { valid: false, errors, configPath };
}

function formatAjvError(error: AjvErrorObject): string {
  switch (error.keyword) {
    case 'required':
      return `missing required property '${error.params.missingProperty}'`;
    case 'type':
      return `must be ${error.params.type}`;
    case 'minLength':
      return `must have at least ${error.params.limit} character(s)`;
    case 'minItems':
      return `must have at least ${error.params.limit} item(s)`;
    case 'pattern':
      return `must match pattern: ${error.params.pattern}`;
    case 'enum':
      return `must be one of: ${(error.params.allowedValues as string[]).join(', ')}`;
    case 'additionalProperties':
      return `has unknown property '${error.params.additionalProperty}'`;
    default:
      return error.message ?? 'validation failed';
  }
}

function outputResults(result: ValidateResult, json: boolean, verbose: boolean): void {
  if (json) {
    console.log(
      JSON.stringify(
        {
          valid: result.valid,
          configPath: result.configPath,
          errors: result.errors,
        },
        null,
        2
      )
    );
    return;
  }

  if (result.valid) {
    console.log(`✓ ${result.configPath} is valid`);
    return;
  }

  console.log(`✗ ${result.configPath} has validation errors:\n`);

  for (const error of result.errors) {
    if (verbose) {
      const pathDisplay = error.path || '(root)';
      console.log(`  Path: ${pathDisplay}`);
      console.log(`  Error: ${error.message}`);
      console.log(`  Keyword: ${error.keyword}`);
      console.log();
    } else {
      const pathDisplay = error.path ? `${error.path}: ` : '';
      console.log(`  - ${pathDisplay}${error.message}`);
    }
  }

  const s = result.errors.length === 1 ? '' : 's';
  console.log(`\n${result.errors.length} validation error${s} found`);
}
