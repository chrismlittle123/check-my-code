/**
 * Docker-based e2e test runner
 *
 * Builds and runs Docker containers for each test project,
 * providing deterministic, isolated test environments.
 */

import { spawn } from 'child_process';
import { join } from 'path';

const ROOT_DIR = join(process.cwd());
const PROJECTS_DIR = join(ROOT_DIR, 'tests', 'e2e', 'projects');

export interface DockerRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Build a Docker image for a test project
 */
export async function buildImage(projectName: string): Promise<string> {
  const imageName = `cmc-e2e-${projectName}`;
  const dockerfilePath = join(PROJECTS_DIR, projectName, 'Dockerfile');

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
        reject(new Error(`Docker build failed for ${projectName}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Docker build error: ${err.message}`));
    });
  });
}

/**
 * Run cmc command in a Docker container
 */
export async function runInDocker(
  imageName: string,
  args: string[] = ['check']
): Promise<DockerRunResult> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['run', '--rm', imageName, ...args]);

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
