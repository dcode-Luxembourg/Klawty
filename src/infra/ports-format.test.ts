import { describe, expect, it } from "vitest";
import {
  buildPortHints,
  classifyPortListener,
  formatPortDiagnostics,
  formatPortListener,
} from "./ports-format.js";

describe("ports-format", () => {
  it("classifies listeners across gateway, ssh, and unknown command lines", () => {
    const cases = [
      {
        listener: { commandLine: "ssh -N -L 2508:127.0.0.1:2508 user@host" },
        expected: "ssh",
      },
      {
        listener: { command: "ssh" },
        expected: "ssh",
      },
      {
        listener: { commandLine: "node /Users/me/Projects/klawty/dist/entry.js gateway" },
        expected: "gateway",
      },
      {
        listener: { commandLine: "python -m http.server 2508" },
        expected: "unknown",
      },
    ] as const;

    for (const testCase of cases) {
      expect(classifyPortListener(testCase.listener, 2508), JSON.stringify(testCase.listener)).toBe(
        testCase.expected,
      );
    }
  });

  it("builds ordered hints for mixed listener kinds and multiplicity", () => {
    expect(
      buildPortHints(
        [
          { commandLine: "node dist/index.js klawty gateway" },
          { commandLine: "ssh -N -L 2508:127.0.0.1:2508" },
          { commandLine: "python -m http.server 2508" },
        ],
        2508,
      ),
    ).toEqual([
      expect.stringContaining("Gateway already running locally."),
      "SSH tunnel already bound to this port. Close the tunnel or use a different local port in -L.",
      "Another process is listening on this port.",
      expect.stringContaining("Multiple listeners detected"),
    ]);
    expect(buildPortHints([], 2508)).toEqual([]);
  });

  it("formats listeners with pid, user, command, and address fallbacks", () => {
    expect(
      formatPortListener({ pid: 123, user: "alice", commandLine: "ssh -N", address: "::1" }),
    ).toBe("pid 123 alice: ssh -N (::1)");
    expect(formatPortListener({ command: "ssh", address: "127.0.0.1:2508" })).toBe(
      "pid ?: ssh (127.0.0.1:2508)",
    );
    expect(formatPortListener({})).toBe("pid ?: unknown");
  });

  it("formats free and busy port diagnostics", () => {
    expect(
      formatPortDiagnostics({
        port: 2508,
        status: "free",
        listeners: [],
        hints: [],
      }),
    ).toEqual(["Port 2508 is free."]);

    const lines = formatPortDiagnostics({
      port: 2508,
      status: "busy",
      listeners: [{ pid: 123, user: "alice", commandLine: "ssh -N -L 2508:127.0.0.1:2508" }],
      hints: buildPortHints([{ pid: 123, commandLine: "ssh -N -L 2508:127.0.0.1:2508" }], 2508),
    });
    expect(lines[0]).toContain("Port 2508 is already in use");
    expect(lines).toContain("- pid 123 alice: ssh -N -L 2508:127.0.0.1:2508");
    expect(lines.some((line) => line.includes("SSH tunnel"))).toBe(true);
  });
});
