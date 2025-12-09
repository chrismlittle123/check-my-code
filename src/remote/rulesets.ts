/**
 * Remote ruleset fetching and resolution.
 *
 * Fetches ruleset configurations from remote git repositories using the syntax:
 *   github:owner/repo/path@version
 *
 * Resolves versions through a rulesets.json manifest and merges remote rules
 * with local rules, detecting conflicts.
 */

import {
  type ESLintRuleValue,
  type ExtendsConfig,
  type RuffConfig,
  type TscConfig,
} from "../types.js";
import {
  fetchRemoteFile,
  parseRemoteRef,
  RemoteFetchError,
} from "./fetcher.js";
import { mergeRulesets } from "./rulesets-merge.js";
import {
  type InheritedRules,
  type LinterTool,
  type ResolvedRuleset,
  RuleConflictError,
  RulesetFetchError,
  type RulesetsManifest,
  rulesetsManifestSchema,
} from "./rulesets-types.js";

// Re-export types and errors
export {
  type InheritedRules,
  type LinterTool,
  mergeRulesets,
  type ResolvedRuleset,
  RuleConflictError,
  RulesetFetchError,
  type RulesetsManifest,
};

/**
 * Build the base remote reference for manifest/file lookup.
 */
function buildRemoteRef(remoteRef: string): string {
  const ref = parseRemoteRef(remoteRef);
  return `github:${ref.owner}/${ref.repo}/rulesets@${ref.version}`;
}

/**
 * Extract the ruleset key from the remote reference path.
 */
function extractRulesetKey(remoteRef: string): string {
  const ref = parseRemoteRef(remoteRef);
  return ref.path.replace(/^rulesets\//, "");
}

/**
 * Fetch and parse the rulesets.json manifest from a remote repository.
 */
async function fetchManifest(remoteRef: string): Promise<RulesetsManifest> {
  const manifestRef = buildRemoteRef(remoteRef);
  const content = await fetchManifestContent(manifestRef);
  return parseManifestContent(content);
}

async function fetchManifestContent(manifestRef: string): Promise<string> {
  try {
    return await fetchRemoteFile(manifestRef, "rulesets.json");
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      throw new RulesetFetchError(
        `Failed to load rulesets.json manifest from ${manifestRef}: ${error.message}`,
      );
    }
    throw error;
  }
}

function parseManifestContent(content: string): RulesetsManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new RulesetFetchError(
      `Invalid rulesets.json manifest: JSON parse error`,
    );
  }

  const result = rulesetsManifestSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new RulesetFetchError(`Invalid rulesets.json manifest: ${errors}`);
  }

  return result.data;
}

/**
 * Resolve a version string to the actual file path using the manifest.
 */
function resolveVersion(
  manifest: RulesetsManifest,
  rulesetKey: string,
  requestedVersion: string,
): string {
  const entry = manifest.rulesets[rulesetKey];
  if (!entry) {
    const available = Object.keys(manifest.rulesets).join(", ") || "(none)";
    throw new RulesetFetchError(
      `Ruleset not found in manifest: ${rulesetKey}\nAvailable: ${available}`,
    );
  }

  const version = resolveVersionPointer(entry, requestedVersion, rulesetKey);
  return getVersionFilePath(entry, version, rulesetKey);
}

function resolveVersionPointer(
  entry: RulesetsManifest["rulesets"][string],
  requestedVersion: string,
  rulesetKey: string,
): string {
  if (requestedVersion !== "latest") return requestedVersion;

  const latestPointer = entry.versions.latest;
  if (!latestPointer || typeof latestPointer !== "string") {
    throw new RulesetFetchError(
      `No "latest" version defined for ruleset: ${rulesetKey}`,
    );
  }
  return latestPointer;
}

function getVersionFilePath(
  entry: RulesetsManifest["rulesets"][string],
  version: string,
  rulesetKey: string,
): string {
  const versionEntry = entry.versions[version];
  if (!versionEntry) {
    const available =
      Object.keys(entry.versions)
        .filter((v) => v !== "latest")
        .join(", ") || "(none)";
    throw new RulesetFetchError(
      `Version not found: ${version} for ${rulesetKey}\nAvailable: ${available}`,
    );
  }

  if (typeof versionEntry === "string") {
    throw new RulesetFetchError(
      `Invalid version entry for ${version}: expected object with file path`,
    );
  }

  return versionEntry.file;
}

