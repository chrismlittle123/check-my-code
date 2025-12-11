/**
 * Remote config fetching for Claude Code settings.
 *
 * Fetches config files from remote git repositories using the syntax:
 *   github:owner/repo/path@version
 *
 * Resolves versions through a configs.json manifest.
 */

import { z } from "zod";

import {
  type ClaudeSettings,
  DEFAULT_CLAUDE_SETTINGS_SOURCE,
} from "../types.js";
import {
  fetchRemoteFile,
  parseRemoteRef,
  RemoteFetchError,
} from "./fetcher.js";

// Error class for config fetch failures
export class ConfigFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigFetchError";
  }
}

// Schema for configs.json manifest
const configsManifestSchema = z.object({
  schema_version: z.string(),
  configs: z.record(
    z.string(),
    z.object({
      description: z.string().optional(),
      tool: z.string(),
      format: z.string().optional(),
      versions: z.record(
        z.string(),
        z.union([z.string(), z.object({ file: z.string() })]),
      ),
    }),
  ),
});

export type ConfigsManifest = z.infer<typeof configsManifestSchema>;

/**
 * Build the base remote reference for manifest/file lookup.
 */
function buildRemoteRef(remoteRef: string): string {
  const ref = parseRemoteRef(remoteRef);
  return `github:${ref.owner}/${ref.repo}/configs@${ref.version}`;
}

async function fetchManifestContent(manifestRef: string): Promise<string> {
  try {
    return await fetchRemoteFile(manifestRef, "configs.json");
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      throw new ConfigFetchError(
        `Failed to load configs.json manifest from ${manifestRef}: ${error.message}`,
      );
    }
    throw error;
  }
}

/** @internal exported for testing */
export function parseManifestJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new ConfigFetchError(
      `Invalid configs.json manifest: JSON parse error`,
    );
  }
}

/** @internal exported for testing */
export function validateManifest(parsed: unknown): ConfigsManifest {
  const result = configsManifestSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new ConfigFetchError(`Invalid configs.json manifest: ${errors}`);
  }
  return result.data;
}

/**
 * Fetch and parse the configs.json manifest from a remote repository.
 */
async function fetchManifest(remoteRef: string): Promise<ConfigsManifest> {
  const manifestRef = buildRemoteRef(remoteRef);
  const content = await fetchManifestContent(manifestRef);
  const parsed = parseManifestJson(content);
  return validateManifest(parsed);
}

/** @internal exported for testing */
export function getConfigEntry(
  manifest: ConfigsManifest,
  configKey: string,
): ConfigsManifest["configs"][string] {
  const entry = manifest.configs[configKey];
  if (!entry) {
    const available = Object.keys(manifest.configs).join(", ") || "(none)";
    throw new ConfigFetchError(
      `Config not found in manifest: ${configKey}\nAvailable: ${available}`,
    );
  }
  return entry;
}

/** @internal exported for testing */
export function resolveLatestVersion(
  entry: ConfigsManifest["configs"][string],
  configKey: string,
): string {
  const latestPointer = entry.versions.latest;
  if (!latestPointer || typeof latestPointer !== "string") {
    throw new ConfigFetchError(
      `No "latest" version defined for config: ${configKey}`,
    );
  }
  return latestPointer;
}

/** @internal exported for testing */
export function getVersionFilePath(
  entry: ConfigsManifest["configs"][string],
  version: string,
  configKey: string,
): string {
  const versionEntry = entry.versions[version];
  if (!versionEntry) {
    const available =
      Object.keys(entry.versions)
        .filter((v) => v !== "latest")
        .join(", ") || "(none)";
    throw new ConfigFetchError(
      `Version not found: ${version} for ${configKey}\nAvailable: ${available}`,
    );
  }

  if (typeof versionEntry === "string") {
    throw new ConfigFetchError(
      `Invalid version entry for ${version}: expected object with file path`,
    );
  }

  return versionEntry.file;
}

/**
 * Resolve a version string to the actual file path using the manifest.
 */
function resolveVersion(
  manifest: ConfigsManifest,
  configKey: string,
  requestedVersion: string,
): string {
  const entry = getConfigEntry(manifest, configKey);
  const version =
    requestedVersion === "latest"
      ? resolveLatestVersion(entry, configKey)
      : requestedVersion;
  return getVersionFilePath(entry, version, configKey);
}

/**
 * Fetch and parse a remote config JSON file.
 */
async function fetchConfigFile(
  remoteRef: string,
  filePath: string,
): Promise<unknown> {
  const fileRef = buildRemoteRef(remoteRef);

  let content: string;
  try {
    content = await fetchRemoteFile(fileRef, filePath);
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      throw new ConfigFetchError(
        `Failed to load remote config file ${filePath}: ${error.message}`,
      );
    }
    throw error;
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Parse error";
    throw new ConfigFetchError(`Invalid JSON in remote config: ${msg}`);
  }
}

/**
 * Fetch Claude Code settings from a remote reference.
 * If no reference is provided, uses the default community repository.
 *
 * @param remoteRef - Optional remote reference (format: github:owner/repo/path@version)
 * @returns Parsed Claude settings object
 */
export async function fetchClaudeSettings(
  remoteRef?: string,
): Promise<ClaudeSettings> {
  const ref = remoteRef ?? DEFAULT_CLAUDE_SETTINGS_SOURCE;
  const parsedRef = parseRemoteRef(ref);
  const manifest = await fetchManifest(ref);
  const filePath = resolveVersion(manifest, "claude-code", parsedRef.version);
  const settings = await fetchConfigFile(ref, filePath);

  return settings as ClaudeSettings;
}
