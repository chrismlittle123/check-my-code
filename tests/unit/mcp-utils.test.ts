/**
 * Unit tests for mcp/utils.ts
 * Tests utility functions for MCP tools, especially path handling.
 */

import { mkdir, rm, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadProjectConfig, validateFiles } from "../../src/mcp/utils.js";

describe("validateFiles", () => {
  const testDir = join(process.cwd(), "tests", "unit", ".test-fixtures");
  const projectRoot = testDir;
  const subDir = join(testDir, "subdir");

  beforeAll(async () => {
    // Create test directory structure
    await mkdir(subDir, { recursive: true });
    await writeFile(join(testDir, "file1.ts"), "const a = 1;");
    await writeFile(join(testDir, "file2.ts"), "const b = 2;");
    await writeFile(join(subDir, "nested.ts"), "const c = 3;");
  });

  afterAll(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe("relative paths", () => {
    it("validates relative files in project root", async () => {
      // Pass cwd=projectRoot so relative paths resolve correctly
      const result = await validateFiles(
        ["file1.ts", "file2.ts"],
        projectRoot,
        projectRoot,
      );

      expect(result).toHaveLength(2);
      expect(result).toContain("file1.ts");
      expect(result).toContain("file2.ts");
    });

    it("validates relative files in subdirectories", async () => {
      const result = await validateFiles(
        ["subdir/nested.ts"],
        projectRoot,
        projectRoot,
      );

      expect(result).toHaveLength(1);
      expect(result).toContain("subdir/nested.ts");
    });

    it("filters out nonexistent relative files", async () => {
      const result = await validateFiles(
        ["file1.ts", "nonexistent.ts"],
        projectRoot,
        projectRoot,
      );

      expect(result).toHaveLength(1);
      expect(result).toContain("file1.ts");
    });

    it("returns empty array for all nonexistent files", async () => {
      const result = await validateFiles(
        ["nonexistent1.ts", "nonexistent2.ts"],
        projectRoot,
        projectRoot,
      );

      expect(result).toHaveLength(0);
    });
  });

  describe("absolute paths", () => {
    it("validates absolute files and returns relative paths", async () => {
      const absolutePath = join(projectRoot, "file1.ts");
      const result = await validateFiles([absolutePath], projectRoot);

      expect(result).toHaveLength(1);
      // Result should be relative path, not absolute
      expect(result[0]).toBe("file1.ts");
      expect(result[0]).not.toMatch(/^\//);
    });

    it("validates absolute paths in subdirectories", async () => {
      const absolutePath = join(projectRoot, "subdir", "nested.ts");
      const result = await validateFiles([absolutePath], projectRoot);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("subdir/nested.ts");
    });

    it("handles mixed absolute and relative paths", async () => {
      const absolutePath = join(projectRoot, "file1.ts");
      const result = await validateFiles(
        [absolutePath, "file2.ts", "subdir/nested.ts"],
        projectRoot,
        projectRoot,
      );

      expect(result).toHaveLength(3);
      // All should be relative
      expect(result.every((p) => !p.startsWith("/"))).toBe(true);
      expect(result).toContain("file1.ts");
      expect(result).toContain("file2.ts");
      expect(result).toContain("subdir/nested.ts");
    });

    it("filters out nonexistent absolute paths", async () => {
      const validPath = join(projectRoot, "file1.ts");
      const invalidPath = join(projectRoot, "nonexistent.ts");
      const result = await validateFiles([validPath, invalidPath], projectRoot);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("file1.ts");
    });

    it("rejects files outside project root (path traversal protection)", async () => {
      // Create a temp file outside project root
      const outsideDir = join(testDir, "..", ".outside-test");
      await mkdir(outsideDir, { recursive: true });
      await writeFile(join(outsideDir, "outside.ts"), "const d = 4;");

      try {
        const outsidePath = resolve(join(outsideDir, "outside.ts"));
        const result = await validateFiles([outsidePath], projectRoot);

        // Security: Files outside project root should be rejected
        expect(result).toHaveLength(0);
      } finally {
        await rm(outsideDir, { recursive: true, force: true });
      }
    });

    it("rejects relative paths that traverse outside project root", async () => {
      // Create a temp file outside project root
      const outsideDir = join(testDir, "..", ".outside-test");
      await mkdir(outsideDir, { recursive: true });
      await writeFile(join(outsideDir, "outside.ts"), "const d = 4;");

      try {
        // Try path traversal via relative path
        const result = await validateFiles(
          ["../.outside-test/outside.ts"],
          projectRoot,
          projectRoot,
        );

        // Security: Path traversal should be rejected
        expect(result).toHaveLength(0);
      } finally {
        await rm(outsideDir, { recursive: true, force: true });
      }
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty input", async () => {
      const result = await validateFiles([], projectRoot);
      expect(result).toHaveLength(0);
    });

    it("handles paths with trailing slashes", async () => {
      const result = await validateFiles(
        ["file1.ts/"],
        projectRoot,
        projectRoot,
      );
      // Node.js resolve normalizes trailing slashes, so file1.ts/ -> file1.ts
      expect(result).toHaveLength(1);
      expect(result[0]).toBe("file1.ts");
    });
  });
});

describe("loadProjectConfig", () => {
  describe("path traversal protection", () => {
    it("rejects path traversal attacks via searchPath", async () => {
      // Attempt path traversal to system directories
      const result = await loadProjectConfig("../../../../../../etc/passwd");

      // Should return an error response, not attempt to process the path
      expect(result).toHaveProperty("error");
      if ("error" in result) {
        expect(result.error.message).toContain("path traversal");
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("rejects relative paths that escape cwd", async () => {
      const result = await loadProjectConfig("../../../some-other-project");

      expect(result).toHaveProperty("error");
      if ("error" in result) {
        expect(result.error.message).toContain("path traversal");
      }
    });

    it("allows valid subdirectory paths", async () => {
      // Use a test directory with cmc.toml
      const testDir = join(process.cwd(), "tests", "e2e", "projects", "check");

      const result = await loadProjectConfig(testDir);

      // Should succeed (or fail with config-related error, but NOT path traversal)
      if ("error" in result) {
        expect(result.error.message).not.toContain("path traversal");
      }
    });
  });
});
