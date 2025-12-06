/**
 * Command execution utilities for linter module.
 */

import { spawn } from "child_process";

import { CommandError, CommandErrorWithStderr } from "./types.js";

export async function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, ["--version"], { stdio: "ignore" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

export function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let _stderr = "";

    const proc = spawn(cmd, args, { cwd });

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data: Buffer) => {
      _stderr += data.toString();
    });

    proc.on("error", (err) =>
      reject(new Error(`Failed to run ${cmd}: ${err.message}`)),
    );
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new CommandError(`${cmd} exited with code ${code}`, stdout));
      }
    });
  });
}

export function runCommandWithStderr(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn(cmd, args, { cwd });

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (err) =>
      reject(new Error(`Failed to run ${cmd}: ${err.message}`)),
    );
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new CommandErrorWithStderr(
            `${cmd} exited with code ${code}`,
            stdout,
            stderr,
          ),
        );
      }
    });
  });
}
