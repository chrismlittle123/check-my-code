/**
 * Config Factory - Generate cmc.toml configurations for exhaustive testing
 *
 * This module provides utilities to:
 * 1. Build valid configs programmatically
 * 2. Generate permutations of config options
 * 3. Create intentionally invalid configs for error testing
 */

// All valid values from the schema
export const VALID_CATEGORIES = [
  'production',
  'prototype',
  'internal',
  'learning',
  'other',
] as const;
export const VALID_AI_AGENTS = ['claude', 'codex', 'gemini'] as const;
export const VALID_SUPPORTED_AGENTS = ['claude', 'codex', 'gemini', 'cursor', 'copilot'] as const;
export const VALID_OUTPUT_FORMATS = ['default', 'verbose', 'quiet', 'json'] as const;
export const VALID_LINTERS = ['ruff', 'eslint', 'biome'] as const;

// Built-in ruleset references
export const BUILTIN_RULESETS = ['default'] as const;

// Example community ruleset patterns
export const EXAMPLE_COMMUNITY_RULESETS = [
  'community/general-best-practices@1.0.0',
  'community/python-base@1.0.0',
  'community/python-fastapi-prod@1.0.0',
  'community/typescript-base@1.0.0',
  'community/typescript-react-prod@1.0.0',
] as const;

// Example git ruleset patterns
export const EXAMPLE_GIT_RULESETS = [
  'git@github.com:company/standards.git#base@1.0.0',
  'git@github.com:mycompany/rules.git#typescript@2.0.0',
] as const;

export type ProjectCategory = (typeof VALID_CATEGORIES)[number];
export type AIAgent = (typeof VALID_AI_AGENTS)[number];
export type OutputFormat = (typeof VALID_OUTPUT_FORMATS)[number];

export interface ConfigOptions {
  // Project section
  projectName?: string;
  projectCategory?: ProjectCategory;
  projectDescription?: string;

  // Rulesets section
  defaultRulesets?: string[];
  languageRulesets?: Record<
    string,
    | string[]
    | {
        paths?: string[];
        rules?: string[];
        extends?: string[];
      }
  >;

  // AI section
  aiEnabled?: boolean;
  aiAgent?: AIAgent;
  aiModel?: string;
  aiMaxTokens?: number;

  // Agents section
  supportedAgents?: string[];

  // Paths section
  includePaths?: string[];
  excludePaths?: string[];

  // Checks section
  fileLength?: {
    maxLines?: number;
    exclude?: string[];
  };
  linters?: Record<
    string,
    {
      enabled?: boolean;
      configFile?: string;
      args?: string[];
    }
  >;

  // Output section
  outputFormat?: OutputFormat;
  outputColor?: boolean;
}

/**
 * Build a valid cmc.toml config string from options
 */
