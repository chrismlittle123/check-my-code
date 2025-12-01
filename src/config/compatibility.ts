import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface LanguageConfig {
  name: string;
  extensions: string[];
  versions: string[];
  linter: string;
}

export interface LinterConfig {
  name: string;
  languages: string[];
  install: string;
  check_command: string;
  json_flag: string;
  config_files: string[];
  default_rules?: string[];
}

export interface CompatibilityConfig {
  version: string;
  languages: Record<string, LanguageConfig>;
  linters: Record<string, LinterConfig>;
}

let cachedConfig: CompatibilityConfig | null = null;

/**
 * Load the compatibility configuration from YAML
 */
export function loadCompatibilityConfig(): CompatibilityConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = join(__dirname, 'compatibility.yaml');
  const content = readFileSync(configPath, 'utf-8');
  cachedConfig = parseYaml(content) as CompatibilityConfig;
  return cachedConfig;
}

/**
 * Get language config by file extension
 */
export function getLanguageByExtension(extension: string): LanguageConfig | null {
  const config = loadCompatibilityConfig();

  for (const langConfig of Object.values(config.languages)) {
    if (langConfig.extensions.includes(extension)) {
      return langConfig;
    }
  }

  return null;
}

/**
 * Get linter config by name
 */
export function getLinterConfig(linterName: string): LinterConfig | null {
  const config = loadCompatibilityConfig();
  return config.linters[linterName] ?? null;
}

/**
 * Get default linter for a language
 */
export function getDefaultLinter(language: string): string | null {
  const config = loadCompatibilityConfig();
  return config.languages[language]?.linter ?? null;
}

/**
 * Get all supported file extensions
 */
export function getAllSupportedExtensions(): string[] {
  const config = loadCompatibilityConfig();
  const extensions: string[] = [];

  for (const langConfig of Object.values(config.languages)) {
    extensions.push(...langConfig.extensions);
  }

  return [...new Set(extensions)];
}
