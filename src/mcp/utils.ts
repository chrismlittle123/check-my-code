/**
 * Utility functions for MCP tools.
 */

import { stat } from "fs/promises";
import { glob } from "glob";
import { relative, resolve } from "path";

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
 * Validate that files exist and return valid ones
 */
export async function validateFiles(
  files: string[],
  projectRoot: string,
): Promise<string[]> {
  const validFiles: string[] = [];
  const checkPromises = files.map(async (file) => {
    const fullPath = resolve(projectRoot, file);
    const stats = await stat(fullPath).catch(() => null);
    if (stats?.isFile()) {
      return file;
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
