import { existsSync, readFileSync } from "fs";
import { join } from "path";

import type { RequiredTool } from "../types.js";

export interface ToolCheckResult {
  configured: boolean;
  reason?: string;
}

export interface ToolChecker {
  name: RequiredTool;
  check: (projectRoot: string) => ToolCheckResult;
}

/**
 * Check if a pyproject.toml contains a specific [tool.X] section
 */
function pyprojectHasToolSection(
  projectRoot: string,
  toolName: string,
): boolean {
  const pyprojectPath = join(projectRoot, "pyproject.toml");
  if (!existsSync(pyprojectPath)) return false;

  const content = readFileSync(pyprojectPath, "utf-8");
  // Check for [tool.toolName] section
  const pattern = new RegExp(`\\[tool\\.${toolName}\\]`, "i");
  return pattern.test(content);
}

/**
 * Check if package.json contains a specific key
 */
function packageJsonHasKey(projectRoot: string, key: string): boolean {
  const packageJsonPath = join(projectRoot, "package.json");
  if (!existsSync(packageJsonPath)) return false;

  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content) as Record<string, unknown>;
    return key in pkg;
  } catch {
    return false;
  }
}

/**
 * Check if any of the given files exist in the project root
 */
function anyFileExists(projectRoot: string, files: string[]): string | null {
  for (const file of files) {
    if (existsSync(join(projectRoot, file))) {
      return file;
    }
  }
  return null;
}

// Tool checker implementations
const tyChecker: ToolChecker = {
  name: "ty",
  check: (projectRoot: string): ToolCheckResult => {
    if (pyprojectHasToolSection(projectRoot, "ty")) {
      return { configured: true };
    }
    return {
      configured: false,
      reason: "No pyproject.toml with [tool.ty] section found",
    };
  },
};

const gitleaksChecker: ToolChecker = {
  name: "gitleaks",
  check: (projectRoot: string): ToolCheckResult => {
    const configFiles = [".gitleaks.toml", ".gitleaks.yaml", ".gitleaks.yml"];
    const found = anyFileExists(projectRoot, configFiles);
    if (found) {
      return { configured: true };
    }
    return {
      configured: false,
      reason: "No .gitleaks.toml, .gitleaks.yaml, or .gitleaks.yml found",
    };
  },
};

const npmAuditChecker: ToolChecker = {
  name: "npm-audit",
  check: (projectRoot: string): ToolCheckResult => {
    if (existsSync(join(projectRoot, "package.json"))) {
      return { configured: true };
    }
    return {
      configured: false,
      reason: "No package.json found (npm audit requires package.json)",
    };
  },
};

const pipAuditChecker: ToolChecker = {
  name: "pip-audit",
  check: (projectRoot: string): ToolCheckResult => {
    const configFiles = ["pyproject.toml", "requirements.txt"];
    const found = anyFileExists(projectRoot, configFiles);
    if (found) {
      return { configured: true };
    }
    return {
      configured: false,
      reason: "No pyproject.toml or requirements.txt found",
    };
  },
};

const knipChecker: ToolChecker = {
  name: "knip",
  check: (projectRoot: string): ToolCheckResult => {
    // Check for dedicated config files
    const configFiles = [
      "knip.json",
      "knip.jsonc",
      "knip.config.ts",
      "knip.config.js",
    ];
    const found = anyFileExists(projectRoot, configFiles);
    if (found) {
      return { configured: true };
    }
    // Check for knip key in package.json
    if (packageJsonHasKey(projectRoot, "knip")) {
      return { configured: true };
    }
    return {
      configured: false,
      reason:
        "No knip.json, knip.jsonc, knip.config.ts, knip.config.js, or knip key in package.json found",
    };
  },
};

const vultureChecker: ToolChecker = {
  name: "vulture",
  check: (projectRoot: string): ToolCheckResult => {
    if (pyprojectHasToolSection(projectRoot, "vulture")) {
      return { configured: true };
    }
    return {
      configured: false,
      reason: "No pyproject.toml with [tool.vulture] section found",
    };
  },
};

/**
 * Map of tool names to their checkers
 */
export const toolCheckers: Record<RequiredTool, ToolChecker> = {
  ty: tyChecker,
  gitleaks: gitleaksChecker,
  "npm-audit": npmAuditChecker,
  "pip-audit": pipAuditChecker,
  knip: knipChecker,
  vulture: vultureChecker,
};

/**
 * Check if a specific tool is configured in the project
 */
export function checkTool(
  projectRoot: string,
  tool: RequiredTool,
): ToolCheckResult {
  const checker = toolCheckers[tool];
  return checker.check(projectRoot);
}
