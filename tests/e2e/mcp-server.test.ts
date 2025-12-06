/**
 * E2E tests for `cmc mcp-server` command
 */

import { join } from "path";
import { describe, expect, it } from "vitest";

import { runMcp, runMcpFromCwd, runMcpListTools } from "./runner.js";

const ROOT_DIR = process.cwd();

function parseToolContent(response: unknown): unknown {
  const r = response as {
    result?: { content?: { type: string; text: string }[] };
  };
  if (!r?.result?.content?.[0]?.text) return null;
  try {
    return JSON.parse(r.result.content[0].text);
  } catch {
    return null;
  }
}

describe("cmc mcp-server - tools/list", () => {
  it("lists all available tools", async () => {
    const result = await runMcpListTools("mcp-server/default");

    expect(result.tools.length).toBeGreaterThan(0);
    const toolNames = result.tools.map((t) => t.name);

    expect(toolNames).toContain("check_files");
    expect(toolNames).toContain("check_project");
    expect(toolNames).toContain("fix_files");
    expect(toolNames).toContain("get_status");
    expect(toolNames).toContain("validate_config");
  });
});

describe("cmc mcp-server - check_files", () => {
  it("detects violations in specified files", async () => {
    const result = await runMcp("mcp-server/default", "check_files", {
      files: ["violation.ts"],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { rule: string; linter: string }[];
      has_violations: boolean;
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);
    expect(content.violations.some((v) => v.rule === "no-var")).toBe(true);
  });

  it("returns no violations for clean files", async () => {
    const result = await runMcp("mcp-server/default", "check_files", {
      files: ["clean.ts"],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      has_violations: boolean;
    };

    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(false);
  });

  it("returns error for nonexistent files", async () => {
    const result = await runMcp("mcp-server/default", "check_files", {
      files: ["nonexistent.ts"],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      error?: { code: string };
    };

    expect(content.success).toBe(false);
    expect(content.error?.code).toBe("FILE_NOT_FOUND");
  });
});

describe("cmc mcp-server - check_project", () => {
  it("checks entire project", async () => {
    const result = await runMcp("mcp-server/default", "check_project", {});

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { linter: string }[];
      has_violations: boolean;
    };

    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);

    const eslintViolations = content.violations.filter(
      (v) => v.linter === "eslint",
    );
    const ruffViolations = content.violations.filter(
      (v) => v.linter === "ruff",
    );

    expect(eslintViolations.length).toBeGreaterThan(0);
    expect(ruffViolations.length).toBeGreaterThan(0);
  });
});

describe("cmc mcp-server - get_status", () => {
  it("returns session status", async () => {
    const result = await runMcp("mcp-server/default", "get_status", {});

    const content = parseToolContent(result.response) as {
      success: boolean;
      config_found: boolean;
      session_stats: { files_checked: number };
    };

    expect(content.success).toBe(true);
    expect(content.config_found).toBe(true);
    expect(content.session_stats).toBeDefined();
  });
});

describe("cmc mcp-server - validate_config", () => {
  it("validates correct TOML config", async () => {
    const validConfig = `[project]
name = "my-project"

[rulesets.eslint.rules]
"no-console" = "warn"
`;

    const result = await runMcp("mcp-server/default", "validate_config", {
      config: validConfig,
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      validated: boolean;
      parsed: { project: { name: string } };
    };

    expect(content.success).toBe(true);
    expect(content.validated).toBe(true);
    expect(content.parsed.project.name).toBe("my-project");
  });

  it("returns error for invalid TOML syntax", async () => {
    const invalidToml = `[project
name = "missing bracket"`;

    const result = await runMcp("mcp-server/default", "validate_config", {
      config: invalidToml,
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      error?: { code: string };
    };

    expect(content.success).toBe(false);
    expect(content.error?.code).toBe("VALIDATION_ERROR");
  });

  it("returns error for missing required fields", async () => {
    const missingName = `[project]
# name is missing
`;

    const result = await runMcp("mcp-server/default", "validate_config", {
      config: missingName,
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      error?: { code: string };
    };

    expect(content.success).toBe(false);
    expect(content.error?.code).toBe("VALIDATION_ERROR");
  });
});

// =============================================================================
// BUG-002: Path context for config discovery
// =============================================================================
describe("cmc mcp-server - path-based config discovery", () => {
  it("check_project accepts subdirectory path", async () => {
    // When path is provided, the tool should look for cmc.toml from that path
    const result = await runMcp("mcp-server/default", "check_project", {
      path: ".",
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      files_checked: number;
    };

    expect(content.success).toBe(true);
    expect(content.files_checked).toBeGreaterThan(0);
  });
});

// =============================================================================
// BUG: check_files absolute path handling
// https://github.com/anthropics/claude-code/issues/XXX
// =============================================================================
describe("cmc mcp-server - check_files absolute paths", () => {
  it("accepts absolute paths and returns violations", async () => {
    // Use absolute path to the violation file
    const projectDir = process.cwd();
    const absolutePath = `${projectDir}/tests/e2e/projects/mcp-server/default/violation.ts`;

    const result = await runMcp("mcp-server/default", "check_files", {
      files: [absolutePath],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { rule: string; linter: string; file: string }[];
      has_violations: boolean;
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);
    // Should detect the no-var violation
    expect(content.violations.some((v) => v.rule === "no-var")).toBe(true);
    // File path in results should be relative, not absolute
    expect(content.violations[0].file).not.toMatch(/^\//);
  });

  it("handles mixed absolute and relative paths", async () => {
    const projectDir = process.cwd();
    const absolutePath = `${projectDir}/tests/e2e/projects/mcp-server/default/violation.ts`;

    const result = await runMcp("mcp-server/default", "check_files", {
      files: [absolutePath, "clean.ts"],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      files_checked: number;
      violations: { file: string }[];
    };

    expect(content.success).toBe(true);
    expect(content.files_checked).toBe(2);
    // All file paths in results should be relative
    content.violations.forEach((v) => {
      expect(v.file).not.toMatch(/^\//);
    });
  });

  it("returns FILE_NOT_FOUND for nonexistent absolute path within project", async () => {
    // Use an absolute path within the project directory that doesn't exist
    // This ensures cmc.toml can be found, but the file itself doesn't exist
    const projectDir = process.cwd();
    const absolutePath = `${projectDir}/tests/e2e/projects/mcp-server/default/nonexistent.ts`;

    const result = await runMcp("mcp-server/default", "check_files", {
      files: [absolutePath],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      error?: { code: string };
    };

    expect(content.success).toBe(false);
    expect(content.error?.code).toBe("FILE_NOT_FOUND");
  });
});

// =============================================================================
// BUG: check_files fails when MCP server cwd differs from project root
// This reproduces the real-world scenario where:
// 1. MCP server is started from a parent directory (e.g., user's home or workspace root)
// 2. User provides relative paths to files in a project subdirectory
// 3. The paths should be resolved correctly to find cmc.toml and lint files
// =============================================================================
describe("cmc mcp-server - check_files cross-directory paths (BUG FIX)", () => {
  const nestedProjectDir = join(
    ROOT_DIR,
    "tests/e2e/projects/mcp-server/nested-paths",
  );

  it("finds files with relative path when MCP runs from project root", async () => {
    // Run MCP from the nested project directory, use relative path
    const result = await runMcpFromCwd(nestedProjectDir, "check_files", {
      files: ["root-file.ts"],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { rule: string; file: string }[];
      has_violations: boolean;
      error?: { code: string; message: string };
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);
    expect(content.violations.some((v) => v.rule === "no-var")).toBe(true);
  });

  it("finds files in subdirectory with relative path", async () => {
    const result = await runMcpFromCwd(nestedProjectDir, "check_files", {
      files: ["subdir/nested-file.ts"],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { rule: string; file: string }[];
      has_violations: boolean;
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);
    expect(content.violations.some((v) => v.rule === "no-var")).toBe(true);
    // File path in result should be relative
    expect(content.violations[0].file).toBe("subdir/nested-file.ts");
  });

  it("finds files with absolute path", async () => {
    const absolutePath = join(nestedProjectDir, "root-file.ts");
    const result = await runMcpFromCwd(nestedProjectDir, "check_files", {
      files: [absolutePath],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { rule: string; file: string }[];
      has_violations: boolean;
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);
    // Result should have relative path, not absolute
    expect(content.violations[0].file).toBe("root-file.ts");
    expect(content.violations[0].file).not.toMatch(/^\//);
  });

  it("finds files when MCP runs from PARENT directory with relative project path", async () => {
    // This is the KEY bug scenario:
    // MCP server runs from tests/e2e/projects/mcp-server (parent of nested-paths)
    // User provides path relative to that parent: nested-paths/root-file.ts
    const parentDir = join(ROOT_DIR, "tests/e2e/projects/mcp-server");

    const result = await runMcpFromCwd(parentDir, "check_files", {
      files: ["nested-paths/root-file.ts"],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { rule: string; file: string }[];
      has_violations: boolean;
      error?: { code: string; message: string };
    };

    expect(content).not.toBeNull();
    // This is the bug: should succeed but currently fails with FILE_NOT_FOUND
    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);
    expect(content.violations.some((v) => v.rule === "no-var")).toBe(true);
  });

  it("finds nested subdir files when MCP runs from parent directory", async () => {
    const parentDir = join(ROOT_DIR, "tests/e2e/projects/mcp-server");

    const result = await runMcpFromCwd(parentDir, "check_files", {
      files: ["nested-paths/subdir/nested-file.ts"],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { rule: string; file: string }[];
      has_violations: boolean;
      error?: { code: string; message: string };
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);
  });

  it("finds files with absolute path when MCP runs from different directory", async () => {
    // MCP runs from parent, but file path is absolute
    const parentDir = join(ROOT_DIR, "tests/e2e/projects/mcp-server");
    const absolutePath = join(nestedProjectDir, "root-file.ts");

    const result = await runMcpFromCwd(parentDir, "check_files", {
      files: [absolutePath],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { rule: string; file: string }[];
      has_violations: boolean;
      error?: { code: string; message: string };
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);
    // File path should NOT have leading slash stripped causing "No such file" error
    expect(
      content.violations.every(
        (v) => !v.file.includes("No such file or directory"),
      ),
    ).toBe(true);
  });

  it("returns proper FILE_NOT_FOUND for actually nonexistent relative paths", async () => {
    const result = await runMcpFromCwd(nestedProjectDir, "check_files", {
      files: ["nonexistent.ts"],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      error?: { code: string };
    };

    expect(content.success).toBe(false);
    expect(content.error?.code).toBe("FILE_NOT_FOUND");
  });
});