/**
 * Fetch and parse a remote ruleset TOML file.
 */
async function fetchRulesetFile(
  remoteRef: string,
  filePath: string,
): Promise<unknown> {
  const fileRef = buildRemoteRef(remoteRef);

  let content: string;
  try {
    content = await fetchRemoteFile(fileRef, filePath);
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      throw new RulesetFetchError(
        `Failed to load remote ruleset file ${filePath}: ${error.message}`,
      );
    }
    throw error;
  }

  const TOML = await import("@iarna/toml");
  try {
    return TOML.parse(content);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Parse error";
    throw new RulesetFetchError(`Invalid TOML in remote ruleset: ${msg}`);
  }
}

/** Safely get nested object property */
function getNestedObject(
  obj: unknown,
  ...keys: string[]
): Record<string, unknown> | undefined {
  let current: unknown = obj;
  for (const key of keys) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current !== "object" || current === null) return undefined;
  return current as Record<string, unknown>;
}

/** Extract ESLint rules from parsed ruleset TOML */
function extractEslintRules(
  parsed: unknown,
): Record<string, ESLintRuleValue> | undefined {
  const eslint = getNestedObject(parsed, "rulesets", "eslint");
  if (!eslint) return undefined;
  return eslint.rules as Record<string, ESLintRuleValue> | undefined;
}

/** Extract Ruff config from parsed ruleset TOML */
function extractRuffConfig(parsed: unknown): RuffConfig | undefined {
  const ruff = getNestedObject(parsed, "rulesets", "ruff");
  return ruff as RuffConfig | undefined;
}

/** Extract TSC config from parsed ruleset TOML */
function extractTscConfig(parsed: unknown): TscConfig | undefined {
  const tsc = getNestedObject(parsed, "rulesets", "tsc");
  return tsc as TscConfig | undefined;
}

/**
 * Fetch a single ruleset from a remote reference.
 */
async function fetchRuleset(
  remoteRef: string,
  tool: LinterTool,
): Promise<ResolvedRuleset> {
  const ref = parseRemoteRef(remoteRef);
  const rulesetKey = extractRulesetKey(remoteRef);
  const manifest = await fetchManifest(remoteRef);
  const filePath = resolveVersion(manifest, rulesetKey, ref.version);
  const parsed = await fetchRulesetFile(remoteRef, filePath);

  return buildResolvedRuleset(remoteRef, tool, parsed);
}

function buildResolvedRuleset(
  source: string,
  tool: LinterTool,
  parsed: unknown,
): ResolvedRuleset {
  const result: ResolvedRuleset = { source, tool };

  switch (tool) {
    case "eslint":
      result.eslintRules = extractEslintRules(parsed);
      break;
    case "ruff":
      result.ruffConfig = extractRuffConfig(parsed);
      break;
    case "tsc":
      result.tscConfig = extractTscConfig(parsed);
      break;
  }

  return result;
}

/**
 * Resolve all extends references and fetch remote rulesets.
 */
export async function resolveExtends(
  extendsConfig: ExtendsConfig,
): Promise<InheritedRules> {
  const inherited: InheritedRules = {};
  const promises: Promise<void>[] = [];

  if (extendsConfig.eslint) {
    promises.push(
      fetchRuleset(extendsConfig.eslint, "eslint").then((result) => {
        if (result.eslintRules) {
          inherited.eslint = {
            source: result.source,
            rules: result.eslintRules,
          };
        }
      }),
    );
  }

  if (extendsConfig.ruff) {
    promises.push(
      fetchRuleset(extendsConfig.ruff, "ruff").then((result) => {
        if (result.ruffConfig) {
          inherited.ruff = { source: result.source, config: result.ruffConfig };
        }
      }),
    );
  }

  if (extendsConfig.tsc) {
    promises.push(
      fetchRuleset(extendsConfig.tsc, "tsc").then((result) => {
        if (result.tscConfig) {
          inherited.tsc = { source: result.source, config: result.tscConfig };
        }
      }),
    );
  }

  await Promise.all(promises);
  return inherited;
}
