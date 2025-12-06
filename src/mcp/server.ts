/**
 * MCP Server setup and lifecycle.
 * Initializes the McpServer with stdio transport for AI agent integration.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { registerTools } from "./tools.js";

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8"),
);

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: "cmc",
    version: pkg.version,
  });

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
