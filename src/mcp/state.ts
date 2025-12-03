/**
 * Session state management for MCP server.
 * Tracks statistics about linting operations during the session.
 * State is in-memory only and resets when server restarts.
 */

export interface SessionStats {
  filesChecked: number;
  violationsFound: number;
  fixesApplied: number;
}

export interface SessionState {
  projectRoot: string | null;
  configFound: boolean;
  stats: SessionStats;
}

// In-memory session state
let state: SessionState = {
  projectRoot: null,
  configFound: false,
  stats: {
    filesChecked: 0,
    violationsFound: 0,
    fixesApplied: 0,
  },
};

export function getState(): SessionState {
  return { ...state, stats: { ...state.stats } };
}

export function setProjectRoot(root: string): void {
  state.projectRoot = root;
}

export function setConfigFound(found: boolean): void {
  state.configFound = found;
}

export function recordFilesChecked(count: number): void {
  state.stats.filesChecked += count;
}

export function recordViolationsFound(count: number): void {
  state.stats.violationsFound += count;
}

export function recordFixesApplied(count: number): void {
  state.stats.fixesApplied += count;
}

export function resetState(): void {
  state = {
    projectRoot: null,
    configFound: false,
    stats: {
      filesChecked: 0,
      violationsFound: 0,
      fixesApplied: 0,
    },
  };
}
