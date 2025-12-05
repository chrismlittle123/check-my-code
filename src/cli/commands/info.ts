import { Command } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parse as parseYaml } from "yaml";

interface Compatibility {
  languages: Record<
    string,
    {
      version: string;
      linter: string;
      file_extensions: string[];
    }
  >;
  runtime: Record<string, { version: string }>;
  linters: Record<
    string,
    {
      description: string;
      install: string;
    }
  >;
}

function loadCompatibility(): Compatibility {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const compatPath = join(__dirname, "../../../compatibility.yaml");
  const content = readFileSync(compatPath, "utf-8");
  return parseYaml(content) as Compatibility;
}

function formatOutput(compat: Compatibility, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(compat, null, 2));
    return;
  }

  console.log("check-my-code (cmc) - Supported Languages & Tools\n");

  // Languages
  console.log("Languages:");
  for (const [name, lang] of Object.entries(compat.languages)) {
    const extensions = lang.file_extensions.join(", ");
    console.log(`  ${name} ${lang.version}`);
    console.log(`    Linter: ${lang.linter}`);
    console.log(`    Extensions: ${extensions}`);
  }

  // Runtime
  console.log("\nRuntime:");
  for (const [name, runtime] of Object.entries(compat.runtime)) {
    console.log(`  ${name} >= ${runtime.version}`);
  }

  // Linters
  console.log("\nLinters:");
  for (const [name, linter] of Object.entries(compat.linters)) {
    console.log(`  ${name}`);
    console.log(`    ${linter.description}`);
    console.log(`    Install: ${linter.install}`);
  }
}

export const infoCommand = new Command("info")
  .description("Display supported languages, runtimes, and linters")
  .option("--json", "Output as JSON", false)
  .addHelpText(
    "after",
    `
Examples:
  $ cmc info              Show supported tools and versions
  $ cmc info --json       Output as JSON`,
  )
  .action((options: { json?: boolean }) => {
    const compat = loadCompatibility();
    formatOutput(compat, options.json ?? false);
  });
