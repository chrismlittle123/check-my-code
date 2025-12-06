/**
 * Unit tests for config/loader.ts
 * BUG-002: Tests for findProjectRoot path parameter
 */

import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findProjectRoot } from "../../src/config/loader.js";

describe("findProjectRoot", () => {
  const testDir = join(tmpdir(), "cmc-test-" + Date.now());
  const nestedDir = join(testDir, "sub", "nested");

  beforeEach(() => {
    // Create test directory structure
    mkdirSync(nestedDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    rmSync(testDir, { recursive: true, force: true });
  });

  it("finds cmc.toml in the given directory", () => {
    writeFileSync(join(testDir, "cmc.toml"), '[project]\nname = "test"');

    const result = findProjectRoot(testDir);
    expect(result).toBe(testDir);
  });

  it("finds cmc.toml in parent directory when starting from nested path", () => {
    writeFileSync(join(testDir, "cmc.toml"), '[project]\nname = "test"');

    const result = findProjectRoot(nestedDir);
    expect(result).toBe(testDir);
  });

  it("finds cmc.toml starting from a file path", () => {
    writeFileSync(join(testDir, "cmc.toml"), '[project]\nname = "test"');
    const filePath = join(nestedDir, "somefile.ts");
    writeFileSync(filePath, "const x = 1;");

    const result = findProjectRoot(filePath);
    expect(result).toBe(testDir);
  });

  it("returns startPath when no cmc.toml found", () => {
    // No cmc.toml created
    const result = findProjectRoot(nestedDir);
    expect(result).toBe(nestedDir);
  });

  it("defaults to process.cwd() when no startPath provided", () => {
    const result = findProjectRoot();
    // Should not throw, returns cwd or finds cmc.toml from cwd
    expect(typeof result).toBe("string");
  });
});
