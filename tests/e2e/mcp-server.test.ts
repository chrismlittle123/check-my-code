/**
 * E2E tests for `cmc mcp-server` command
 */

import { describe, it, expect } from 'vitest';
import { runMcp, runMcpListTools } from './runner.js';

function parseToolContent(response: unknown): unknown {
  const r = response as { result?: { content?: { type: string; text: string }[] } };
  if (!r?.result?.content?.[0]?.text) return null;
  try {
    return JSON.parse(r.result.content[0].text);
  } catch {
    return null;
  }
}

describe('cmc mcp-server - tools/list', () => {
  it('lists all available tools', async () => {
    const result = await runMcpListTools('mcp-server/default');

    expect(result.tools.length).toBeGreaterThan(0);
    const toolNames = result.tools.map((t) => t.name);

    expect(toolNames).toContain('check_files');
    expect(toolNames).toContain('check_project');
    expect(toolNames).toContain('fix_files');
    expect(toolNames).toContain('get_status');
    expect(toolNames).toContain('validate_config');
  });
});

describe('cmc mcp-server - check_files', () => {
  it('detects violations in specified files', async () => {
    const result = await runMcp('mcp-server/default', 'check_files', {
      files: ['violation.ts'],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { rule: string; linter: string }[];
      has_violations: boolean;
    };

    expect(content).not.toBeNull();
    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);
    expect(content.violations.some((v) => v.rule === 'no-var')).toBe(true);
  });

  it('returns no violations for clean files', async () => {
    const result = await runMcp('mcp-server/default', 'check_files', {
      files: ['clean.ts'],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      has_violations: boolean;
    };

    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(false);
  });

  it('returns error for nonexistent files', async () => {
    const result = await runMcp('mcp-server/default', 'check_files', {
      files: ['nonexistent.ts'],
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      error?: { code: string };
    };

    expect(content.success).toBe(false);
    expect(content.error?.code).toBe('FILE_NOT_FOUND');
  });
});

describe('cmc mcp-server - check_project', () => {
  it('checks entire project', async () => {
    const result = await runMcp('mcp-server/default', 'check_project', {});

    const content = parseToolContent(result.response) as {
      success: boolean;
      violations: { linter: string }[];
      has_violations: boolean;
    };

    expect(content.success).toBe(true);
    expect(content.has_violations).toBe(true);

    const eslintViolations = content.violations.filter((v) => v.linter === 'eslint');
    const ruffViolations = content.violations.filter((v) => v.linter === 'ruff');

    expect(eslintViolations.length).toBeGreaterThan(0);
    expect(ruffViolations.length).toBeGreaterThan(0);
  });
});

describe('cmc mcp-server - get_status', () => {
  it('returns session status', async () => {
    const result = await runMcp('mcp-server/default', 'get_status', {});

    const content = parseToolContent(result.response) as {
      success: boolean;
      config_found: boolean;
      session_stats: { files_checked: number };
    };

    expect(content.success).toBe(true);
    expect(content.config_found).toBe(true);
    expect(content.session_stats).toBeDefined();
  });
});

describe('cmc mcp-server - validate_config', () => {
  it('validates correct TOML config', async () => {
    const validConfig = `[project]
name = "my-project"

[rulesets.eslint.rules]
"no-console" = "warn"
`;

    const result = await runMcp('mcp-server/default', 'validate_config', {
      config: validConfig,
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      validated: boolean;
      parsed: { project: { name: string } };
    };

    expect(content.success).toBe(true);
    expect(content.validated).toBe(true);
    expect(content.parsed.project.name).toBe('my-project');
  });

  it('returns error for invalid TOML syntax', async () => {
    const invalidToml = `[project
name = "missing bracket"`;

    const result = await runMcp('mcp-server/default', 'validate_config', {
      config: invalidToml,
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      error?: { code: string };
    };

    expect(content.success).toBe(false);
    expect(content.error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns error for missing required fields', async () => {
    const missingName = `[project]
# name is missing
`;

    const result = await runMcp('mcp-server/default', 'validate_config', {
      config: missingName,
    });

    const content = parseToolContent(result.response) as {
      success: boolean;
      error?: { code: string };
    };

    expect(content.success).toBe(false);
    expect(content.error?.code).toBe('VALIDATION_ERROR');
  });
});
