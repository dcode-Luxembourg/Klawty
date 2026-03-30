import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs(["node", "klawty", "gateway", "--dev", "--allow-unconfigured"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "klawty", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "klawty", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "klawty", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "klawty", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "klawty", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "klawty", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "klawty", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "klawty", "--profile", "work", "--dev", "status"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".klawty-dev");
    expect(env.KLAWTY_PROFILE).toBe("dev");
    expect(env.KLAWTY_STATE_DIR).toBe(expectedStateDir);
    expect(env.KLAWTY_CONFIG_PATH).toBe(path.join(expectedStateDir, "klawty.json"));
    expect(env.KLAWTY_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      KLAWTY_STATE_DIR: "/custom",
      KLAWTY_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.KLAWTY_STATE_DIR).toBe("/custom");
    expect(env.KLAWTY_GATEWAY_PORT).toBe("19099");
    expect(env.KLAWTY_CONFIG_PATH).toBe(path.join("/custom", "klawty.json"));
  });

  it("uses KLAWTY_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      KLAWTY_HOME: "/srv/klawty-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/klawty-home");
    expect(env.KLAWTY_STATE_DIR).toBe(path.join(resolvedHome, ".klawty-work"));
    expect(env.KLAWTY_CONFIG_PATH).toBe(path.join(resolvedHome, ".klawty-work", "klawty.json"));
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "klawty doctor --fix",
      env: {},
      expected: "klawty doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "klawty doctor --fix",
      env: { KLAWTY_PROFILE: "default" },
      expected: "klawty doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "klawty doctor --fix",
      env: { KLAWTY_PROFILE: "Default" },
      expected: "klawty doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "klawty doctor --fix",
      env: { KLAWTY_PROFILE: "bad profile" },
      expected: "klawty doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "klawty --profile work doctor --fix",
      env: { KLAWTY_PROFILE: "work" },
      expected: "klawty --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "klawty --dev doctor",
      env: { KLAWTY_PROFILE: "dev" },
      expected: "klawty --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("klawty doctor --fix", { KLAWTY_PROFILE: "work" })).toBe(
      "klawty --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("klawty doctor --fix", { KLAWTY_PROFILE: "  jbklawty  " })).toBe(
      "klawty --profile jbklawty doctor --fix",
    );
  });

  it("handles command with no args after klawty", () => {
    expect(formatCliCommand("klawty", { KLAWTY_PROFILE: "test" })).toBe("klawty --profile test");
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm klawty doctor", { KLAWTY_PROFILE: "work" })).toBe(
      "pnpm klawty --profile work doctor",
    );
  });
});
