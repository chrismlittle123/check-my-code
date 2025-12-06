/**
 * Unit tests for remote fetcher
 */

import { describe, expect, it } from "vitest";

import {
  clearCache,
  getCacheInfo,
  parseRemoteRef,
  RemoteFetchError,
} from "../../src/remote/fetcher.js";

describe("RemoteFetchError", () => {
  it("is a proper Error subclass", () => {
    const error = new RemoteFetchError("test error");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RemoteFetchError);
    expect(error.name).toBe("RemoteFetchError");
    expect(error.message).toBe("test error");
  });

  it("has a stack trace", () => {
    const error = new RemoteFetchError("test error");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("RemoteFetchError");
  });

  it("can be caught and identified", () => {
    const throwAndCatch = () => {
      try {
        throw new RemoteFetchError("fetch failed");
      } catch (e: unknown) {
        if (e instanceof RemoteFetchError) {
          return "caught RemoteFetchError";
        }
        return "caught other error";
      }
    };

    expect(throwAndCatch()).toBe("caught RemoteFetchError");
  });
});

describe("parseRemoteRef", () => {
  describe("valid references", () => {
    it("parses github reference with path and version", () => {
      const ref = parseRemoteRef(
        "github:chrismlittle123/check-my-code-community/rulesets/typescript@v1.0.0",
      );

      expect(ref).toEqual({
        host: "github",
        owner: "chrismlittle123",
        repo: "check-my-code-community",
        path: "rulesets/typescript",
        version: "v1.0.0",
      });
    });

    it("parses github reference with nested path", () => {
      const ref = parseRemoteRef("github:myorg/configs/deep/nested/path@main");

      expect(ref).toEqual({
        host: "github",
        owner: "myorg",
        repo: "configs",
        path: "deep/nested/path",
        version: "main",
      });
    });

    it("parses github reference without path", () => {
      const ref = parseRemoteRef("github:owner/repo@v2.0.0");

      expect(ref).toEqual({
        host: "github",
        owner: "owner",
        repo: "repo",
        path: "",
        version: "v2.0.0",
      });
    });

    it("parses @latest version", () => {
      const ref = parseRemoteRef("github:owner/repo/promptss@latest");

      expect(ref).toEqual({
        host: "github",
        owner: "owner",
        repo: "repo",
        path: "promptss",
        version: "latest",
      });
    });

    it("parses branch name as version", () => {
      const ref = parseRemoteRef("github:owner/repo/path@feature/branch-name");

      expect(ref).toEqual({
        host: "github",
        owner: "owner",
        repo: "repo",
        path: "path",
        version: "feature/branch-name",
      });
    });

    it("parses commit SHA as version", () => {
      const ref = parseRemoteRef("github:owner/repo@abc123def456");

      expect(ref).toEqual({
        host: "github",
        owner: "owner",
        repo: "repo",
        path: "",
        version: "abc123def456",
      });
    });

    it("parses semver versions with different formats", () => {
      const ref1 = parseRemoteRef("github:owner/repo@1.0.0");
      expect(ref1.version).toBe("1.0.0");

      const ref2 = parseRemoteRef("github:owner/repo@v1.2.3-beta.1");
      expect(ref2.version).toBe("v1.2.3-beta.1");

      const ref3 = parseRemoteRef("github:owner/repo@v0.0.1-alpha");
      expect(ref3.version).toBe("v0.0.1-alpha");
    });

    it("handles single-level path", () => {
      const ref = parseRemoteRef("github:owner/repo/configs@v1.0.0");

      expect(ref.path).toBe("configs");
    });

    it("handles deeply nested path", () => {
      const ref = parseRemoteRef("github:owner/repo/a/b/c/d/e/f@v1.0.0");

      expect(ref.path).toBe("a/b/c/d/e/f");
    });
  });

  describe("invalid references", () => {
    it("throws on missing host prefix", () => {
      expect(() => parseRemoteRef("owner/repo@v1.0.0")).toThrow(
        RemoteFetchError,
      );
    });

    it("throws on unsupported host", () => {
      expect(() => parseRemoteRef("gitlab:owner/repo@v1.0.0")).toThrow(
        RemoteFetchError,
      );
    });

    it("throws on missing version", () => {
      expect(() => parseRemoteRef("github:owner/repo/path")).toThrow(
        RemoteFetchError,
      );
    });

    it("throws on missing repo", () => {
      expect(() => parseRemoteRef("github:owner@v1.0.0")).toThrow(
        RemoteFetchError,
      );
    });

    it("throws on empty string", () => {
      expect(() => parseRemoteRef("")).toThrow(RemoteFetchError);
    });

    it("throws on malformed reference", () => {
      expect(() => parseRemoteRef("github:@v1.0.0")).toThrow(RemoteFetchError);
    });

    it("throws on reference without @ separator", () => {
      expect(() => parseRemoteRef("github:owner/repo/pathv1.0.0")).toThrow(
        RemoteFetchError,
      );
    });

    it("throws on bitbucket host", () => {
      expect(() => parseRemoteRef("bitbucket:owner/repo@v1.0.0")).toThrow(
        RemoteFetchError,
      );
    });

    it("error message includes expected format", () => {
      try {
        parseRemoteRef("invalid");
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(RemoteFetchError);
        expect((e as Error).message).toContain(
          "github:owner/repo/path@version",
        );
      }
    });

    it("error message includes the invalid reference", () => {
      try {
        parseRemoteRef("bad-ref");
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(RemoteFetchError);
        expect((e as Error).message).toContain("bad-ref");
      }
    });

    it("error message includes examples", () => {
      try {
        parseRemoteRef("invalid");
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(RemoteFetchError);
        expect((e as Error).message).toContain("Examples:");
      }
    });
  });
});

describe("getCacheInfo", () => {
  it("returns cache path and existence status", () => {
    const info = getCacheInfo();

    expect(info).toHaveProperty("path");
    expect(info).toHaveProperty("exists");
    expect(typeof info.path).toBe("string");
    expect(typeof info.exists).toBe("boolean");
    expect(info.path).toContain(".cmc");
    expect(info.path).toContain("cache");
  });
});

describe("clearCache", () => {
  it("does not throw when cache does not exist", () => {
    // This should not throw even if the cache doesn't exist
    expect(() => clearCache()).not.toThrow();
  });

  it("clears cache when it exists", () => {
    // Note: This test is a bit weak because we can't easily create/verify
    // the cache without actually cloning a repo. But it verifies the
    // function doesn't throw.
    clearCache();
    const info = getCacheInfo();
    // After clearing, cache should not exist
    expect(info.exists).toBe(false);
  });
});
