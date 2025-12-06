import { Command } from "commander";

import { startServer } from "../../mcp/server.js";

export const mcpServerCommand = new Command("mcp-server")
  .description("Start MCP server for AI agent integration")
  .addHelpText(
    "after",
    `
The MCP server exposes linting functionality to AI agents like Claude Code, Cursor, and Codex.

Setup for Claude Code:
  $ claude mcp add cmc -- npx -y check-my-code mcp-server

Setup for Cursor/Claude Desktop (add to MCP config):
  {
    "mcpServers": {
      "cmc": {
        "command": "npx",
        "args": ["-y", "check-my-code", "mcp-server"]
      }
    }
  }

Available tools:
  - check_files    Lint specific files
  - check_project  Lint entire project
  - fix_files      Auto-fix violations
  - get_guidelines Fetch coding standards
  - get_status     Get session state`,
  )
  .action(async () => {
    await startServer();
  });
