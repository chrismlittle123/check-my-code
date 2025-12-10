import { existsSync } from "fs";
import { join } from "path";

import type { Config, RequiredTool } from "../types.js";
import { checkTool } from "./tools.js";

export interface ToolMissing {
  tool: RequiredTool;
  reason: string;
}

export interface FilesCheckResult {
  required: string[];
  missing: string[];
  passed: boolean;
}

export interface ToolsCheckResult {
  required: RequiredTool[];
  missing: ToolMissing[];
  passed: boolean;
}

export interface RequirementsCheckResult {
  files: FilesCheckResult;
  tools: ToolsCheckResult;
  passed: boolean;
}

/**
 * Check if the config has any requirements configured
 */
export function hasRequirements(config: Config): boolean {
  const { requirements } = config;
  if (!requirements) return false;

  const hasFiles =
    Array.isArray(requirements.files) && requirements.files.length > 0;
  const hasTools =
    Array.isArray(requirements.tools) && requirements.tools.length > 0;

  return hasFiles || hasTools;
}

/**
 * Check required files exist in the project
 */
function checkRequiredFiles(
  projectRoot: string,
  requiredFiles: string[],
): FilesCheckResult {
  const missing: string[] = [];

  for (const file of requiredFiles) {
    const filePath = join(projectRoot, file);
    if (!existsSync(filePath)) {
      missing.push(file);
    }
  }

  return {
    required: requiredFiles,
    missing,
    passed: missing.length === 0,
  };
}

/**
 * Check required tools are configured in the project
 */
function checkRequiredTools(
  projectRoot: string,
  requiredTools: RequiredTool[],
): ToolsCheckResult {
  const missing: ToolMissing[] = [];

  for (const tool of requiredTools) {
    const result = checkTool(projectRoot, tool);
    if (!result.configured) {
      missing.push({
        tool,
        reason: result.reason ?? `${tool} is not configured`,
      });
    }
  }

  return {
    required: requiredTools,
    missing,
    passed: missing.length === 0,
  };
}

/**
 * Check all requirements for a project
 */
export function checkRequirements(
  projectRoot: string,
  config: Config,
): RequirementsCheckResult {
  const { requirements } = config;

  // Default results for when no requirements are configured
  const emptyFilesResult: FilesCheckResult = {
    required: [],
    missing: [],
    passed: true,
  };

  const emptyToolsResult: ToolsCheckResult = {
    required: [],
    missing: [],
    passed: true,
  };

  if (!requirements) {
    return {
      files: emptyFilesResult,
      tools: emptyToolsResult,
      passed: true,
    };
  }

  const filesResult =
    requirements.files && requirements.files.length > 0
      ? checkRequiredFiles(projectRoot, requirements.files)
      : emptyFilesResult;

  const toolsResult =
    requirements.tools && requirements.tools.length > 0
      ? checkRequiredTools(projectRoot, requirements.tools)
      : emptyToolsResult;

  return {
    files: filesResult,
    tools: toolsResult,
    passed: filesResult.passed && toolsResult.passed,
  };
}

// Re-export types
export type { ToolCheckResult } from "./tools.js";
