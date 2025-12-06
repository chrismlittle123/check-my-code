/**
 * MCP Tool definitions.
 * Exposes linting functionality to AI agents via MCP protocol.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  handleCheckFiles,
  handleCheckProject,
  handleFixFiles,
  handleGetGuidelines,
  handleGetStatus,
  handleSuggestConfig,
  handleValidateConfig,
} from "./handlers.js";

/** Register linting tools (check_files, check_project, fix_files) */
function registerLintingTools(server: McpServer): void {
  server.tool(
    "check_files",
    "Lint specific files for violations. Returns violations found in the specified files.",
    {
      files: z
        .array(z.string())
        .describe("Array of file paths to check (relative to project root)"),
    },
    handleCheckFiles,
  );

  server.tool(
    "check_project",
    "Lint entire project or a subdirectory. Discovers all lintable files and checks them.",
    {
      path: z
        .string()
        .optional()
        .describe("Optional subdirectory to check (defaults to project root)"),
    },
    handleCheckProject,
  );

  server.tool(
    "fix_files",
    "Auto-fix linting violations in specific files using ESLint --fix and Ruff --fix.",
    {
      files: z
        .array(z.string())
        .describe("Array of file paths to fix (relative to project root)"),
    },
    handleFixFiles,
  );
}

/** Register utility tools (get_guidelines, get_status) */
function registerUtilityTools(server: McpServer): void {
  server.tool(
    "get_guidelines",
    "Fetch coding standards/guidelines templates. Uses templates from cmc.toml or specified templates.",
    {
      templates: z
        .array(z.string())
        .optional()
        .describe(
          'Optional array of template names (e.g., ["typescript/5.5"]). Defaults to cmc.toml config.',
        ),
    },
    handleGetGuidelines,
  );

  server.tool(
    "get_status",
    "Get current session state including project info and statistics.",
    {},
    handleGetStatus,
  );
}

/** Register config tools (suggest_config, validate_config) */
function registerConfigTools(server: McpServer): void {
  server.tool(
    "suggest_config",
    "Generate a cmc.toml configuration based on a project description.",
    {
      description: z
        .string()
        .describe(
          'Natural language description of the project (e.g., "A TypeScript REST API")',
        ),
    },
    handleSuggestConfig,
  );

  server.tool(
    "validate_config",
    "Validate TOML content against the cmc.toml schema.",
    {
      config: z
        .string()
        .describe("TOML content to validate against the cmc.toml schema"),
    },
    handleValidateConfig,
  );
}

/** Register all MCP tools with the server */
export function registerTools(server: McpServer): void {
  registerLintingTools(server);
  registerUtilityTools(server);
  registerConfigTools(server);
}
