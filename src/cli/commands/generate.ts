import { Command } from "commander";
import { existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { dirname, join } from "path";

import {
  ConfigError,
  findProjectRoot,
  loadConfig,
} from "../../config/loader.js";
import { ConfigFetchError, fetchClaudeSettings } from "../../remote/configs.js";
import { type InheritedRules } from "../../remote/rulesets.js";
import {
  type ClaudeSettings,
  type Config,
  DEFAULT_CLAUDE_SETTINGS_SOURCE,
  ExitCode,
  type TscConfig,
} from "../../types.js";
import { colors } from "../output.js";

type LinterTarget = "eslint" | "ruff" | "tsc";
type GenerateTarget = LinterTarget | "claude";

// Extended config type that includes inheritance info
type ConfigWithInherited = Config & { _inherited?: InheritedRules };

const LINTER_CONFIGS: Record<
  LinterTarget,
  { filename: string; generator: (config: ConfigWithInherited) => string }
> = {
  eslint: {
    filename: "eslint.config.js",
    generator: generateESLintConfig,
  },
  ruff: {
    filename: "ruff.toml",
    generator: generateRuffConfig,
  },
  tsc: {
    filename: "tsconfig.json",
    generator: generateTscConfig,
  },
};

const CLAUDE_CONFIG = {
  filename: ".claude/settings.json",
};

export const generateCommand = new Command("generate")
  .description("Generate config files from cmc.toml")
  .argument(
    "<target>",
    "Target to generate config for (eslint, ruff, tsc, claude)",
  )
  .option("--force", "Overwrite existing config file", false)
  .option("--stdout", "Output to stdout instead of file", false)
  .addHelpText(
    "after",
    `
Examples:
  $ cmc generate eslint          Generate eslint.config.js
  $ cmc generate ruff            Generate ruff.toml
  $ cmc generate tsc             Generate tsconfig.json
  $ cmc generate claude          Generate .claude/settings.json
  $ cmc generate eslint --force  Overwrite existing config
  $ cmc generate eslint --stdout Preview config without writing`,
  )
  .action(
    async (target: string, options: { force?: boolean; stdout?: boolean }) => {
      try {
        await runGenerate(target, options);
      } catch (error) {
        handleGenerateError(error);
      }
    },
  );

interface GenerateOptions {
  force?: boolean;
  stdout?: boolean;
}

async function runGenerate(
  targetArg: string,
  options: GenerateOptions,
): Promise<void> {
  const target = validateTarget(targetArg);
  const projectRoot = findProjectRoot();
  const config = await loadConfig(projectRoot);

  // Handle Claude settings separately (async remote fetch)
  if (target === "claude") {
    await runGenerateClaude(projectRoot, config, options);
    return;
  }

  const { filename, generator } = LINTER_CONFIGS[target];
  const content = generator(config);

  if (options.stdout) {
    console.log(content);
    process.exit(ExitCode.SUCCESS);
  }

  await writeConfigFile(projectRoot, filename, content, options.force ?? false);
}

function validateClaudeConfig(config: Config): string {
  const extendsRef = config.ai?.claude?.extends;
  if (!extendsRef) {
    throw new ConfigError(
      `No [ai.claude] configuration found in cmc.toml.\n\n` +
        `Add the following to enable Claude settings generation:\n` +
        `  [ai.claude]\n` +
        `  extends = "${DEFAULT_CLAUDE_SETTINGS_SOURCE}"`,
    );
  }
  return extendsRef;
}

function ensureClaudeDir(projectRoot: string): void {
  const outputDir = dirname(join(projectRoot, CLAUDE_CONFIG.filename));
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
}

async function runGenerateClaude(
  projectRoot: string,
  config: Config,
  options: GenerateOptions,
): Promise<void> {
  const extendsRef = validateClaudeConfig(config);
  const settings = await fetchClaudeSettings(extendsRef);
  const content = generateClaudeSettings(settings, extendsRef);

  if (options.stdout) {
    console.log(content);
    process.exit(ExitCode.SUCCESS);
  }

  const filename = CLAUDE_CONFIG.filename;
  const outputPath = join(projectRoot, filename);

  ensureClaudeDir(projectRoot);

  if (existsSync(outputPath) && !options.force) {
    console.error(
      colors.yellow(
        `Error: ${filename} already exists. Use --force to overwrite.`,
      ),
    );
    process.exit(ExitCode.CONFIG_ERROR);
  }

  await writeFile(outputPath, content, "utf-8");
  console.log(colors.green(`✓ Generated ${filename}`));
  process.exit(ExitCode.SUCCESS);
}

async function writeConfigFile(
  projectRoot: string,
  filename: string,
  content: string,
  force: boolean,
): Promise<void> {
  const outputPath = join(projectRoot, filename);

  if (existsSync(outputPath) && !force) {
    console.error(
      colors.yellow(
        `Error: ${filename} already exists. Use --force to overwrite.`,
      ),
    );
    process.exit(ExitCode.CONFIG_ERROR);
  }

  await writeFile(outputPath, content, "utf-8");
  console.log(colors.green(`✓ Generated ${filename}`));
  process.exit(ExitCode.SUCCESS);
}

function handleGenerateError(error: unknown): never {
  console.error(
    colors.red(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    ),
  );
  if (error instanceof ConfigError || error instanceof ConfigFetchError) {
    process.exit(ExitCode.CONFIG_ERROR);
  }
  process.exit(ExitCode.RUNTIME_ERROR);
}

function validateTarget(target: string): GenerateTarget {
  const normalized = target.toLowerCase();
  if (
    normalized !== "eslint" &&
    normalized !== "ruff" &&
    normalized !== "tsc" &&
    normalized !== "claude"
  ) {
    throw new Error(
      `Unknown target: ${target}. Supported targets: eslint, ruff, tsc, claude`,
    );
  }
  return normalized;
}

function generateESLintConfig(config: ConfigWithInherited): string {
  const rules = config.rulesets?.eslint?.rules ?? {};
  const hasRules = Object.keys(rules).length > 0;
  const extendsSource = config._inherited?.eslint?.source;

  let rulesBlock: string;
  if (hasRules) {
    const rulesJson = JSON.stringify(rules, null, 2);
    // Indent each line (except first) by 4 spaces to align inside the rules object
    const lines = rulesJson.split("\n");
    rulesBlock = `${lines[0]}\n${lines
      .slice(1)
      .map((line) => `    ${line}`)
      .join("\n")}`;
  } else {
    rulesBlock = "{}";
  }

  const headerLines = ["// Generated by cmc (check-my-code)"];
  if (extendsSource) {
    headerLines.push(`// Extends: ${extendsSource}`);
  }
  headerLines.push(
    "// Do not edit manually - regenerate with: cmc generate eslint",
  );

  return `${headerLines.join("\n")}

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: ${rulesBlock},
  }
);
`;
}

function buildRuffHeader(extendsSource?: string): string[] {
  const lines = ["# Generated by cmc (check-my-code)"];
  if (extendsSource) lines.push(`# Extends: ${extendsSource}`);
  lines.push("# Do not edit manually - regenerate with: cmc generate ruff", "");
  return lines;
}

function buildRuffBody(
  ruffConfig: NonNullable<ConfigWithInherited["rulesets"]>["ruff"],
): string[] {
  if (!ruffConfig) return ["# No ruff configuration defined in cmc.toml"];

  const lines: string[] = [];
  if (ruffConfig["line-length"] !== undefined) {
    lines.push(`line-length = ${ruffConfig["line-length"]}`);
  }

  if (ruffConfig.lint) {
    lines.push("", "[lint]");
    if (ruffConfig.lint.select?.length)
      lines.push(`select = ${JSON.stringify(ruffConfig.lint.select)}`);
    if (ruffConfig.lint.ignore?.length)
      lines.push(`ignore = ${JSON.stringify(ruffConfig.lint.ignore)}`);
  }

  return lines;
}

function generateRuffConfig(config: ConfigWithInherited): string {
  const header = buildRuffHeader(config._inherited?.ruff?.source);
  const body = buildRuffBody(config.rulesets?.ruff);
  return `${[...header, ...body].join("\n")}\n`;
}

const TSC_BOOLEAN_OPTIONS = [
  "strict",
  "noImplicitAny",
  "strictNullChecks",
  "strictFunctionTypes",
  "strictBindCallApply",
  "strictPropertyInitialization",
  "noImplicitThis",
  "alwaysStrict",
  "noUncheckedIndexedAccess",
  "noImplicitReturns",
  "noFallthroughCasesInSwitch",
  "noUnusedLocals",
  "noUnusedParameters",
  "exactOptionalPropertyTypes",
  "noImplicitOverride",
  "allowUnusedLabels",
  "allowUnreachableCode",
] as const;

function buildTscCompilerOptions(
  tscConfig?: TscConfig,
): Record<string, unknown> {
  const options: Record<string, unknown> = {
    target: "ES2020",
    module: "ESNext",
    moduleResolution: "node",
    esModuleInterop: true,
    skipLibCheck: true,
    noEmit: true,
  };

  if (tscConfig) {
    for (const opt of TSC_BOOLEAN_OPTIONS) {
      if (tscConfig[opt] !== undefined) options[opt] = tscConfig[opt];
    }
  }
  return options;
}

function buildTscComment(extendsSource?: string): string {
  const base = "Generated by cmc (check-my-code)";
  const ext = extendsSource ? ` - Extends: ${extendsSource}` : "";
  return `${base}${ext} - regenerate with: cmc generate tsc`;
}

function generateTscConfig(config: ConfigWithInherited): string {
  const output = {
    $schema: "https://json.schemastore.org/tsconfig",
    _comment: buildTscComment(config._inherited?.tsc?.source),
    compilerOptions: buildTscCompilerOptions(config.rulesets?.tsc),
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  };
  return `${JSON.stringify(output, null, 2)}\n`;
}

function generateClaudeSettings(
  settings: ClaudeSettings,
  extendsSource: string,
): string {
  const output = {
    $schema:
      "https://raw.githubusercontent.com/anthropics/claude-code/main/.claude/settings-schema.json",
    _comment: `Generated by cmc (check-my-code) - Extends: ${extendsSource} - regenerate with: cmc generate claude`,
    ...settings,
  };
  // Remove the original $schema if present (we add our own)
  delete (output as Record<string, unknown>).$schema;
  return `${JSON.stringify(
    {
      $schema:
        "https://raw.githubusercontent.com/anthropics/claude-code/main/.claude/settings-schema.json",
      _comment: output._comment,
      permissions: output.permissions,
      env: output.env,
    },
    null,
    2,
  )}\n`;
}
