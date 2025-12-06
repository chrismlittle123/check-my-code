/**
 * Built-in JSON schemas for registry validation.
 */

import { type RegistryType } from "./types.js";

const VERSION_MAP_SCHEMA = {
  type: "object",
  required: ["latest"],
  properties: {
    latest: {
      type: "string",
      pattern: "^\\d+\\.\\d+\\.\\d+$",
      description: "The latest version identifier",
    },
  },
};

export const PROMPTS_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://palindrom.dev/schemas/prompts.schema.json",
  title: "Prompts Registry",
  description:
    "Schema for the prompts registry that tracks coding standards prompts",
  type: "object",
  required: ["schema_version", "prompts"],
  additionalProperties: false,
  properties: {
    schema_version: {
      type: "string",
      pattern: "^\\d+\\.\\d+\\.\\d+$",
      description: "Semantic version of this schema",
    },
    prompts: {
      type: "object",
      description: "Map of prompt identifiers to their configurations",
      additionalProperties: false,
      patternProperties: {
        "^(prototype|internal|production)/[a-z]+/[0-9.]+$": {
          $ref: "#/$defs/promptEntry",
        },
      },
    },
  },
  $defs: {
    promptEntry: {
      type: "object",
      required: [
        "tier",
        "description",
        "format",
        "language_version",
        "versions",
      ],
      additionalProperties: false,
      properties: {
        tier: {
          type: "string",
          enum: ["prototype", "internal", "production"],
          description: "The quality tier for this prompt",
        },
        description: {
          type: "string",
          minLength: 1,
          description: "Human-readable description of this prompt",
        },
        format: {
          type: "string",
          enum: ["md", "txt"],
          description: "File format of the prompt files",
        },
        language_version: {
          type: "string",
          pattern: "^[0-9.]+$",
          description: "Version of the programming language",
        },
        runtime_version: {
          type: "string",
          pattern: "^[a-z]+[0-9]+$",
          description: "Runtime version (e.g., node20)",
        },
        versions: {
          ...VERSION_MAP_SCHEMA,
          additionalProperties: {
            oneOf: [
              {
                type: "object",
                required: ["file"],
                additionalProperties: false,
                properties: {
                  file: {
                    type: "string",
                    pattern: "^[a-z]+/[a-z]+/[0-9.]+/[0-9.]+\\.md$",
                    description: "Relative path to the prompt file",
                  },
                },
              },
              {
                type: "string",
                pattern: "^\\d+\\.\\d+\\.\\d+$",
              },
            ],
          },
        },
      },
    },
  },
};

export const RULESETS_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://palindrom.dev/schemas/rulesets.schema.json",
  title: "Rulesets Registry",
  description:
    "Schema for the rulesets registry that tracks linter/formatter configurations",
  type: "object",
  required: ["schema_version", "rulesets"],
  additionalProperties: false,
  properties: {
    schema_version: {
      type: "string",
      pattern: "^\\d+\\.\\d+\\.\\d+$",
      description: "Semantic version of this schema",
    },
    rulesets: {
      type: "object",
      description: "Map of ruleset identifiers to their configurations",
      additionalProperties: false,
      patternProperties: {
        "^(prototype|internal|production)/[a-z]+/[0-9.]+(/[a-z]+)?$": {
          $ref: "#/$defs/rulesetEntry",
        },
      },
    },
  },
  $defs: {
    rulesetEntry: {
      type: "object",
      required: ["tier", "description", "tool", "format", "versions"],
      additionalProperties: false,
      properties: {
        tier: {
          type: "string",
          enum: ["prototype", "internal", "production"],
          description: "The quality tier for this ruleset",
        },
        description: {
          type: "string",
          minLength: 1,
          description: "Human-readable description of this ruleset",
        },
        tool: {
          type: "string",
          enum: ["ruff", "eslint", "biome", "prettier", "tsc"],
          description: "The linting/formatting tool this ruleset is for",
        },
        format: {
          type: "string",
          enum: ["toml", "json", "yaml", "js"],
          description: "File format of the ruleset files",
        },
        target_version: {
          type: "string",
          pattern: "^py[0-9]+$",
          description: "Python target version (e.g., py312)",
        },
        language_version: {
          type: "string",
          pattern: "^[0-9.]+$",
          description: "Language version (e.g., 5.5 for TypeScript)",
        },
        runtime_version: {
          type: "string",
          pattern: "^[a-z]+[0-9]+$",
          description: "Runtime version (e.g., node20)",
        },
        versions: {
          ...VERSION_MAP_SCHEMA,
          additionalProperties: {
            oneOf: [
              {
                type: "object",
                required: ["file"],
                additionalProperties: false,
                properties: {
                  file: {
                    type: "string",
                    pattern:
                      "^[a-z]+/[a-z]+/[0-9.]+/[a-z]+/[0-9.]+\\.(toml|json|yaml|js)$",
                    description: "Relative path to the ruleset file",
                  },
                },
              },
              {
                type: "string",
                pattern: "^\\d+\\.\\d+\\.\\d+$",
              },
            ],
          },
        },
      },
    },
  },
};

export function getBuiltInSchema(type: RegistryType): object {
  return type === "prompts" ? PROMPTS_SCHEMA : RULESETS_SCHEMA;
}
