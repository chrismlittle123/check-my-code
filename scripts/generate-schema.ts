#!/usr/bin/env npx ts-node
/**
 * Generate JSON Schema from Zod schema
 *
 * Usage: npx ts-node scripts/generate-schema.ts
 * Output: schema.json in project root
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// ESLint rule values: "off", "warn", "error", or array like ["error", "always"]
const eslintRuleValueSchema = z.union([
  z.enum(['off', 'warn', 'error']),
  z.tuple([z.string()]).rest(z.unknown()),
]);

// Ruff configuration schema
const ruffConfigSchema = z
  .object({
    'line-length': z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum line length'),
    lint: z
      .object({
        select: z.array(z.string()).optional().describe('Ruff rule codes to enable'),
        ignore: z.array(z.string()).optional().describe('Ruff rule codes to ignore'),
      })
      .optional()
      .describe('Ruff lint configuration'),
  })
  .passthrough();

// Remote reference pattern: github:owner/repo[/path]@version
const remoteRefPattern = /^github:[^/]+\/[^/@]+(?:\/[^@]*)?@.+$/;

// AI context configuration schema
const aiContextSchema = z.object({
  templates: z
    .array(z.string().min(1))
    .min(1)
    .describe('Template names to load (e.g., ["typescript-strict", "python-prod"])'),
  source: z
    .string()
    .regex(remoteRefPattern)
    .optional()
    .describe('Custom source repository (format: github:owner/repo/path@version)'),
});

// Extends configuration schema
const extendsSchema = z.object({
  eslint: z
    .string()
    .regex(remoteRefPattern)
    .optional()
    .describe('Remote ESLint ruleset (format: github:owner/repo/path@version)'),
  ruff: z
    .string()
    .regex(remoteRefPattern)
    .optional()
    .describe('Remote Ruff ruleset (format: github:owner/repo/path@version)'),
});

// Full cmc.toml schema
const configSchema = z
  .object({
    project: z
      .object({
        name: z.string().min(1).describe('Project name'),
      })
      .describe('Project configuration'),
    extends: extendsSchema.optional().describe('Inherit rulesets from remote repositories'),
    'ai-context': aiContextSchema
      .optional()
      .describe('AI context configuration for coding assistants'),
    rulesets: z
      .object({
        eslint: z
          .object({
            rules: z
              .record(z.string(), eslintRuleValueSchema)
              .optional()
              .describe('ESLint rules configuration'),
          })
          .optional()
          .describe('ESLint configuration'),
        ruff: ruffConfigSchema.optional().describe('Ruff configuration'),
      })
      .optional()
      .describe('Linter rulesets'),
  })
  .describe('cmc.toml configuration schema');

// Generate JSON Schema using Zod v4 native support
const jsonSchema = z.toJSONSchema(configSchema, {
  unrepresentable: 'any',
  io: 'input',
});

// Add schema metadata
const schemaWithMeta = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://raw.githubusercontent.com/chrismlittle123/check-my-code-community/main/schema.json',
  title: 'cmc.toml',
  description: 'Configuration schema for check-my-code (cmc) CLI tool',
  ...jsonSchema,
};

// Write to file
const outputPath = join(process.cwd(), 'schema.json');
writeFileSync(outputPath, JSON.stringify(schemaWithMeta, null, 2) + '\n');

console.log(`✓ Generated schema.json`);
