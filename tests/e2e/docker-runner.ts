/**
 * Docker-based e2e test runner
 *
 * Builds and runs Docker containers for each test project,
 * providing deterministic, isolated test environments.
 *
 * Uses a shared base image to speed up builds - the base image contains
 * the built cmc CLI and all dependencies. Test-specific images only add
 * their cmc.toml and test files.
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

const ROOT_DIR = join(process.cwd());
const BASE_IMAGE_NAME = 'cmc-e2e-base';
const BASE_NO_LINTERS_IMAGE_NAME = 'cmc-e2e-base-no-linters';
let baseImageBuilt = false;
let baseNoLintersImageBuilt = false;

// Projects that need the "no linters" base image
const NO_LINTERS_PROJECTS = [
  'check/typescript/no-eslint',
  'check/python/no-ruff',
  'check/typescript-and-python/no-linters',
];

export interface DockerRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface McpToolCallResult {
  response: McpResponse | null;
  stderr: string;
  exitCode: number;
}

export interface McpResponse {
  jsonrpc: string;
  id: number;
  result?: {
    content?: { type: string; text: string }[];
    tools?: { name: string; description: string }[];
    [key: string]: unknown;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Build a base image (only once per test run)
 */
async function buildBaseImageInternal(imageName: string, dockerfileName: string): Promise<void> {
  const dockerfilePath = join(ROOT_DIR, 'tests', 'e2e', dockerfileName);

  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['build', '-t', imageName, '-f', dockerfilePath, ROOT_DIR], {
      cwd: ROOT_DIR,
    });

    let stderr = '';
    proc.stderr.on('data', (data) => (stderr += data.toString()));

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Base image build failed: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Docker build error: ${err.message}`));
    });
  });
}

/**
 * Build the shared base image with all linters (only once per test run)
 */
export async function buildBaseImage(): Promise<void> {
  if (baseImageBuilt) return;
  await buildBaseImageInternal(BASE_IMAGE_NAME, 'Dockerfile.base');
  baseImageBuilt = true;
}

/**
 * Build the no-linters base image (only once per test run)
 */
async function buildBaseNoLintersImage(): Promise<void> {
  if (baseNoLintersImageBuilt) return;
  await buildBaseImageInternal(BASE_NO_LINTERS_IMAGE_NAME, 'Dockerfile.base-no-linters');
  baseNoLintersImageBuilt = true;
}

/**
 * Build a Docker image for a test project using the shared base
 * @param projectPath - Path to project relative to tests/e2e/projects (e.g., 'check/typescript/default')
 */
export async function buildImage(projectPath: string): Promise<string> {
  // Determine which base image to use
  const needsNoLinters = NO_LINTERS_PROJECTS.includes(projectPath);
  const baseImage = needsNoLinters ? BASE_NO_LINTERS_IMAGE_NAME : BASE_IMAGE_NAME;

  // Ensure appropriate base image is built first
  if (needsNoLinters) {
    await buildBaseNoLintersImage();
  } else {
    await buildBaseImage();
  }

  const imageName = `cmc-e2e-${projectPath.replace(/\//g, '-')}`;
  const projectDir = join(ROOT_DIR, 'tests', 'e2e', 'projects', projectPath);
  const dockerfilePath = join(projectDir, 'Dockerfile');

  // Check if project has a custom Dockerfile
  if (existsSync(dockerfilePath)) {
    const dockerfileContent = readFileSync(dockerfilePath, 'utf-8');
    // Legacy Dockerfile (FROM node: or FROM python:) - build directly
    if (dockerfileContent.includes('FROM node:') || dockerfileContent.includes('FROM python:')) {
      return new Promise((resolve, reject) => {
        const proc = spawn('docker', ['build', '-t', imageName, '-f', dockerfilePath, ROOT_DIR], {
          cwd: ROOT_DIR,
        });

        let stderr = '';
        proc.stderr.on('data', (data) => (stderr += data.toString()));

        proc.on('close', (code) => {
          if (code === 0) {
            resolve(imageName);
          } else {
            reject(new Error(`Docker build failed for ${projectPath}: ${stderr}`));
          }
        });

        proc.on('error', (err) => {
          reject(new Error(`Docker build error: ${err.message}`));
        });
      });
    }
  }

  // Use simple overlay: copy test files onto base image
  const dockerfile = `FROM ${baseImage}
COPY tests/e2e/projects/${projectPath}/ /project/
`;

  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['build', '-t', imageName, '-f', '-', ROOT_DIR], {
      cwd: ROOT_DIR,
    });

    let stderr = '';
    proc.stderr.on('data', (data) => (stderr += data.toString()));

    // Write Dockerfile to stdin
    proc.stdin.write(dockerfile);
    proc.stdin.end();

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(imageName);
      } else {
        reject(new Error(`Docker build failed for ${projectPath}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Docker build error: ${err.message}`));
    });
  });
}

/**
 * Run cmc command in a Docker container
 * @param imageName - Docker image name
 * @param args - Arguments to pass to the cmc command
 * @param options - Additional options
 * @param options.sshAgent - Mount SSH agent socket for private repo access
 */
