/**
 * Git remote fetcher for cmc
 *
 * Fetches files from remote git repositories using the syntax:
 *   github:owner/repo/path@version
 *
 * Uses ambient git credentials (SSH keys) for authentication.
 * Supports version pinning: @v1.0.0, @latest, @main, or any git ref.
 */

import { execSync, spawn } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Cache directory for cloned repositories
const CACHE_DIR = join(homedir(), ".cmc", "cache");

export interface RemoteRef {
  host: "github";
  owner: string;
  repo: string;
  path: string;
  version: string;
}

export class RemoteFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoteFetchError";
  }
}

/**
 * Parse a remote reference string into components
 *
 * Format: github:owner/repo/path@version
 * Examples:
 *   - github:chrismlittle123/check-my-code-community/rulesets/typescript@v1.0.0
 *   - github:myorg/configs/promptss@latest
 *   - github:owner/repo@main (path defaults to root)
 */
export function parseRemoteRef(ref: string): RemoteRef {
  // Match: github:owner/repo[/path]@version
  const match = /^(github):([^/]+)\/([^/@]+)(?:\/([^@]*))?@(.+)$/.exec(ref);

  if (!match) {
    throw new RemoteFetchError(
      `Invalid remote reference: ${ref}\n` +
        `Expected format: github:owner/repo/path@version\n` +
        `Examples:\n` +
        `  github:owner/repo/rulesets/typescript@v1.0.0\n` +
        `  github:owner/repo/promptss@latest`,
    );
  }

  const [, host, owner, repo, path, version] = match;

  if (!host || !owner || !repo || !version) {
    throw new RemoteFetchError(
      `Invalid remote reference: ${ref}\n` +
        `Expected format: github:owner/repo/path@version`,
    );
  }

  return {
    host: host as "github",
    owner,
    repo,
    path: path ?? "",
    version,
  };
}

/**
 * Build git clone URLs from remote reference
 * Returns HTTPS first (for public repos), then SSH (for private repos)
 */
function buildCloneUrls(ref: RemoteRef): string[] {
  return [
    // HTTPS URL works for public repos without authentication
    `https://github.com/${ref.owner}/${ref.repo}.git`,
    // SSH URL for private repos with ambient credentials (SSH keys)
    `git@github.com:${ref.owner}/${ref.repo}.git`,
  ];
}

/**
 * Generate cache key for a remote reference
 */
function getCacheKey(ref: RemoteRef): string {
  const hash = createHash("sha256")
    .update(`${ref.host}:${ref.owner}/${ref.repo}@${ref.version}`)
    .digest("hex")
    .slice(0, 12);
  return `${ref.owner}-${ref.repo}-${ref.version}-${hash}`;
}

/**
 * Get the cache directory for a remote reference
 */
function getCachePath(ref: RemoteRef): string {
  return join(CACHE_DIR, getCacheKey(ref));
}

/**
 * Check if git is available
 */
