/**
 * Utility functions for MCP tools.
 */

import { stat } from "fs/promises";
import { glob } from "glob";
import { isAbsolute, relative, resolve } from "path";

import { ConfigError, findProjectRoot, loadConfig } from "../config/loader.js";
import { type Config } from "../types.js";
import { ErrorCode, type ErrorResponse, makeError } from "./response.js";
import { setConfigFound, setProjectRoot } from "./state.js";

/**
 * Discover files in a directory matching linter patterns
 */
export async function discoverFiles(
  targetPath: string,
  projectRoot: string,
): Promise<string[]> {
  const stats = await stat(targetPath).catch(() => null);

  if (!stats) {
    return [];
  }

  if (stats.isFile()) {
    return [relative(projectRoot, targetPath)];
  }

  const pattern = `${targetPath}/**/*.{ts,tsx,js,jsx,mjs,cjs,py,pyi}`;
  const foundFiles = await glob(pattern, {
    nodir: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/__pycache__/**",
      "**/.venv/**",
      "**/eslint.config.*",
      "**/ruff.toml",
      "**/pyproject.toml",
    ],
  });

  return foundFiles.map((f) => relative(projectRoot, f)).sort();
}

/**
 * Load and validate project configuration
 * @param searchPath - Optional path to start searching for cmc.toml from
 */
export async function loadProjectConfig(
  searchPath?: string,
): Promise<{ projectRoot: string; config: Config } | ErrorResponse> {
  try {
    const projectRoot = findProjectRoot(searchPath);
    setProjectRoot(projectRoot);

    const config = await loadConfig(projectRoot);
    setConfigFound(true);

    return { projectRoot, config };
  } catch (error) {
    setConfigFound(false);
    if (error instanceof ConfigError) {
      return makeError(ErrorCode.CONFIG_NOT_FOUND, error.message, false);
    }
    return makeError(ErrorCode.RUNTIME_ERROR, String(error), false);
  }
}

/**
 * Validate that files exist and return valid ones as relative paths.
 * @param files - Array of file paths (can be absolute or relative to cwd)
 * @param projectRoot - The project root directory (where cmc.toml is)
 * @param cwd - The current working directory to resolve relative paths from (defaults to process.cwd())
 */
export async function validateFiles(
  files: string[],
  projectRoot: string,
  cwd?: string,
): Promise<string[]> {
  const baseCwd = cwd ?? process.cwd();
  const validFiles: string[] = [];
  const checkPromises = files.map(async (file) => {
    // Resolve relative paths from cwd, not projectRoot
    // This ensures paths like "nested-paths/file.ts" work when MCP runs from parent directory
    const fullPath = isAbsolute(file) ? file : resolve(baseCwd, file);
    const stats = await stat(fullPath).catch(() => null);
    if (stats?.isFile()) {
      // Always return relative path from projectRoot
      return relative(projectRoot, fullPath);
    }
    return null;
  });

  const results = await Promise.all(checkPromises);
  for (const result of results) {
    if (result) {
      validFiles.push(result);
    }
  }

  return validFiles;
}
