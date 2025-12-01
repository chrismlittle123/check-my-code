import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface LanguageConfig {
  name: string;
  extensions: string[];
  versions: string[];
  linter: string;
}

interface LinterConfig {
  name: string;
  languages: string[];
  install: string;
  check_command: string;
  json_flag: string;
  config_files: string[];
  default_rules?: string[];
}

interface CompatibilityConfig {
  version: string;
  languages: Record<string, LanguageConfig>;
  linters: Record<string, LinterConfig>;
}

let cachedConfig: CompatibilityConfig | null = null;

function loadCompatibilityConfig(): CompatibilityConfig {
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