function isGitAvailable(): boolean {
  try {
    execSync("git --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Clone or fetch a repository to cache
 */
async function cloneOrFetch(ref: RemoteRef): Promise<string> {
  if (!isGitAvailable()) {
    throw new RemoteFetchError("git is not installed or not in PATH");
  }

  const cachePath = getCachePath(ref);
  const cloneUrls = buildCloneUrls(ref);

  // Ensure cache directory exists
  mkdirSync(CACHE_DIR, { recursive: true });

  if (existsSync(cachePath)) {
    // Repository already cached, fetch updates
    try {
      await gitFetch(cachePath, ref.version);
      await gitCheckout(cachePath, ref.version);
      return cachePath;
    } catch {
      // Cache corrupted, remove and re-clone
      rmSync(cachePath, { recursive: true, force: true });
    }
  }

  // Ensure clean state before cloning
  if (existsSync(cachePath)) {
    rmSync(cachePath, { recursive: true, force: true });
  }

  // Try each URL in order (HTTPS first, then SSH)
  // Sequential attempts are required - can't clone in parallel
  let lastError: Error | null = null;
  for (const url of cloneUrls) {
    try {
      // Ensure directory doesn't exist before clone attempt
      if (existsSync(cachePath)) {
        rmSync(cachePath, { recursive: true, force: true });
      }
      // eslint-disable-next-line no-await-in-loop
      await gitClone(url, cachePath, ref.version);
      return cachePath;
    } catch (error) {
      lastError = error as Error;
      // Clean up failed clone attempt
      if (existsSync(cachePath)) {
        rmSync(cachePath, { recursive: true, force: true });
      }
    }
  }

  throw (
    lastError ??
    new RemoteFetchError(`Failed to clone ${ref.owner}/${ref.repo}`)
  );
}

/**
 * Run git clone
 */
function gitClone(url: string, dest: string, version: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Clone with depth 1 for efficiency, but we need tags for version resolution
    const args = ["clone", "--depth", "1"];

    // If version is not 'latest', clone specific branch/tag
    if (version !== "latest") {
      args.push("--branch", version);
    }

    args.push(url, dest);

    const proc = spawn("git", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    proc.stderr.on("data", (data) => (stderr += data.toString()));

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new RemoteFetchError(`Failed to clone ${url}: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(new RemoteFetchError(`Git clone error: ${err.message}`));
    });
  });
}

/**
 * Run git fetch
 */
function gitFetch(repoPath: string, version: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ["fetch", "--depth", "1", "origin"];
    if (version !== "latest") {
      args.push(version);
    }

    const proc = spawn("git", args, {
      cwd: repoPath,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    proc.stderr.on("data", (data) => (stderr += data.toString()));

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new RemoteFetchError(`Failed to fetch: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(new RemoteFetchError(`Git fetch error: ${err.message}`));
    });
  });
}

/**
 * Run git checkout
 */
function gitCheckout(repoPath: string, version: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ref = version === "latest" ? "origin/HEAD" : version;

    const proc = spawn("git", ["checkout", ref], {
      cwd: repoPath,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    proc.stderr.on("data", (data) => (stderr += data.toString()));

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new RemoteFetchError(`Failed to checkout ${ref}: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(new RemoteFetchError(`Git checkout error: ${err.message}`));
    });
  });
}

/**
 * Fetch a file from a remote repository
 *
 * @param remoteRef - Remote reference string (e.g., "github:owner/repo/path@v1.0.0")
 * @param filePath - Path to file within the repo path (e.g., "typescript-strict.md")
 * @returns File contents as string
 */
export async function fetchRemoteFile(
  remoteRef: string,
  filePath: string,
): Promise<string> {
  const ref = parseRemoteRef(remoteRef);
  const repoPath = await cloneOrFetch(ref);

  const fullPath = join(repoPath, ref.path, filePath);

  if (!existsSync(fullPath)) {
    throw new RemoteFetchError(
      `File not found: ${filePath}\n` +
        `Looking in: ${ref.host}:${ref.owner}/${ref.repo}/${ref.path}`,
    );
  }

  return readFileSync(fullPath, "utf-8");
}

/**
 * Fetch a directory listing from a remote repository
 *
 * @param remoteRef - Remote reference string
 * @returns Array of file names in the directory
 */
export async function fetchRemoteDir(remoteRef: string): Promise<string[]> {
  const ref = parseRemoteRef(remoteRef);
  const repoPath = await cloneOrFetch(ref);

  const dirPath = join(repoPath, ref.path);

  if (!existsSync(dirPath)) {
    throw new RemoteFetchError(
      `Directory not found: ${ref.path}\n` +
        `Looking in: ${ref.host}:${ref.owner}/${ref.repo}`,
    );
  }

  const { readdirSync } = await import("fs");
  return readdirSync(dirPath);
}

/**
 * Clear the remote cache
 */
export function clearCache(): void {
  if (existsSync(CACHE_DIR)) {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  }
}

/**
 * Get cache info
 */
export function getCacheInfo(): { path: string; exists: boolean } {
  return {
    path: CACHE_DIR,
    exists: existsSync(CACHE_DIR),
  };
}
