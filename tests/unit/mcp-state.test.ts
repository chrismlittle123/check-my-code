/**
 * Unit tests for mcp/state.ts
 * Tests the session state management for MCP server.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getState,
  recordFilesChecked,
  recordFixesApplied,
  recordViolationsFound,
  resetState,
  setConfigFound,
  setProjectRoot,
} from "../../src/mcp/state.js";

describe("MCP Session State", () => {
  beforeEach(() => {
    // Reset state before each test to ensure isolation
    resetState();
  });

  afterEach(() => {
    // Clean up after each test
    resetState();
  });

  describe("getState", () => {
    it("returns initial state correctly", () => {
      const state = getState();

      expect(state.projectRoot).toBeNull();
      expect(state.configFound).toBe(false);
      expect(state.stats.filesChecked).toBe(0);
      expect(state.stats.violationsFound).toBe(0);
      expect(state.stats.fixesApplied).toBe(0);
    });

    it("returns a copy of state (not reference)", () => {
      const state1 = getState();
      const state2 = getState();

      // Should be equal values
      expect(state1).toEqual(state2);

      // But different object references
      expect(state1).not.toBe(state2);
      expect(state1.stats).not.toBe(state2.stats);
    });
  });

  describe("setProjectRoot", () => {
    it("sets project root correctly", () => {
      setProjectRoot("/path/to/project");

      const state = getState();
      expect(state.projectRoot).toBe("/path/to/project");
    });

    it("overwrites previous project root", () => {
      setProjectRoot("/first/path");
      setProjectRoot("/second/path");

      const state = getState();
      expect(state.projectRoot).toBe("/second/path");
    });
  });

  describe("setConfigFound", () => {
    it("sets config found to true", () => {
      setConfigFound(true);

      const state = getState();
      expect(state.configFound).toBe(true);
    });

    it("sets config found to false", () => {
      setConfigFound(true);
      setConfigFound(false);

      const state = getState();
      expect(state.configFound).toBe(false);
    });
  });

  describe("recordFilesChecked", () => {
    it("records files checked count", () => {
      recordFilesChecked(10);

      const state = getState();
      expect(state.stats.filesChecked).toBe(10);
    });

    it("accumulates files checked count", () => {
      recordFilesChecked(5);
      recordFilesChecked(3);
      recordFilesChecked(2);

      const state = getState();
      expect(state.stats.filesChecked).toBe(10);
    });

    it("handles zero count", () => {
      recordFilesChecked(0);

      const state = getState();
      expect(state.stats.filesChecked).toBe(0);
    });
  });

  describe("recordViolationsFound", () => {
    it("records violations count", () => {
      recordViolationsFound(5);

      const state = getState();
      expect(state.stats.violationsFound).toBe(5);
    });

    it("accumulates violations count", () => {
      recordViolationsFound(3);
      recordViolationsFound(7);

      const state = getState();
      expect(state.stats.violationsFound).toBe(10);
    });
  });

  describe("recordFixesApplied", () => {
    it("records fixes count", () => {
      recordFixesApplied(8);

      const state = getState();
      expect(state.stats.fixesApplied).toBe(8);
    });

    it("accumulates fixes count", () => {
      recordFixesApplied(2);
      recordFixesApplied(4);
      recordFixesApplied(1);

      const state = getState();
      expect(state.stats.fixesApplied).toBe(7);
    });
  });

  describe("resetState", () => {
    it("resets all state to initial values", () => {
      // Set some state
      setProjectRoot("/some/path");
      setConfigFound(true);
      recordFilesChecked(100);
      recordViolationsFound(50);
      recordFixesApplied(25);

      // Reset
      resetState();

      // Verify all reset
      const state = getState();
      expect(state.projectRoot).toBeNull();
      expect(state.configFound).toBe(false);
      expect(state.stats.filesChecked).toBe(0);
      expect(state.stats.violationsFound).toBe(0);
      expect(state.stats.fixesApplied).toBe(0);
    });

    it("can be called multiple times", () => {
      resetState();
      resetState();
      resetState();

      const state = getState();
      expect(state.projectRoot).toBeNull();
    });
  });

  describe("combined operations", () => {
    it("handles typical session workflow", () => {
      // Session starts
      setProjectRoot("/my/project");
      setConfigFound(true);

      // First check
      recordFilesChecked(50);
      recordViolationsFound(10);

      // Apply fixes
      recordFixesApplied(7);

      // Second check after fixes
      recordFilesChecked(50);
      recordViolationsFound(3);

      const state = getState();
      expect(state.projectRoot).toBe("/my/project");
      expect(state.configFound).toBe(true);
      expect(state.stats.filesChecked).toBe(100);
      expect(state.stats.violationsFound).toBe(13);
      expect(state.stats.fixesApplied).toBe(7);
    });
  });
});
