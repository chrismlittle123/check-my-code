/* eslint-disable no-await-in-loop -- Sequential ruleset resolution is intentional */
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { ProjectConfig, RulesetConfig } from '../types.js';
import defaultRulesetJson from './default-ruleset.json' with { type: 'json' };

export class RulesetResolver {
  private projectRoot: string;
  private cacheDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.cacheDir = join(projectRoot, '.cmc', 'cache');
  }

  async resolveRulesets(config: ProjectConfig): Promise<RulesetConfig[]> {
    const rulesets: RulesetConfig[] = [];

    // Resolve default rulesets
    if (config.rulesets.default && Array.isArray(config.rulesets.default)) {
      for (const ref of config.rulesets.default) {
        const ruleset = await this.resolveRuleset(ref);
        if (ruleset) {
          rulesets.push(ruleset);
        }
      }
    }

    // Resolve language-specific rulesets
    for (const [key, value] of Object.entries(config.rulesets)) {
      if (key === 'default') continue;

      if (value && typeof value === 'object' && 'rules' in value && Array.isArray(value.rules)) {
        for (const ref of value.rules) {
          const ruleset = await this.resolveRuleset(ref);
          if (ruleset) {
            rulesets.push(ruleset);
          }
        }
      }
    }

    // If no rulesets found, create a default one with common checks
    if (rulesets.length === 0) {
      rulesets.push(this.getDefaultRuleset());
    }

    return rulesets;
  }

  private async resolveRuleset(ref: string): Promise<RulesetConfig | null> {
    // Parse the ruleset reference
    const parsed = this.parseRulesetRef(ref);

    // Try to load from cache first
    const cachedPath = this.getCachePath(parsed);
    if (existsSync(cachedPath)) {
      return this.loadRulesetFromPath(cachedPath);
    }

    // For community rulesets, we'd fetch from the community repo
    // For git refs, we'd clone/fetch the repo
    // For now, return null and use default ruleset
    console.error(`Warning: Ruleset not found in cache: ${ref}`);
    console.error("Run 'cmc update' to fetch rulesets");

    return null;
  }

  private parseRulesetRef(ref: string): {
    source: 'community' | 'git';
    name: string;
    version: string | null;
    path?: string;
  } {
    // Format: community/name@version or git@host:org/repo.git#path@version
    if (ref.startsWith('community/')) {
      const rest = ref.slice('community/'.length);
      const [name, version] = rest.split('@');
      return {
        source: 'community',
        name,
        version: version || null,
      };
    }

    // Git reference
    const gitMatch = /^(git@|https:\/\/)(.+?)(?:#(.+?))?(?:@(.+))?$/.exec(ref);
    if (gitMatch) {
      return {
        source: 'git',
        name: gitMatch[2],
        path: gitMatch[3],
        version: gitMatch[4] || null,
      };
    }

    // Assume it's a local path or simple name
    return {
      source: 'community',
      name: ref,
      version: null,
    };
  }

  private getCachePath(parsed: ReturnType<typeof this.parseRulesetRef>): string {
    if (parsed.source === 'community') {
      const versionDir = parsed.version ? `@${parsed.version}` : 'latest';
      return join(this.cacheDir, 'community', `${parsed.name}${versionDir}`, 'ruleset.toml');
    }

    // For git sources
    const safeName = parsed.name.replace(/[/:]/g, '_');
    const versionDir = parsed.version ? `@${parsed.version}` : 'latest';
    return join(this.cacheDir, 'git', `${safeName}${versionDir}`, 'ruleset.toml');
  }

  private async loadRulesetFromPath(path: string): Promise<RulesetConfig | null> {
    try {
      const content = await readFile(path, 'utf-8');
      const TOML = await import('@iarna/toml');
      return TOML.parse(content) as unknown as RulesetConfig;
    } catch {
      return null;
    }
  }

  private getDefaultRuleset(): RulesetConfig {
    return defaultRulesetJson as RulesetConfig;
  }
}