export async function runInDocker(
  imageName: string,
  args: string[] = ['check'],
  options: { sshAgent?: boolean } = {}
): Promise<DockerRunResult> {
  return new Promise((resolve) => {
    const dockerArgs = ['run', '--rm'];

    // Mount SSH agent socket for private repo access
    if (options.sshAgent) {
      if (process.platform === 'darwin') {
        // macOS: Use Docker Desktop's magic SSH socket path
        dockerArgs.push(
          '--mount',
          'type=bind,src=/run/host-services/ssh-auth.sock,target=/ssh-agent',
          '-e',
          'SSH_AUTH_SOCK=/ssh-agent'
        );
      } else if (process.env.SSH_AUTH_SOCK) {
        // Linux: Mount SSH agent socket directly
        dockerArgs.push(
          '-v',
          `${process.env.SSH_AUTH_SOCK}:/ssh-agent`,
          '-e',
          'SSH_AUTH_SOCK=/ssh-agent'
        );
      }
    }

    dockerArgs.push(imageName, ...args);

    const proc = spawn('docker', dockerArgs);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => (stdout += data.toString()));
    proc.stderr.on('data', (data) => (stderr += data.toString()));

    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });

    proc.on('error', (err) => {
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
      });
    });
  });
}

/**
 * Check if Docker is available
 */
export async function isDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['--version']);
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/**
 * Clean up specific test images by name
 */
export async function cleanupImages(imageNames?: string[]): Promise<void> {
  if (imageNames && imageNames.length > 0) {
    // Clean up specific images
    return new Promise((resolve) => {
      const rmProc = spawn('docker', ['rmi', '-f', ...imageNames]);
      rmProc.on('close', () => resolve());
      rmProc.on('error', () => resolve());
    });
  }

  // Clean up all cmc-e2e images (legacy behavior)
  return new Promise((resolve) => {
    const proc = spawn('docker', ['images', '-q', '--filter', 'reference=cmc-e2e-*']);

    let imageIds = '';
    proc.stdout.on('data', (data) => (imageIds += data.toString()));

    proc.on('close', async () => {
      const ids = imageIds.trim().split('\n').filter(Boolean);
      if (ids.length > 0) {
        const rmProc = spawn('docker', ['rmi', '-f', ...ids]);
        rmProc.on('close', () => resolve());
      } else {
        resolve();
      }
    });
  });
}

/**
 * Create MCP JSON-RPC request message
 */
function createMcpRequest(method: string, params: Record<string, unknown> = {}, id = 1): string {
  return JSON.stringify({ jsonrpc: '2.0', method, params, id });
}

/**
 * Run MCP server in Docker and send tool calls via stdin
 * @param imageName - Docker image name
 * @param toolName - MCP tool name to call
 * @param toolArgs - Arguments to pass to the tool
 * @param timeoutMs - Timeout in milliseconds (default 30000)
 */
export async function runMcpToolCall(
  imageName: string,
  toolName: string,
  toolArgs: Record<string, unknown> = {},
  timeoutMs = 30000
): Promise<McpToolCallResult> {
  return new Promise((resolve) => {
    const dockerArgs = ['run', '--rm', '-i', imageName, 'mcp-server'];
    const proc = spawn('docker', dockerArgs);

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        resolve({
          response: null,
          stderr: stderr + '\nTimeout waiting for MCP response',
          exitCode: 1,
        });
      }
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      // Try to parse complete JSON-RPC responses
      const lines = stdout.split('\n').filter((line) => line.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as McpResponse;
          // If we got a response to our tool call (id: 2), resolve
          if (parsed.id === 2 && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            proc.kill();
            resolve({
              response: parsed,
              stderr,
              exitCode: 0,
            });
          }
        } catch {
          // Not valid JSON yet, continue
        }
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        // Try to parse any response we got
        let response: McpResponse | null = null;
        const lines = stdout.split('\n').filter((line) => line.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as McpResponse;
            if (parsed.id === 2) {
              response = parsed;
              break;
            }
          } catch {
            // Not valid JSON
          }
        }
        resolve({
          response,
          stderr,
          exitCode: code ?? 1,
        });
      }
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          response: null,
          stderr: err.message,
          exitCode: 1,
        });
      }
    });

    // Send MCP initialization and tool call
    // 1. Initialize
    const initRequest = createMcpRequest(
      'initialize',
      {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
      1
    );

    // 2. Call tool
    const toolRequest = createMcpRequest(
      'tools/call',
      {
        name: toolName,
        arguments: toolArgs,
      },
      2
    );

    // Write requests with newline separators
    proc.stdin.write(initRequest + '\n');
    proc.stdin.write(toolRequest + '\n');
    proc.stdin.end();
  });
}

/**
 * Run MCP server and list available tools
 * @param imageName - Docker image name
 * @param timeoutMs - Timeout in milliseconds (default 30000)
 */
export async function runMcpListTools(
  imageName: string,
  timeoutMs = 30000
): Promise<McpToolCallResult> {
  return new Promise((resolve) => {
    const dockerArgs = ['run', '--rm', '-i', imageName, 'mcp-server'];
    const proc = spawn('docker', dockerArgs);

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        resolve({
          response: null,
          stderr: stderr + '\nTimeout waiting for MCP response',
          exitCode: 1,
        });
      }
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      const lines = stdout.split('\n').filter((line) => line.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as McpResponse;
          if (parsed.id === 2 && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            proc.kill();
            resolve({
              response: parsed,
              stderr,
              exitCode: 0,
            });
          }
        } catch {
          // Not valid JSON yet
        }
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        let response: McpResponse | null = null;
        const lines = stdout.split('\n').filter((line) => line.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as McpResponse;
            if (parsed.id === 2) {
              response = parsed;
              break;
            }
          } catch {
            // Not valid JSON
          }
        }
        resolve({
          response,
          stderr,
          exitCode: code ?? 1,
        });
      }
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          response: null,
          stderr: err.message,
          exitCode: 1,
        });
      }
    });

    // Send MCP initialization and list tools
    const initRequest = createMcpRequest(
      'initialize',
      {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
      1
    );

    const listToolsRequest = createMcpRequest('tools/list', {}, 2);

    proc.stdin.write(initRequest + '\n');
    proc.stdin.write(listToolsRequest + '\n');
    proc.stdin.end();
  });
}
