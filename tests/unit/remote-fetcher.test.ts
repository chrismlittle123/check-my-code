/**
 * Unit tests for remote fetcher
 */

import { describe, expect, it } from "vitest";

import { parseRemoteRef, RemoteFetchError } from "../../src/remote/fetcher.js";

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
  });
});
