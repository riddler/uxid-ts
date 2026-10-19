// The engine-neutrality stage claims two things about each of its rules: that
// a doc comment in shipped source can state the rule without tripping the
// check, and that the rule catches what it says it catches. Both are claims
// about regular expressions, so this suite executes them rather than
// describing them. Each rule carries the sentence that documents it and a line
// that violates it, beside the pattern; `--rules` hands that table over, and
// the tests below run the REAL check - the same file the gate runs, as a
// subprocess - against both.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const checker = fileURLToPath(new URL("../scripts/engine-neutrality.mjs", import.meta.url));

interface Rule {
  readonly id: string;
  readonly documentedBy: string;
  readonly violation: string;
}

function runChecker(args: readonly string[]): { status: number; output: string } {
  const result = spawnSync(process.execPath, [checker, ...args], { encoding: "utf8" });
  return {
    status: result.status ?? -1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

/** Scan files written into a directory emptied first: each name with its text. */
function scanFiles(
  root: string,
  files: Readonly<Record<string, string>>,
): { status: number; output: string } {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(root, name), text, "utf8");
  }
  return runChecker([root]);
}

/** Scan source text as the only file in a directory emptied first. */
function scanLine(root: string, line: string): { status: number; output: string } {
  return scanFiles(root, { "fixture.ts": `${line}\n` });
}

/**
 * The rule ids a run reported, one per finding. Matching the id as a whole
 * word of the finding line keeps one rule's id from standing in for another
 * that it happens to prefix.
 */
function firedRules(output: string): string[] {
  return [...output.matchAll(/^\S+:\d+:\d+: ([\w-]+)$/gm)].map((match) => match[1] ?? "");
}

const rulesRun = runChecker(["--rules"]);
const rules: readonly Rule[] = JSON.parse(rulesRun.output) as Rule[];

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "engine-neutrality-"));
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("the engine-neutrality rule table", () => {
  // Sabotage: emptying any rule's `documentedBy` or `violation` string in
  // scripts/engine-neutrality.mjs turns this red.
  it("gives every rule a documenting sentence and a violation", () => {
    expect(rulesRun.status).toBe(0);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.documentedBy.length, `${rule.id} documentedBy`).toBeGreaterThan(0);
      expect(rule.violation.length, `${rule.id} violation`).toBeGreaterThan(0);
    }
  });
});

describe("a doc comment may state the rules without tripping them", () => {
  // Sabotage: rewording a `documentedBy` sentence so that it writes a
  // construct with its anchor (a global followed by a member, say) turns that
  // rule's case red.
  it.each(rules.map((rule) => [rule.id, rule.documentedBy] as const))(
    "%s: its documenting sentence is clean as a comment",
    (id, documentedBy) => {
      const { status, output } = scanLine(root, `// ${documentedBy}`);
      expect(output, `${id} documenting sentence fired the check`).toContain("clean");
      expect(status, `${id} documenting sentence fired the check`).toBe(0);
    },
  );

  // Sabotage: as above. The check reads line by line, so this pins the
  // sentences as a real module header would carry them, all at once.
  it("every documenting sentence together, as one comment block, is clean", () => {
    const block = rules.map((rule) => `// ${rule.documentedBy}`).join("\n");
    const { status, output } = scanLine(root, block);
    expect(output).toContain("clean");
    expect(status).toBe(0);
  });
});

describe("every rule catches its own violation", () => {
  // Sabotage: replacing any rule's `pattern` in scripts/engine-neutrality.mjs
  // with one that cannot match (`/(?!)/g`) turns that rule's case red.
  it.each(rules.map((rule) => [rule.id, rule.violation] as const))(
    "%s: its violation fires that rule",
    (id, violation) => {
      const { status, output } = scanLine(root, violation);
      expect(status, `${id} violation passed the check`).toBe(1);
      expect(firedRules(output)).toContain(id);
    },
  );
});

// One line per branch of a rule's pattern, beyond the single violation the
// table carries, so that deleting any one alternative turns its case red.
const branchViolations: readonly (readonly [string, string])[] = [
  ["node-builtin-import", 'import { readFileSync } from "node:fs";'],
  ["node-builtin-import", 'const fs = await import("node:fs");'],
  ["node-builtin-import", 'const fs = require("node:fs");'],
  ["node-builtin-import-bare", 'import { join } from "path";'],
  ["node-builtin-import-bare", 'const c = require("crypto");'],
  ["package-import", 'import type { Pad } from "left-pad";'],
  ["package-import", 'const p = await import("@scope/pad");'],
  ["node-global-bare", "const a = __filename;"],
  ["node-global-bare", "module.exports = {};"],
  ["node-global-bare", 'const a = require("./local");'],
  ["node-global", 'const a = Buffer.from("x");'],
  ["node-global", "const a = globalThis.process.env;"],
  ["node-global", "const a = self.process?.env;"],
  ["node-global", 'const a = process["env"];'],
  ["dom-global", "const a = document.title;"],
  ["dom-global", "const a = globalThis.navigator.userAgent;"],
  ["dom-global", "const a = (globalThis).localStorage.length;"],
  ["dom-global-call", 'const r = XMLHttpRequest("x");'],
  ["node-global-call", "clearImmediate(handle);"],
  ["dynamic-code-function", 'const f = Function("return 1");'],
  ["dynamic-code-data-url", 'const a = "data:application/wasm;base64,AA";'],
  ["dynamic-code-alias", "const e = eval;"],
  ["dynamic-code-alias", 'const a = (0, eval)("1");'],
  ["dynamic-code-alias", 'const a = globalThis.eval("1");'],
  ["dynamic-code-alias", 'const a = globalThis["Function"];'],
  ["dynamic-code-alias", 'const f = (() => 0).constructor("return 1");'],
  ["reference-directive", '/// <reference types="node" />'],
  ["global-merge", "  global {"],
  ["locale-sensitive", "const a = Intl.Collator;"],
  ["locale-sensitive", "const a = n.toLocaleString();"],
  ["locale-sensitive", 'const a = s.toLocaleUpperCase("tr");'],
];

