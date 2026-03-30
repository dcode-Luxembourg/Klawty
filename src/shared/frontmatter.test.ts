import { describe, expect, it, test } from "vitest";
import {
  applyKlawtyManifestInstallCommonFields,
  getFrontmatterString,
  normalizeStringList,
  parseFrontmatterBool,
  parseKlawtyManifestInstallBase,
  resolveKlawtyManifestBlock,
  resolveKlawtyManifestInstall,
  resolveKlawtyManifestOs,
  resolveKlawtyManifestRequires,
} from "./frontmatter.js";

describe("shared/frontmatter", () => {
  test("normalizeStringList handles strings, arrays, and non-list values", () => {
    expect(normalizeStringList("a, b,,c")).toEqual(["a", "b", "c"]);
    expect(normalizeStringList([" a ", "", "b", 42])).toEqual(["a", "b", "42"]);
    expect(normalizeStringList(null)).toEqual([]);
  });

  test("getFrontmatterString extracts strings only", () => {
    expect(getFrontmatterString({ a: "b" }, "a")).toBe("b");
    expect(getFrontmatterString({ a: 1 }, "a")).toBeUndefined();
  });

  test("parseFrontmatterBool respects explicit values and fallback", () => {
    expect(parseFrontmatterBool("true", false)).toBe(true);
    expect(parseFrontmatterBool("false", true)).toBe(false);
    expect(parseFrontmatterBool(undefined, true)).toBe(true);
    expect(parseFrontmatterBool("maybe", false)).toBe(false);
  });

  test("resolveKlawtyManifestBlock reads current manifest keys and custom metadata fields", () => {
    expect(
      resolveKlawtyManifestBlock({
        frontmatter: {
          metadata: "{ klawty: { foo: 1, bar: 'baz' } }",
        },
      }),
    ).toEqual({ foo: 1, bar: "baz" });

    expect(
      resolveKlawtyManifestBlock({
        frontmatter: {
          pluginMeta: "{ klawty: { foo: 2 } }",
        },
        key: "pluginMeta",
      }),
    ).toEqual({ foo: 2 });
  });

  test("resolveKlawtyManifestBlock returns undefined for invalid input", () => {
    expect(resolveKlawtyManifestBlock({ frontmatter: {} })).toBeUndefined();
    expect(resolveKlawtyManifestBlock({ frontmatter: { metadata: "not-json5" } })).toBeUndefined();
    expect(resolveKlawtyManifestBlock({ frontmatter: { metadata: "123" } })).toBeUndefined();
    expect(resolveKlawtyManifestBlock({ frontmatter: { metadata: "[]" } })).toBeUndefined();
    expect(
      resolveKlawtyManifestBlock({ frontmatter: { metadata: "{ nope: { a: 1 } }" } }),
    ).toBeUndefined();
  });

  it("normalizes manifest requirement and os lists", () => {
    expect(
      resolveKlawtyManifestRequires({
        requires: {
          bins: "bun, node",
          anyBins: [" ffmpeg ", ""],
          env: ["KLAWTY_TOKEN", " KLAWTY_URL "],
          config: null,
        },
      }),
    ).toEqual({
      bins: ["bun", "node"],
      anyBins: ["ffmpeg"],
      env: ["KLAWTY_TOKEN", "KLAWTY_URL"],
      config: [],
    });
    expect(resolveKlawtyManifestRequires({})).toBeUndefined();
    expect(resolveKlawtyManifestOs({ os: [" darwin ", "linux", ""] })).toEqual(["darwin", "linux"]);
  });

  it("parses and applies install common fields", () => {
    const parsed = parseKlawtyManifestInstallBase(
      {
        type: " Brew ",
        id: "brew.git",
        label: "Git",
        bins: [" git ", "git"],
      },
      ["brew", "npm"],
    );

    expect(parsed).toEqual({
      raw: {
        type: " Brew ",
        id: "brew.git",
        label: "Git",
        bins: [" git ", "git"],
      },
      kind: "brew",
      id: "brew.git",
      label: "Git",
      bins: ["git", "git"],
    });
    expect(parseKlawtyManifestInstallBase({ kind: "bad" }, ["brew"])).toBeUndefined();
    expect(
      applyKlawtyManifestInstallCommonFields<{
        extra: boolean;
        id?: string;
        label?: string;
        bins?: string[];
      }>({ extra: true }, parsed!),
    ).toEqual({
      extra: true,
      id: "brew.git",
      label: "Git",
      bins: ["git", "git"],
    });
  });

  it("prefers explicit kind, ignores invalid common fields, and leaves missing ones untouched", () => {
    const parsed = parseKlawtyManifestInstallBase(
      {
        kind: " npm ",
        type: "brew",
        id: 42,
        label: null,
        bins: [" ", ""],
      },
      ["brew", "npm"],
    );

    expect(parsed).toEqual({
      raw: {
        kind: " npm ",
        type: "brew",
        id: 42,
        label: null,
        bins: [" ", ""],
      },
      kind: "npm",
    });
    expect(
      applyKlawtyManifestInstallCommonFields({ id: "keep", label: "Keep", bins: ["bun"] }, parsed!),
    ).toEqual({
      id: "keep",
      label: "Keep",
      bins: ["bun"],
    });
  });

  it("maps install entries through the parser and filters rejected specs", () => {
    expect(
      resolveKlawtyManifestInstall(
        {
          install: [{ id: "keep" }, { id: "drop" }, "bad"],
        },
        (entry) => {
          if (
            typeof entry === "object" &&
            entry !== null &&
            (entry as { id?: string }).id === "keep"
          ) {
            return { id: "keep" };
          }
          return undefined;
        },
      ),
    ).toEqual([{ id: "keep" }]);
  });
});
