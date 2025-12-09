/**
 * E2E tests for `[extends]` config inheritance feature.
 *
 * Note: Full remote fetching tests require network access and are skipped
 * by default. The unit tests in tests/unit/rulesets.test.ts cover the
 * merge logic comprehensively.
 */

import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { run } from "./runner.js";

const PROJECTS_DIR = join(process.cwd(), "tests", "e2e", "projects");
const TEST_PROJECT_DIR = join(PROJECTS_DIR, "extends-temp");

describe("cmc extends - config validation", () => {
  beforeEach(async () => {
    await mkdir(TEST_PROJECT_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_PROJECT_DIR, { recursive: true, force: true });
  });

  it("validates extends format in cmc.toml", async () => {
    // Invalid extends format
    await writeFile(
      join(TEST_PROJECT_DIR, "cmc.toml"),
      `[project]
name = "test"

[extends]
eslint = "invalid-format"
`,
    );

    const result = await run("extends-temp", ["check"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      "must be format: github:owner/repo/path@version",
    );
  });

  it("accepts valid extends format", async () => {
    // Valid format but non-existent repo - should error on fetch, not parse
    await writeFile(
      join(TEST_PROJECT_DIR, "cmc.toml"),
      `[project]
name = "test"

[extends]
eslint = "github:nonexistent/repo/rulesets/path@v1.0.0"
`,
    );

    const result = await run("extends-temp", ["check"]);

    // Should fail on fetch, not on config parse
    expect(result.exitCode).toBe(2);
    // Error should mention fetch failure, not format validation
    expect(result.stderr).not.toContain("must be format");
  });

  it("works without extends section", async () => {
    await writeFile(
      join(TEST_PROJECT_DIR, "cmc.toml"),
      `[project]
name = "test"

[rulesets.eslint.rules]
"no-var" = "error"
`,
    );

    // Create a test file
    await writeFile(
      join(TEST_PROJECT_DIR, "test.ts"),
      `const x = 1;
export { x };
`,
    );

    const result = await run("extends-temp", ["check", "--json"]);

    // Should work without extends
    expect(result.exitCode).toBe(0);
  });

  it("validates all extends entries", async () => {
    await writeFile(
      join(TEST_PROJECT_DIR, "cmc.toml"),
      `[project]
name = "test"

[extends]
eslint = "github:org/repo/path@v1.0.0"
tsc = "invalid-format"
`,
    );

    const result = await run("extends-temp", ["check"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("must be format");
  });
});

describe("cmc extends - generate command", () => {
  beforeEach(async () => {
    await mkdir(TEST_PROJECT_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_PROJECT_DIR, { recursive: true, force: true });
  });

  it("generates config with local rules when no extends", async () => {
    await writeFile(
      join(TEST_PROJECT_DIR, "cmc.toml"),
      `[project]
name = "test"

[rulesets.eslint.rules]
"no-var" = "error"
"prefer-const" = "error"
`,
    );

    const result = await run("extends-temp", [
      "generate",
      "eslint",
      "--stdout",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("no-var");
    expect(result.stdout).toContain("prefer-const");
    expect(result.stdout).not.toContain("Extends:");
  });

  it("generates TSC config with local settings when no extends", async () => {
    await writeFile(
      join(TEST_PROJECT_DIR, "cmc.toml"),
      `[project]
name = "test"

[rulesets.tsc]
strict = true
noUncheckedIndexedAccess = true
`,
    );

    const result = await run("extends-temp", ["generate", "tsc", "--stdout"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"strict": true');
    expect(result.stdout).toContain('"noUncheckedIndexedAccess": true');
    expect(result.stdout).not.toContain("Extends:");
  });

  it("generates Ruff config with local settings when no extends", async () => {
    await writeFile(
      join(TEST_PROJECT_DIR, "cmc.toml"),
      `[project]
name = "test"

[rulesets.ruff]
line-length = 100

[rulesets.ruff.lint]
select = ["E", "F"]
`,
    );

    const result = await run("extends-temp", ["generate", "ruff", "--stdout"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("line-length = 100");
    expect(result.stdout).toContain('["E","F"]');
    expect(result.stdout).not.toContain("Extends:");
  });
});

describe("cmc extends - audit command", () => {
  beforeEach(async () => {
    await mkdir(TEST_PROJECT_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_PROJECT_DIR, { recursive: true, force: true });
  });

  it("audits local rules when no extends", async () => {
    await writeFile(
      join(TEST_PROJECT_DIR, "cmc.toml"),
      `[project]
name = "test"

[rulesets.tsc]
strict = true
`,
    );

    // Create matching tsconfig.json
    await writeFile(
      join(TEST_PROJECT_DIR, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            strict: true,
          },
        },
        null,
        2,
      ),
    );

    const result = await run("extends-temp", ["audit", "tsc"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("matches");
  });

  it("detects mismatches in local rules", async () => {
    await writeFile(
      join(TEST_PROJECT_DIR, "cmc.toml"),
      `[project]
name = "test"

[rulesets.tsc]
strict = true
`,
    );

    // Create non-matching tsconfig.json
    await writeFile(
      join(TEST_PROJECT_DIR, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            strict: false,
          },
        },
        null,
        2,
      ),
    );

    const result = await run("extends-temp", ["audit", "tsc"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("different value");
  });
});

// Skip network-dependent tests by default
// These can be run manually with: npm run test:run -- --grep "remote"
describe.skip("cmc extends - remote inheritance (requires network)", () => {
  it("fetches and merges remote ESLint rules", async () => {
    // This test would require a real remote repo with rulesets
    // For now, the unit tests cover the merge logic
  });

  it("detects conflict between remote and local rules", async () => {
    // This test would require a real remote repo with rulesets
  });

  it("includes extends source in generated config comment", async () => {
    // This test would require a real remote repo with rulesets
  });
});