describe("every branch of a rule fires", () => {
  // Sabotage: deleting `\brequire\s*\(\s*|` from `specifierPrefix` in
  // scripts/engine-neutrality.mjs turns the require cases red.
  it.each(branchViolations)("%s: %s", (id, line) => {
    const { status, output } = scanLine(root, line);
    expect(status, `${line} passed the check`).toBe(1);
    expect(firedRules(output)).toContain(id);
  });
});

// Ordinary code a library writes, which no rule may refuse.
const cleanCode: readonly string[] = [
  'import { encode } from "./encode";',
  'import type { Options } from "../options";',
  'export { decode } from "./decode.js";',
  "const id = options.process.id;",
  "const shown = view.window.size;",
  "dialog.alert(message);",
  "const upper = text.toUpperCase();",
  "const bytes = globalThis.crypto.getRandomValues(new Uint8Array(10));",
  "const evaluated = evaluate(input);",
];

describe("ordinary code stays clean", () => {
  // Sabotage: removing the `(?<![.\w$])` lookbehind from
  // `usedAsBareOrGlobalObjectMember` turns the member cases red.
  it.each(cleanCode)("%s", (line) => {
    const { status, output } = scanLine(root, line);
    expect(output, `${line} fired the check`).toContain("clean");
    expect(status).toBe(0);
  });

  // Sabotage: emptying the lookahead in `bareSpecifier` makes a bare builtin
  // fire `package-import` as well, and turns this red.
  it("reports a bare builtin import once, under its own rule", () => {
    const { output } = scanLine(root, 'import { join } from "path";');
    expect(firedRules(output)).toEqual(["node-builtin-import-bare"]);
  });
});

describe("what the stage refuses outside the rule table", () => {
  // Sabotage: making `sourceFiles` skip directories, or dropping ".cjs" from
  // `sourceExtensions`, turns this red.
  it("scans nested directories and the plain JavaScript extensions", () => {
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "nested"), { recursive: true });
    writeFileSync(join(root, "index.ts"), "export {};\n", "utf8");
    writeFileSync(join(root, "nested", "legacy.cjs"), 'const fs = require("fs");\n', "utf8");
    const { status, output } = runChecker([root]);
    expect(status).toBe(1);
    expect(output).toContain("nested/legacy.cjs:1:");
    expect(firedRules(output)).toContain("node-builtin-import-bare");
  });

  // Sabotage: dropping ".d.mts" from the list in `isDeclarationFile` turns
  // the second case red.
  it.each(["ambient.d.cts", "ambient.d.mts", "ambient.d.html.ts"])(
    "refuses the declaration file %s by its name",
    (name) => {
      const { status, output } = scanFiles(root, {
        "index.ts": "export {};\n",
        [name]: "export {};\n",
      });
      expect(status).toBe(1);
      expect(firedRules(output)).toEqual(["declaration-file"]);
    },
  );

  // Sabotage: making `isDeclarationFile` in scripts/engine-neutrality.mjs
  // return false turns this red.
  it("refuses a declaration file by its name", () => {
    const { status, output } = scanFiles(root, {
      "index.ts": "export {};\n",
      "ambient.d.ts": "export {};\n",
    });
    expect(status).toBe(1);
    expect(firedRules(output)).toEqual(["declaration-file"]);
  });

  // Sabotage: deleting the `found.length === 0` refusal in
  // scripts/engine-neutrality.mjs turns this red.
  it("refuses a directory with no source file in it rather than calling it clean", () => {
    const { status, output } = scanFiles(root, { "notes.txt": "no source here\n" });
    expect(status).toBe(1);
    expect(output).toContain("no source files found");
  });
});

describe("the gate's own run", () => {
  // Sabotage: adding `import "node:fs";` to src/index.ts turns this red.
  it("finds the shipped source clean under the build config's entries", () => {
    const { status, output } = runChecker([]);
    expect(output).toContain("clean under src/");
    expect(status).toBe(0);
  });
});
