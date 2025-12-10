/**
 * Git remote fetcher for cmc
 *
 * Fetches files from remote git repositories using the syntax:
 *   github:owner/repo/path@version
 *
 * Uses ambient git credentials (SSH keys) for authentication.
 * Always clones the default branch - the @version is used only for
 * manifest-based version resolution, not as a git ref.
 */

import { execSync, spawn } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import lockfile from "proper-lockfile";

// Cache directory for cloned repositories
const CACHE_DIR = join(homedir(), ".cmc", "cache");

// Lock directory for cross-process coordination
const LOCK_DIR = join(homedir(), ".cmc", "locks");

// In-flight clone operations to prevent race conditions within a single process
// Maps cache key to a promise that resolves when the clone is complete
const inFlightClones = new Map<string, Promise<string>>();

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
 * Generate cache key for a remote reference.
 * Cache key is based on owner/repo only - all versions share the same clone.
 */
function getCacheKey(ref: RemoteRef): string {
  const hash = createHash("sha256")
    .update(`${ref.host}:${ref.owner}/${ref.repo}`)
    .digest("hex")
    .slice(0, 12);
  return `${ref.owner}-${ref.repo}-${hash}`;
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

function cleanupPath(path: string): void {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
  }
}

async function tryFetchExisting(cachePath: string): Promise<boolean> {
  if (!existsSync(cachePath)) return false;

  try {
    await gitFetch(cachePath);
    await gitCheckout(cachePath);
    return true;
  } catch {
    cleanupPath(cachePath);
    return false;
  }
}

async function tryCloneUrls(
  urls: string[],
  cachePath: string,
  ref: RemoteRef,
): Promise<string> {
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      cleanupPath(cachePath);
      // eslint-disable-next-line no-await-in-loop
      await gitClone(url, cachePath);
      return cachePath;
    } catch (error) {
      lastError = error as Error;
      cleanupPath(cachePath);
    }
  }

  throw (
    lastError ??
    new RemoteFetchError(`Failed to clone ${ref.owner}/${ref.repo}`)
  );
}

/**
 * Perform the actual clone or fetch operation (internal, not locked)
 */
async function doCloneOrFetch(ref: RemoteRef): Promise<string> {
  if (!isGitAvailable()) {
    throw new RemoteFetchError("git is not installed or not in PATH");
  }

  mkdirSync(CACHE_DIR, { recursive: true });

  const cachePath = getCachePath(ref);

  if (await tryFetchExisting(cachePath)) {
    return cachePath;
  }

  cleanupPath(cachePath);
  return tryCloneUrls(buildCloneUrls(ref), cachePath, ref);
}

/**
 * Get the lock file path for a given cache key.
 * Creates the lock directory and lock file if they don't exist.
 */
function getLockFilePath(cacheKey: string): string {
  mkdirSync(LOCK_DIR, { recursive: true });
  const lockFilePath = join(LOCK_DIR, `${cacheKey}.lock`);

  // Create lock file if it doesn't exist (proper-lockfile requires file to exist)
  if (!existsSync(lockFilePath)) {
    writeFileSync(lockFilePath, "", "utf-8");
  }

  return lockFilePath;
}

/**
 * Clone or fetch a repository to cache.
 *
 * Uses a two-level lock mechanism to prevent race conditions:
 * 1. In-process lock via Map for concurrent async operations within same process
 * 2. Cross-process file lock via proper-lockfile for concurrent process invocations
 */
async function cloneOrFetch(ref: RemoteRef): Promise<string> {
  const cacheKey = getCacheKey(ref);

  // Level 1: Check if there's already an in-flight clone in this process
  const existingClone = inFlightClones.get(cacheKey);
  if (existingClone) {
    // Wait for the existing clone to complete
    return existingClone;
  }

  // Level 2: Acquire cross-process file lock
  const lockFilePath = getLockFilePath(cacheKey);

  const clonePromise = (async (): Promise<string> => {
    let releaseLock: (() => Promise<void>) | null = null;

    try {
      // Acquire file lock with retry (waits for other processes)
      releaseLock = await lockfile.lock(lockFilePath, {
        retries: {
          retries: 10,
          factor: 2,
          minTimeout: 100,
          maxTimeout: 5000,
        },
        stale: 60000, // Consider lock stale after 60 seconds
      });

      // After acquiring lock, check if another process already cloned
      const cachePath = getCachePath(ref);
      if (existsSync(cachePath)) {
        // Cache already exists, just verify it's valid
        if (await tryFetchExisting(cachePath)) {
          return cachePath;
        }
      }

      // Perform the actual clone/fetch
      return await doCloneOrFetch(ref);
    } finally {
      // Release file lock
      if (releaseLock) {
        await releaseLock();
      }
      // Clean up in-flight tracking
      inFlightClones.delete(cacheKey);
    }
  })();

  inFlightClones.set(cacheKey, clonePromise);
  return clonePromise;
}

/**
 * Run git clone (always clones default branch)
 */
function gitClone(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Clone with depth 1 for efficiency - always use default branch
    const args = ["clone", "--depth", "1", url, dest];

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
 * Run git fetch (fetches latest from default branch)
 */
function gitFetch(repoPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ["fetch", "--depth", "1", "origin"];

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
 * Run git checkout (checks out latest from default branch)
 */
function gitCheckout(repoPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", ["checkout", "origin/HEAD"], {
      cwd: repoPath,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    proc.stderr.on("data", (data) => (stderr += data.toString()));

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new RemoteFetchError(`Failed to checkout origin/HEAD: ${stderr}`),
        );
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

/**
 * Get count of in-flight clone operations (for testing)
 * @internal
 */
export function getInFlightCount(): number {
  return inFlightClones.size;
}
