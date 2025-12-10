/**
 * Unit tests for requirements validation module
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkRequirements,
  hasRequirements,
} from "../../src/requirements/index.js";
import { checkTool } from "../../src/requirements/tools.js";
import type { Config } from "../../src/types.js";

const TEST_DIR = join(process.cwd(), "tests", "unit", "temp-requirements");

describe("hasRequirements", () => {
  it("returns false when no requirements configured", () => {
    const config: Config = { project: { name: "test" } };
    expect(hasRequirements(config)).toBe(false);
  });

  it("returns false when requirements is empty object", () => {
    const config: Config = { project: { name: "test" }, requirements: {} };
    expect(hasRequirements(config)).toBe(false);
  });

  it("returns true when files are configured", () => {
    const config: Config = {
      project: { name: "test" },
      requirements: { files: ["README.md"] },
    };
    expect(hasRequirements(config)).toBe(true);
  });

  it("returns true when tools are configured", () => {
    const config: Config = {
      project: { name: "test" },
      requirements: { tools: ["gitleaks"] },
    };
    expect(hasRequirements(config)).toBe(true);
  });

  it("returns true when both are configured", () => {
    const config: Config = {
      project: { name: "test" },
      requirements: { files: ["README.md"], tools: ["gitleaks"] },
    };
    expect(hasRequirements(config)).toBe(true);
  });
});

describe("checkRequirements - files", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("passes when all required files exist", () => {
    writeFileSync(join(TEST_DIR, "README.md"), "# Test");
    writeFileSync(join(TEST_DIR, "CLAUDE.md"), "# Claude");

    const config: Config = {
      project: { name: "test" },
      requirements: { files: ["README.md", "CLAUDE.md"] },
    };

    const result = checkRequirements(TEST_DIR, config);

    expect(result.passed).toBe(true);
    expect(result.files.passed).toBe(true);
    expect(result.files.missing).toHaveLength(0);
  });

  it("fails when some required files are missing", () => {
    writeFileSync(join(TEST_DIR, "README.md"), "# Test");

    const config: Config = {
      project: { name: "test" },
      requirements: { files: ["README.md", "MISSING.md"] },
    };

    const result = checkRequirements(TEST_DIR, config);

    expect(result.passed).toBe(false);
    expect(result.files.passed).toBe(false);
    expect(result.files.missing).toContain("MISSING.md");
  });

  it("handles nested file paths", () => {
    mkdirSync(join(TEST_DIR, ".github"), { recursive: true });
    writeFileSync(join(TEST_DIR, ".github", "CODEOWNERS"), "* @owner");

    const config: Config = {
      project: { name: "test" },
      requirements: { files: [".github/CODEOWNERS"] },
    };

    const result = checkRequirements(TEST_DIR, config);

    expect(result.passed).toBe(true);
    expect(result.files.passed).toBe(true);
  });
});

describe("checkRequirements - tools", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("passes when npm-audit tool is configured (package.json exists)", () => {
    writeFileSync(
      join(TEST_DIR, "package.json"),
      JSON.stringify({ name: "test" }),
    );

    const config: Config = {
      project: { name: "test" },
      requirements: { tools: ["npm-audit"] },
    };

    const result = checkRequirements(TEST_DIR, config);

    expect(result.passed).toBe(true);
    expect(result.tools.passed).toBe(true);
  });

  it("fails when gitleaks is required but not configured", () => {
    const config: Config = {
      project: { name: "test" },
      requirements: { tools: ["gitleaks"] },
    };

    const result = checkRequirements(TEST_DIR, config);

    expect(result.passed).toBe(false);
    expect(result.tools.passed).toBe(false);
    expect(result.tools.missing[0].tool).toBe("gitleaks");
    expect(result.tools.missing[0].reason).toContain(".gitleaks");
  });

  it("passes when gitleaks config exists", () => {
    writeFileSync(join(TEST_DIR, ".gitleaks.toml"), "[rules]");

    const config: Config = {
      project: { name: "test" },
      requirements: { tools: ["gitleaks"] },
    };

    const result = checkRequirements(TEST_DIR, config);

    expect(result.passed).toBe(true);
    expect(result.tools.passed).toBe(true);
  });

  it("passes when knip.json exists", () => {
    writeFileSync(join(TEST_DIR, "knip.json"), "{}");

    const config: Config = {
      project: { name: "test" },
      requirements: { tools: ["knip"] },
    };

    const result = checkRequirements(TEST_DIR, config);

    expect(result.passed).toBe(true);
    expect(result.tools.passed).toBe(true);
  });
});

describe("checkTool - individual tool checkers", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe("ty checker", () => {
    it("returns configured when pyproject.toml has [tool.ty] section", () => {
      writeFileSync(
        join(TEST_DIR, "pyproject.toml"),
        "[tool.ty]\nstrict = true",
      );

      const result = checkTool(TEST_DIR, "ty");

      expect(result.configured).toBe(true);
    });

    it("returns not configured when pyproject.toml lacks [tool.ty]", () => {
      writeFileSync(join(TEST_DIR, "pyproject.toml"), "[project]\nname = 'x'");

      const result = checkTool(TEST_DIR, "ty");

      expect(result.configured).toBe(false);
      expect(result.reason).toContain("[tool.ty]");
    });
  });

  describe("gitleaks checker", () => {
    it("returns configured when .gitleaks.toml exists", () => {
      writeFileSync(join(TEST_DIR, ".gitleaks.toml"), "[rules]");

      const result = checkTool(TEST_DIR, "gitleaks");

      expect(result.configured).toBe(true);
    });

    it("returns configured when .gitleaks.yaml exists", () => {
      writeFileSync(join(TEST_DIR, ".gitleaks.yaml"), "rules: []");

      const result = checkTool(TEST_DIR, "gitleaks");

      expect(result.configured).toBe(true);
    });

    it("returns not configured when no gitleaks config", () => {
      const result = checkTool(TEST_DIR, "gitleaks");

      expect(result.configured).toBe(false);
      expect(result.reason).toContain(".gitleaks");
    });
  });

  describe("pip-audit checker", () => {
    it("returns configured when pyproject.toml exists", () => {
      writeFileSync(join(TEST_DIR, "pyproject.toml"), "[project]");

      const result = checkTool(TEST_DIR, "pip-audit");

      expect(result.configured).toBe(true);
    });

    it("returns configured when requirements.txt exists", () => {
      writeFileSync(join(TEST_DIR, "requirements.txt"), "requests==2.28.0");

      const result = checkTool(TEST_DIR, "pip-audit");

      expect(result.configured).toBe(true);
    });

    it("returns not configured when no Python deps file", () => {
      const result = checkTool(TEST_DIR, "pip-audit");

      expect(result.configured).toBe(false);
    });
  });

  describe("knip checker", () => {
    it("returns configured when knip.json exists", () => {
      writeFileSync(join(TEST_DIR, "knip.json"), "{}");

      const result = checkTool(TEST_DIR, "knip");

      expect(result.configured).toBe(true);
    });

    it("returns configured when package.json has knip key", () => {
      writeFileSync(
        join(TEST_DIR, "package.json"),
        JSON.stringify({ name: "test", knip: {} }),
      );

      const result = checkTool(TEST_DIR, "knip");

      expect(result.configured).toBe(true);
    });

    it("returns not configured when no knip config", () => {
      const result = checkTool(TEST_DIR, "knip");

      expect(result.configured).toBe(false);
    });
  });

  describe("vulture checker", () => {
    it("returns configured when pyproject.toml has [tool.vulture]", () => {
      writeFileSync(
        join(TEST_DIR, "pyproject.toml"),
        "[tool.vulture]\nmin_confidence = 80",
      );

      const result = checkTool(TEST_DIR, "vulture");

      expect(result.configured).toBe(true);
    });

    it("returns not configured when no vulture config", () => {
      writeFileSync(join(TEST_DIR, "pyproject.toml"), "[project]");

      const result = checkTool(TEST_DIR, "vulture");

      expect(result.configured).toBe(false);
    });
  });
});

describe("checkRequirements - combined files and tools", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("passes when both files and tools requirements are met", () => {
    writeFileSync(join(TEST_DIR, "README.md"), "# Test");
    writeFileSync(
      join(TEST_DIR, "package.json"),
      JSON.stringify({ name: "x" }),
    );

    const config: Config = {
      project: { name: "test" },
      requirements: { files: ["README.md"], tools: ["npm-audit"] },
    };

    const result = checkRequirements(TEST_DIR, config);

    expect(result.passed).toBe(true);
    expect(result.files.passed).toBe(true);
    expect(result.tools.passed).toBe(true);
  });

  it("fails when files pass but tools fail", () => {
    writeFileSync(join(TEST_DIR, "README.md"), "# Test");

    const config: Config = {
      project: { name: "test" },
      requirements: { files: ["README.md"], tools: ["gitleaks"] },
    };

    const result = checkRequirements(TEST_DIR, config);

    expect(result.passed).toBe(false);
    expect(result.files.passed).toBe(true);
    expect(result.tools.passed).toBe(false);
  });

  it("fails when tools pass but files fail", () => {
    writeFileSync(
      join(TEST_DIR, "package.json"),
      JSON.stringify({ name: "x" }),
    );

    const config: Config = {
      project: { name: "test" },
      requirements: { files: ["MISSING.md"], tools: ["npm-audit"] },
    };

    const result = checkRequirements(TEST_DIR, config);

    expect(result.passed).toBe(false);
    expect(result.files.passed).toBe(false);
    expect(result.tools.passed).toBe(true);
  });
});
