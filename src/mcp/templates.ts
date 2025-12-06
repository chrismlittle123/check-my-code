/**
 * Template loading utilities for MCP tools.
 */

import { fetchRemoteFile, RemoteFetchError } from "../remote/fetcher.js";
import { ErrorCode, type ErrorResponse, makeError } from "./response.js";

// Manifest structure for prompts.json
export interface PromptsManifest {
  schema_version: string;
  prompts: Record<
    string,
    {
      description: string;
      format: string;
      versions: Record<string, string | { file: string }>;
    }
  >;
}

/**
 * Load prompts manifest from remote source
 */
export async function loadManifest(source: string): Promise<PromptsManifest> {
  const content = await fetchRemoteFile(source, "prompts.json");
  return JSON.parse(content) as PromptsManifest;
}

/**
 * Resolve template file path from manifest
 */
export function resolveTemplatePath(
  manifest: PromptsManifest,
  templateName: string,
  requestedVersion?: string,
): string | ErrorResponse {
  const prompt = manifest.prompts[templateName];
  if (!prompt) {
    const available = Object.keys(manifest.prompts).join(", ");
    return makeError(
      ErrorCode.TEMPLATE_NOT_FOUND,
      `Template "${templateName}" not found. Available: ${available}`,
      false,
    );
  }

  const version = requestedVersion ?? "latest";
  const versionEntry = prompt.versions[version];

  if (!versionEntry) {
    const availableVersions = Object.keys(prompt.versions).join(", ");
    return makeError(
      ErrorCode.TEMPLATE_NOT_FOUND,
      `Version "${version}" not found for "${templateName}". Available: ${availableVersions}`,
      false,
    );
  }

  if (typeof versionEntry === "string") {
    const resolvedEntry = prompt.versions[versionEntry];
    if (!resolvedEntry || typeof resolvedEntry === "string") {
      return makeError(
        ErrorCode.TEMPLATE_NOT_FOUND,
        `Invalid version reference for "${templateName}@${version}"`,
        false,
      );
    }
    return resolvedEntry.file;
  }

  return versionEntry.file;
}

function parseTemplateName(templateName: string): {
  name: string;
  version?: string;
} {
  const parts = templateName.split("@");
  return { name: parts[0] ?? templateName, version: parts[1] };
}

async function loadManifestSafe(
  source: string,
): Promise<PromptsManifest | ErrorResponse> {
  try {
    return await loadManifest(source);
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      return makeError(
        ErrorCode.TEMPLATE_NOT_FOUND,
        `Failed to load manifest: ${error.message}`,
        false,
      );
    }
    throw error;
  }
}

async function fetchTemplateFile(
  source: string,
  filePath: string,
  templateName: string,
): Promise<string | ErrorResponse> {
  try {
    return await fetchRemoteFile(source, filePath);
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      return makeError(
        ErrorCode.TEMPLATE_NOT_FOUND,
        `Template "${templateName}": ${error.message}`,
        false,
      );
    }
    throw error;
  }
}

/**
 * Load a single template from remote source
 */
export async function loadTemplate(
  templateName: string,
  source: string,
): Promise<string | ErrorResponse> {
  const { name, version } = parseTemplateName(templateName);

  const manifest = await loadManifestSafe(source);
  if ("error" in manifest) return manifest;

  const filePath = resolveTemplatePath(manifest, name, version);
  if (typeof filePath !== "string") return filePath;

  return fetchTemplateFile(source, filePath, templateName);
}

/**
 * Load multiple templates sequentially
 */
export async function loadAllTemplates(
  templates: string[],
  source: string,
): Promise<{ contents: string[]; loaded: string[] } | ErrorResponse> {
  const contents: string[] = [];
  const loaded: string[] = [];

  for (const template of templates) {
    // Sequential loading to avoid race conditions in git cache
    // eslint-disable-next-line no-await-in-loop
    const result = await loadTemplate(template, source);
    if (typeof result !== "string") {
      return result; // Error response
    }
    contents.push(result);
    loaded.push(template);
  }

  return { contents, loaded };
}