export function buildConfig(options: ConfigOptions = {}): string {
  const lines: string[] = [];

  // Project section (required)
  lines.push('[project]');
  lines.push(`name = "${options.projectName ?? 'test-project'}"`);
  lines.push(`category = "${options.projectCategory ?? 'production'}"`);
  if (options.projectDescription) {
    lines.push(`description = "${options.projectDescription}"`);
  }
  lines.push('');

  // Rulesets section (required)
  lines.push('[rulesets]');
  const defaultRulesets = options.defaultRulesets ?? [];
  lines.push(`default = [${defaultRulesets.map((r) => `"${r}"`).join(', ')}]`);

  if (options.languageRulesets) {
    for (const [lang, config] of Object.entries(options.languageRulesets)) {
      lines.push('');
      if (Array.isArray(config)) {
        lines.push(`[rulesets.${lang}]`);
        lines.push(`rules = [${config.map((r) => `"${r}"`).join(', ')}]`);
      } else {
        lines.push(`[rulesets.${lang}]`);
        if (config.paths) {
          lines.push(`paths = [${config.paths.map((p) => `"${p}"`).join(', ')}]`);
        }
        if (config.rules) {
          lines.push(`rules = [${config.rules.map((r) => `"${r}"`).join(', ')}]`);
        }
        if (config.extends) {
          lines.push(`extends = [${config.extends.map((e) => `"${e}"`).join(', ')}]`);
        }
      }
    }
  }
  lines.push('');

  // AI section (optional)
  if (
    options.aiEnabled !== undefined ||
    options.aiAgent ||
    options.aiModel ||
    options.aiMaxTokens
  ) {
    lines.push('[ai]');
    if (options.aiEnabled !== undefined) {
      lines.push(`enabled = ${options.aiEnabled}`);
    }
    if (options.aiAgent) {
      lines.push(`agent = "${options.aiAgent}"`);
    }
    if (options.aiModel) {
      lines.push(`model = "${options.aiModel}"`);
    }
    if (options.aiMaxTokens) {
      lines.push(`max_tokens = ${options.aiMaxTokens}`);
    }
    lines.push('');
  }

  // Agents section (optional)
  if (options.supportedAgents && options.supportedAgents.length > 0) {
    lines.push('[agents]');
    lines.push(`supported = [${options.supportedAgents.map((a) => `"${a}"`).join(', ')}]`);
    lines.push('');
  }

  // Paths section (optional)
  if (options.includePaths || options.excludePaths) {
    lines.push('[paths]');
    if (options.includePaths) {
      lines.push(`include = [${options.includePaths.map((p) => `"${p}"`).join(', ')}]`);
    }
    if (options.excludePaths) {
      lines.push(`exclude = [${options.excludePaths.map((p) => `"${p}"`).join(', ')}]`);
    }
    lines.push('');
  }

  // Checks section (optional)
  if (options.fileLength || options.linters) {
    lines.push('[checks]');

    if (options.fileLength) {
      lines.push('[checks.file_length]');
      if (options.fileLength.maxLines) {
        lines.push(`max_lines = ${options.fileLength.maxLines}`);
      }
      if (options.fileLength.exclude) {
        lines.push(`exclude = [${options.fileLength.exclude.map((e) => `"${e}"`).join(', ')}]`);
      }
    }

    if (options.linters) {
      lines.push('[checks.linters]');
      for (const [linter, config] of Object.entries(options.linters)) {
        lines.push(`[checks.linters.${linter}]`);
        if (config.enabled !== undefined) {
          lines.push(`enabled = ${config.enabled}`);
        }
        if (config.configFile) {
          lines.push(`config_file = "${config.configFile}"`);
        }
        if (config.args) {
          lines.push(`args = [${config.args.map((a) => `"${a}"`).join(', ')}]`);
        }
      }
    }
    lines.push('');
  }

  // Output section (optional)
  if (options.outputFormat || options.outputColor !== undefined) {
    lines.push('[output]');
    if (options.outputFormat) {
      lines.push(`format = "${options.outputFormat}"`);
    }
    if (options.outputColor !== undefined) {
      lines.push(`color = ${options.outputColor}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Minimal valid config
 */
export function minimalConfig(overrides: Partial<ConfigOptions> = {}): string {
  return buildConfig({
    projectName: 'test-project',
    projectCategory: 'production',
    defaultRulesets: [],
    aiEnabled: false,
    ...overrides,
  });
}

/**
 * Config with default ruleset enabled
 */
export function configWithDefaultRules(overrides: Partial<ConfigOptions> = {}): string {
  return buildConfig({
    projectName: 'test-project',
    projectCategory: 'production',
    defaultRulesets: ['default'],
    aiEnabled: false,
    ...overrides,
  });
}

/**
 * Generate all category permutations
 */
export function* categoryPermutations(): Generator<{ category: ProjectCategory; config: string }> {
  for (const category of VALID_CATEGORIES) {
    yield {
      category,
      config: minimalConfig({ projectCategory: category }),
    };
  }
}

/**
 * Generate AI configuration permutations
 */
export function* aiPermutations(): Generator<{
  description: string;
  config: string;
  aiEnabled: boolean;
  agent?: AIAgent;
}> {
  // AI disabled
  yield {
    description: 'AI disabled',
    config: minimalConfig({ aiEnabled: false }),
    aiEnabled: false,
  };

  // AI enabled without agent
  yield {
    description: 'AI enabled without agent',
    config: minimalConfig({ aiEnabled: true }),
    aiEnabled: true,
  };

  // AI enabled with each agent
  for (const agent of VALID_AI_AGENTS) {
    yield {
      description: `AI enabled with ${agent}`,
      config: minimalConfig({ aiEnabled: true, aiAgent: agent }),
      aiEnabled: true,
      agent,
    };
  }
}

/**
 * Generate ruleset permutations
 */
export function* rulesetPermutations(): Generator<{
  description: string;
  config: string;
  rulesets: string[];
}> {
  // Empty rulesets
  yield {
    description: 'Empty rulesets',
    config: minimalConfig({ defaultRulesets: [] }),
    rulesets: [],
  };

  // Default ruleset only
  yield {
    description: 'Default ruleset only',
    config: configWithDefaultRules(),
    rulesets: ['default'],
  };

  // Multiple rulesets
  yield {
    description: 'Multiple rulesets',
    config: minimalConfig({
      defaultRulesets: ['default', 'community/general-best-practices@1.0.0'],
    }),
    rulesets: ['default', 'community/general-best-practices@1.0.0'],
  };
}

/**
 * Generate language-specific ruleset permutations
 */
export function* languageRulesetPermutations(): Generator<{
  description: string;
  config: string;
  languages: string[];
}> {
  // Python only
  yield {
    description: 'Python language ruleset',
    config: minimalConfig({
      defaultRulesets: ['default'],
      languageRulesets: {
        python: {
          paths: ['**/*.py'],
          rules: ['community/python-base@1.0.0'],
        },
      },
    }),
    languages: ['python'],
  };

  // TypeScript only
  yield {
    description: 'TypeScript language ruleset',
    config: minimalConfig({
      defaultRulesets: ['default'],
      languageRulesets: {
        typescript: {
          paths: ['**/*.ts', '**/*.tsx'],
          rules: ['community/typescript-base@1.0.0'],
        },
      },
    }),
    languages: ['typescript'],
  };

  // Multi-language
  yield {
    description: 'Multi-language rulesets',
    config: minimalConfig({
      defaultRulesets: ['default'],
      languageRulesets: {
        python: {
          paths: ['**/*.py'],
          rules: ['community/python-base@1.0.0'],
        },
        typescript: {
          paths: ['**/*.ts', '**/*.tsx'],
          rules: ['community/typescript-base@1.0.0'],
        },
      },
    }),
    languages: ['python', 'typescript'],
  };
}

// ============================================================
// Invalid Config Generators (for error testing)
// ============================================================

export interface InvalidConfigCase {
  description: string;
  config: string;
  expectedError: string | RegExp;
}

/**
 * Generate intentionally invalid configs for error testing
 */
export function getInvalidConfigs(): InvalidConfigCase[] {
  return [
    // Missing required sections
    {
      description: 'Missing project section',
      config: `
[rulesets]
default = []
`,
      expectedError: /Missing required field.*project/i,
    },
    {
      description: 'Missing rulesets section',
      config: `
[project]
name = "test"
category = "production"
`,
      expectedError: /Missing required field.*rulesets/i,
    },

    // Missing required fields
    {
      description: 'Missing project.name',
      config: `
[project]
category = "production"

[rulesets]
default = []
`,
      expectedError: /Missing required field.*name/i,
    },
    {
      description: 'Missing project.category',
      config: `
[project]
name = "test"

[rulesets]
default = []
`,
      expectedError: /Missing required field.*category/i,
    },
    {
      description: 'Missing rulesets.default',
      config: `
[project]
name = "test"
category = "production"

[rulesets]
# no default
`,
      expectedError: /Missing required field.*default/i,
    },

    // Invalid enum values
    {
      description: 'Invalid project category',
      config: `
[project]
name = "test"
category = "invalid-category"

[rulesets]
default = []
`,
      expectedError: /Invalid value.*category.*must be one of/i,
    },
    {
      description: 'Invalid AI agent',
      config: `
[project]
name = "test"
category = "production"

[rulesets]
default = []

[ai]
enabled = true
agent = "invalid-agent"
`,
      expectedError: /Invalid value.*agent.*must be one of/i,
    },

    // Invalid types
    {
      description: 'project.name is not a string',
      config: `
[project]
name = 123
category = "production"

[rulesets]
default = []
`,
      expectedError: /Invalid type.*name.*expected string/i,
    },
    {
      description: 'ai.enabled is not a boolean',
      config: `
[project]
name = "test"
category = "production"

[rulesets]
default = []

[ai]
enabled = "yes"
`,
      expectedError: /Invalid type.*enabled.*expected boolean/i,
    },
    {
      description: 'rulesets.default is not an array',
      config: `
[project]
name = "test"
category = "production"

[rulesets]
default = "default"
`,
      expectedError: /Invalid type.*default.*expected array/i,
    },

    // Invalid patterns
    {
      description: 'Invalid project name (starts with hyphen)',
      config: `
[project]
name = "-invalid"
category = "production"

[rulesets]
default = []
`,
      expectedError: /Invalid format.*name/i,
    },
    {
      description: 'Invalid project name (contains spaces)',
      config: `
[project]
name = "my project"
category = "production"

[rulesets]
default = []
`,
      expectedError: /Invalid format.*name/i,
    },

    // Invalid ranges
    {
      description: 'ai.max_tokens below minimum',
      config: `
[project]
name = "test"
category = "production"

[rulesets]
default = []

[ai]
enabled = true
max_tokens = 50
`,
      expectedError: /too small.*minimum 100/i,
    },
    {
      description: 'ai.max_tokens above maximum',
      config: `
[project]
name = "test"
category = "production"

[rulesets]
default = []

[ai]
enabled = true
max_tokens = 200000
`,
      expectedError: /too large.*maximum 100000/i,
    },

    // Additional/unknown properties
    {
      description: 'Unknown top-level section',
      config: `
[project]
name = "test"
category = "production"

[rulesets]
default = []

[unknown_section]
foo = "bar"
`,
      expectedError: /Unknown field/i,
    },
    {
      description: 'Unknown field in project section',
      config: `
[project]
name = "test"
category = "production"
unknown_field = "value"

[rulesets]
default = []
`,
      expectedError: /Unknown field.*unknown_field/i,
    },

    // Empty/blank required strings
    {
      description: 'Empty project name',
      config: `
[project]
name = ""
category = "production"

[rulesets]
default = []
`,
      expectedError: /too short|minLength/i,
    },
  ];
}

/**
 * Get a comprehensive test matrix combining multiple dimensions
 */
export function getTestMatrix(): {
  name: string;
  config: string;
  options: ConfigOptions;
}[] {
  const matrix: { name: string; config: string; options: ConfigOptions }[] = [];

  // Combine categories with ruleset configurations
  for (const category of VALID_CATEGORIES) {
    for (const rulesetType of ['empty', 'default', 'multiple'] as const) {
      const rulesets =
        rulesetType === 'empty'
          ? []
          : rulesetType === 'default'
            ? ['default']
            : ['default', 'community/general-best-practices@1.0.0'];

      const options: ConfigOptions = {
        projectCategory: category,
        defaultRulesets: rulesets,
        aiEnabled: false,
      };

      matrix.push({
        name: `${category}-${rulesetType}-rulesets`,
        config: buildConfig(options),
        options,
      });
    }
  }

  // Add AI permutations for production category
  for (const agent of VALID_AI_AGENTS) {
    const options: ConfigOptions = {
      projectCategory: 'production',
      defaultRulesets: ['default'],
      aiEnabled: true,
      aiAgent: agent,
    };

    matrix.push({
      name: `production-ai-${agent}`,
      config: buildConfig(options),
      options,
    });
  }

  return matrix;
}
