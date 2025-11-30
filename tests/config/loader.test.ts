import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { loadConfig, ConfigNotFoundError, ConfigValidationError } from '../../src/config/loader.js';

describe('loadConfig', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(process.cwd(), `test-fixtures-config-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should load a valid config file', async () => {
    const configContent = `
[project]
name = "test-project"
category = "production"

[rulesets]
default = []

[ai]
enabled = false
`;
    const configPath = join(testDir, 'cmc.toml');
    await writeFile(configPath, configContent);

    const config = await loadConfig(configPath);

    expect(config.project.name).toBe('test-project');
    expect(config.project.category).toBe('production');
    expect(config.rulesets.default).toEqual([]);
    expect(config.ai?.enabled).toBe(false);
  });

  it('should throw ConfigNotFoundError when config file does not exist', async () => {
    const nonExistentPath = join(testDir, 'nonexistent.toml');

    await expect(loadConfig(nonExistentPath)).rejects.toThrow(ConfigNotFoundError);
  });

  it('should throw ConfigValidationError when project section is missing', async () => {
    const configContent = `
[rulesets]
default = []
`;
    const configPath = join(testDir, 'cmc.toml');
    await writeFile(configPath, configContent);

    await expect(loadConfig(configPath)).rejects.toThrow(ConfigValidationError);
  });

  it('should throw ConfigValidationError when project.name is missing', async () => {
    const configContent = `
[project]
category = "production"

[rulesets]
default = []
`;
    const configPath = join(testDir, 'cmc.toml');
    await writeFile(configPath, configContent);

    await expect(loadConfig(configPath)).rejects.toThrow(ConfigValidationError);
  });

  it('should throw ConfigValidationError when rulesets section is missing', async () => {
    const configContent = `
[project]
name = "test"
category = "production"
`;
    const configPath = join(testDir, 'cmc.toml');
    await writeFile(configPath, configContent);

    await expect(loadConfig(configPath)).rejects.toThrow(ConfigValidationError);
  });

  it('should set projectRoot to the directory containing the config', async () => {
    const configContent = `
[project]
name = "test"
category = "production"

[rulesets]
default = []
`;
    const configPath = join(testDir, 'cmc.toml');
    await writeFile(configPath, configContent);

    const config = await loadConfig(configPath);

    expect(config.projectRoot).toBe(testDir);
  });
});
