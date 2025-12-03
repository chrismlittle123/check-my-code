/**
 * E2E tests for `cmc mcp-server` command
 *
 * Tests the MCP server by sending JSON-RPC messages via stdin
 * and verifying responses.
 */

import { describe, it, expect } from 'vitest';
import { runMcpToolCall, runMcpListTools } from './docker-runner.js';
import { dockerAvailable, images, setupImages } from './setup.js';

// Setup: Build required images
setupImages(['mcp-server/default']);

// Helper to parse tool response content
function parseToolContent(
  response: { result?: { content?: { type: string; text: string }[] } } | null
): unknown {
  if (!response?.result?.content?.[0]?.text) {
    return null;
  }
  try {
    return JSON.parse(response.result.content[0].text);
  } catch {
    return null;
  }
}

// =============================================================================
// MCP Server: Tool listing
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc mcp-server - tools/list', () => {
  it('lists all available tools', async () => {
    const result = await runMcpListTools(images['mcp-server/default']);

    expect(result.response).not.toBeNull();
    expect(result.response?.result?.tools).toBeDefined();

    const tools = result.response?.result?.tools ?? [];
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('check_files');
    expect(toolNames).toContain('check_project');
    expect(toolNames).toContain('fix_files');
    expect(toolNames).toContain('get_guidelines');
    expect(toolNames).toContain('get_status');
  }, 60000);

  it('provides descriptions for all tools', async () => {
    const result = await runMcpListTools(images['mcp-server/default']);

    const tools = result.response?.result?.tools ?? [];

    for (const tool of tools) {
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(0);
    }
  }, 60000);
});

// =============================================================================
// MCP Server: check_files tool
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc mcp-server - check_files', () => {
  it('detects violations in specified files', async () => {
    const result = await runMcpToolCall(images['mcp-server/default'], 'check_files', {
      files: ['violation.ts'],
    });

    expect(result.response).not.toBeNull();

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { rule: string; linter: string }[];
      files_checked: number;
      has_violations: boolean;
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);
    expect(content.files_checked).toBe(1);
    expect(content.violations.length).toBeGreaterThan(0);
    expect(content.violations.some((v) => v.rule === 'no-var')).toBe(true);
    expect(content.violations.every((v) => v.linter === 'eslint')).toBe(true);
  }, 60000);

  it('returns no violations for clean files', async () => {
    const result = await runMcpToolCall(images['mcp-server/default'], 'check_files', {
      files: ['clean.ts'],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: unknown[];
      has_violations: boolean;
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(false);
    expect(content.violations.length).toBe(0);
  }, 60000);

  it('checks multiple files at once', async () => {
    const result = await runMcpToolCall(images['mcp-server/default'], 'check_files', {
      files: ['violation.ts', 'clean.ts'],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      files_checked: number;
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.files_checked).toBe(2);
  }, 60000);

  it('returns error for nonexistent files', async () => {
    const result = await runMcpToolCall(images['mcp-server/default'], 'check_files', {
      files: ['nonexistent.ts'],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      error?: { code: string };
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(false);
    expect(content.error?.code).toBe('FILE_NOT_FOUND');
  }, 60000);

  it('checks Python files with Ruff', async () => {
    const result = await runMcpToolCall(images['mcp-server/default'], 'check_files', {
      files: ['violation.py'],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { rule: string; linter: string }[];
      has_violations: boolean;
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);
    expect(content.violations.some((v) => v.rule === 'F401')).toBe(true);
    expect(content.violations.every((v) => v.linter === 'ruff')).toBe(true);
  }, 60000);
});

// =============================================================================
// MCP Server: check_project tool
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc mcp-server - check_project', () => {
  it('checks entire project', async () => {
    const result = await runMcpToolCall(images['mcp-server/default'], 'check_project', {});

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { linter: string }[];
      files_checked: number;
      has_violations: boolean;
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    // Should find violations from both TypeScript and Python files
    expect(content.has_violations).toBe(true);
    // violation.ts, clean.ts, violation.py (3 lintable files, excluding configs)
    expect(content.files_checked).toBe(3);

    const eslintViolations = content.violations.filter((v) => v.linter === 'eslint');
    const ruffViolations = content.violations.filter((v) => v.linter === 'ruff');

    expect(eslintViolations.length).toBeGreaterThan(0);
    expect(ruffViolations.length).toBeGreaterThan(0);
  }, 60000);
});

// =============================================================================
// MCP Server: get_status tool
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc mcp-server - get_status', () => {
  it('returns session status', async () => {
    const result = await runMcpToolCall(images['mcp-server/default'], 'get_status', {});

    const content = parseToolContent(result.response) as {
      success: boolean;
      project_root: string;
      config_found: boolean;
      session_stats: {
        files_checked: number;
        violations_found: number;
        fixes_applied: number;
      };
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.project_root).toBeDefined();
    expect(content.config_found).toBe(true);
    expect(content.session_stats).toBeDefined();
    expect(content.session_stats.files_checked).toBeTypeOf('number');
    expect(content.session_stats.violations_found).toBeTypeOf('number');
    expect(content.session_stats.fixes_applied).toBeTypeOf('number');
  }, 60000);
});

// =============================================================================
// MCP Server: fix_files tool
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc mcp-server - fix_files', () => {
  it('attempts to fix violations in files', async () => {
    const result = await runMcpToolCall(images['mcp-server/default'], 'fix_files', {
      files: ['violation.ts'],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      fixed_count: number;
      remaining_violations: unknown[];
      files_modified: string[];
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.fixed_count).toBeTypeOf('number');
    expect(content.remaining_violations).toBeDefined();
    expect(Array.isArray(content.files_modified)).toBe(true);
  }, 60000);

  it('returns error for nonexistent files', async () => {
    const result = await runMcpToolCall(images['mcp-server/default'], 'fix_files', {
      files: ['nonexistent.ts'],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      error?: { code: string };
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(false);
    expect(content.error?.code).toBe('FILE_NOT_FOUND');
  }, 60000);
});

// =============================================================================
// MCP Server: Structured error responses
// =============================================================================
describe.skipIf(!dockerAvailable)('cmc mcp-server - error handling', () => {
  it('returns structured error for invalid files', async () => {
    const result = await runMcpToolCall(images['mcp-server/default'], 'check_files', {
      files: ['does-not-exist.ts'],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      error?: {
        code: string;
        message: string;
        recoverable: boolean;
      };
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(false);
    expect(content.error).toBeDefined();
    expect(content.error?.code).toBe('FILE_NOT_FOUND');
    expect(content.error?.message).toBeDefined();
    expect(content.error?.recoverable).toBeTypeOf('boolean');
  }, 60000);
});
