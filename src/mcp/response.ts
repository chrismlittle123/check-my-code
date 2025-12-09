/**
 * MCP response helpers for structured responses.
 */

// Error codes for structured error responses
export const ErrorCode = {
  CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND",
  CONFIG_INVALID: "CONFIG_INVALID",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  TEMPLATE_NOT_FOUND: "TEMPLATE_NOT_FOUND",
  RUNTIME_ERROR: "RUNTIME_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export interface SuccessResponse {
  success: true;
  [key: string]: unknown;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

export type ToolResponse = SuccessResponse | ErrorResponse;

export function makeError(
  code: string,
  message: string,
  recoverable = false,
): ErrorResponse {
  return {
    success: false,
    error: { code, message, recoverable },
  };
}

export function makeSuccess(data: Record<string, unknown>): SuccessResponse {
  return { success: true, ...data };
}

export interface TextContent {
  [x: string]: unknown;
  content: { type: "text"; text: string }[];
}

export function toTextContent(response: ToolResponse): TextContent {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(response, null, 2) },
    ],
  };
}
