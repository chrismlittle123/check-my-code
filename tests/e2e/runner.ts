/**
 * Simple e2e test runner - executes CLI directly without Docker
 */

import { exec, spawn } from "child_process";
import { promisify } from "util";
import { join } from "path";

const execAsync = promisify(exec);

const ROOT_DIR = process.cwd();
const CLI_PATH = join(ROOT_DIR, "dist", "cli", "index.js");

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run cmc CLI command in a project directory
 */
export async function run(
  projectPath: string,
  args: string[] = ["check"],
): Promise<RunResult> {
  const cwd = join(ROOT_DIR, "tests", "e2e", "projects", projectPath);
  const command = `node ${CLI_PATH} ${args.join(" ")}`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 30000,
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const e = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.code ?? 1,
    };
  }
}

/**
 * Run MCP server and send a tool call using spawn with proper stdin
 */
export async function runMcp(
  projectPath: string,
  toolName: string,
  toolArgs: Record<string, unknown> = {},
): Promise<{ response: unknown; exitCode: number }> {
  const cwd = join(ROOT_DIR, "tests", "e2e", "projects", projectPath);

  const initRequest = JSON.stringify({
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    },
    id: 1,
  });

  const toolRequest = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name: toolName, arguments: toolArgs },
    id: 2,
  });

  return new Promise((resolve) => {
    const proc = spawn("node", [CLI_PATH, "mcp-server"], {
      cwd,
      env: { ...process.env, NO_COLOR: "1" },
    });

    let stdout = "";
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        resolve({ response: null, exitCode: 1 });
      }
    }, 30000);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
      const lines = stdout.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === 2 && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            proc.kill();
            resolve({ response: parsed, exitCode: 0 });
          }
        } catch {
          // Not JSON yet
        }
      }
    });

    proc.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ response: null, exitCode: code ?? 1 });
      }
    });

    // Write requests to stdin
    proc.stdin.write(initRequest + "\n");
    proc.stdin.write(toolRequest + "\n");
    proc.stdin.end();
  });
}

/**
 * Run MCP server and list tools
 */
export async function runMcpListTools(projectPath: string): Promise<{
  tools: { name: string; description: string }[];
  exitCode: number;
}> {
  const cwd = join(ROOT_DIR, "tests", "e2e", "projects", projectPath);

  const initRequest = JSON.stringify({
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    },
    id: 1,
  });

  const listRequest = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/list",
    params: {},
    id: 2,
  });

  return new Promise((resolve) => {
    const proc = spawn("node", [CLI_PATH, "mcp-server"], {
      cwd,
      env: { ...process.env, NO_COLOR: "1" },
    });

    let stdout = "";
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        resolve({ tools: [], exitCode: 1 });
      }
    }, 30000);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
      const lines = stdout.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === 2 && parsed.result?.tools && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            proc.kill();
            resolve({ tools: parsed.result.tools, exitCode: 0 });
          }
        } catch {
          // Not JSON yet
        }
      }
    });

    proc.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ tools: [], exitCode: code ?? 1 });
      }
    });

    // Write requests to stdin
    proc.stdin.write(initRequest + "\n");
    proc.stdin.write(listRequest + "\n");
    proc.stdin.end();
  });
}
