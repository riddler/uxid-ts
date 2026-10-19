// The engine-neutrality check: one gate stage that refuses the constructs
// shipped source may never contain.
//
// `src/` has to run unchanged on a server runtime (Node 20 and later, Deno,
// Bun), in a browser, and on a React Native JavaScript engine. So it imports
// no Node built-in and no package, touches no Node or DOM global, constructs
// no code at run time, widens none of the type declarations it is checked
// against, and consults no locale data. CLAUDE.md states those rules as prose;
// this file makes them mechanical, so the author, the gate, CI and a reviewer
// all run the same check.
//
// What the rest of the gate already catches, and what it does not: `window`
// and `document` fail `tsc` because the `dom` lib is not in tsconfig, and a
// bare `eval()` is a Biome error. Everything else this file refuses
// typechecks and lints clean - a builtin import in every specifier form, the
// Node globals, `new Function()`, locale-sensitive comparison and formatting,
// for example. The overlap with the other two stages is deliberate: a stage
// that states the whole rule survives a tsconfig or Biome change that quietly
// drops half of it.
//
// EVERY RULE CARRIES THE SENTENCE THAT DOCUMENTS IT, AND THAT SENTENCE IS A
// TEST FIXTURE. `documentedBy` is the sentence a doc comment in shipped source
// would use to state the rule; `violation` is a line that genuinely breaks it.
// `test/engine-neutrality.test.ts` reads this table through `--rules` and
// asserts, for every rule, that the documenting sentence passes the WHOLE
// check as a comment and that the violation fires that exact rule. The suite
// checks that a sentence is quiet, never that it is accurate; accuracy is
// still read by a human.
//
// ANCHORING. Each pattern matches a forbidden NAME together with an ANCHOR:
// whatever is written beside the name to turn it into a use of the thing,
// most often punctuation - an opening parenthesis after a dynamic-evaluation
// name, a dotted member or an opening bracket after a global, a quoted
// specifier after an import keyword. This file reads text and does not parse
// it, so it cannot tell an anchor in a comment from the same anchor in code.
// Therefore a forbidden name is quiet in prose exactly when its anchor is
// absent, and fires in prose exactly when its anchor is present. A name with
// no anchor at all - the two module-path globals in the bare rule below -
// fires on every mention, which is why this comment describes them rather
// than spelling them. A word that merely contains a forbidden name is never
// matched, and since the full stop ending a sentence is the same character as
// a member access, a forbidden name should never be the last word of a
// sentence in a comment.
//
// WHAT THIS STAGE CANNOT SEE. A text scanner catches a construct that is
// written down and misses one assembled at run time: a reference captured
// into a variable and called later, a member reached through a computed key,
// anything arriving from a caller, a `require` or an import whose specifier is
// not a literal. A module outside the directory of every build entry is not
// scanned even when an entry imports it, because the scanned set is those
// directories and this stage follows no import. The written aliases of the
// dynamic-code entry points below are caught, because those are the shapes a
// developer actually writes; the rest is what code review is for.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// The plain JavaScript extensions are scanned beside the TypeScript ones: the
// bundler bundles such a file when an entry imports it, even though the source
// typecheck does not compile it.
const sourceExtensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

// Node built-ins are importable as `node:fs` and as a bare `fs`. The bare
// forms have to be listed, because a bare specifier is otherwise just a
// package name.
const listedNodeBuiltins = [
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
];

// The running Node's own list is folded in beside the written one, cut to the
// module name before any subpath, so a builtin the running Node has and the
// written list lacks is refused as well. The names Node lists only with the
// `node:` prefix are left out: without the prefix each is an ordinary package
// name, and the prefixed rule already refuses them with it.
const bareNodeBuiltins = [
  ...new Set([
    ...listedNodeBuiltins,
    ...builtinModules.filter((name) => !name.startsWith("node:")).map((name) => name.split("/")[0]),
  ]),
];

// A specifier reaches source in four shapes: after `from`, inside a dynamic
// `import(`, inside a `require(`, and right after a bare `import` with no
// binding (a side-effect import).
const specifierPrefix = String.raw`(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)`;
const bareNodeAlternation = bareNodeBuiltins.join("|");
// Several builtins ship subpaths, and a pattern that demands the closing quote
// right after the module name lets every one of them through.
const subpath = String.raw`(?:/[\w.-]+)*`;

// A BARE specifier - neither relative, nor absolute, nor carrying a URL
// scheme - names a package, and this package declares no dependencies at all.
// A bundler with no dependency list to hold back inlines whatever such an
// import resolves to, so the published tarball would carry a copy of that
// package while the manifest still said there was none. The body is the
// character set a package name is written in, matched to the closing quote:
// its first character excludes a dot and a slash (every relative and absolute
// form), and no character of it is a colon, so a specifier with a scheme never
// matches here. The lookahead leaves the bare builtins to their own rule, so
// an import is reported once, never twice. A type-only import is refused on
// the same terms: the declaration build keeps it, and the emitted types would
// name a package the consumer has not installed.
const bareSpecifier = String.raw`(?!(?:${bareNodeAlternation})${subpath}["'])[\w@][\w.@/+-]*`;

// Globals that only exist in a browser. Names a browser also defines but that
// are plausible ordinary identifiers (`location`, `Node`, `Element`, `fetch`)
// are left out on purpose.
const domGlobals = [
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "XMLHttpRequest",
  "HTMLElement",
  "alert",
];

// Globals that only exist on Node. `process.env` and `Buffer.from` break a
// constrained engine exactly as an import would.
const nodeGlobals = ["process", "Buffer", "global", "setImmediate", "clearImmediate"];

const domAlternation = domGlobals.join("|");
const nodeGlobalAlternation = nodeGlobals.join("|");

// The globals whose realistic use is a call or a construction, which the
// property-or-index anchor below never meets, so each list gets a call rule
// of its own as well.
const domCalledGlobals = ["alert", "XMLHttpRequest"];
const nodeCalledGlobals = ["setImmediate", "clearImmediate"];

// A global is only a global when it is USED as one: a property access or an
// index. Space may come before the dot, an optional-chaining dot counts as a
// dot, and the character after the dot may be a dollar sign. Space AFTER the
// dot does not count, so the English "a sliding window. Documentation of ..."
// stays quiet. And a global is not a MEMBER of that name: the lookbehind tells
// `process.env` (a global) from `options.process.id` (a member). One member is
// the global itself: the name still fires after `globalThis`, after a `self`
// that is not itself a member, or after either wrapped in parentheses that do
// not close a call's arguments.
const globalObject = String.raw`(?:\bglobalThis|(?<![.\w$])self|(?<![\w$.)\]])\(\s*(?:globalThis|self)\s*\))`;
const globalObjectMember = String.raw`(?<=${globalObject}\s*\??\.)`;
const usedAsBareOrGlobalObjectMember = (alternation) =>
  String.raw`(?:(?<![.\w$])|${globalObjectMember})(?:${alternation})(?:\s*\??\.[\w$]|\s*\?\.\[|\[)`;

// A called global: the opening parenthesis with no space before it, behind the
// same lookbehind, so a method of that name called on some other object stays
// quiet. A definition of that name fires too; that over-refusal is accepted.
const calledAsBareGlobal = (alternation) => String.raw`(?<![.\w$])(?:${alternation})\(`;

// Space as the compiler reads it between two tokens on one line: whitespace,
// or a block comment that closes on the same line.
const spaceOrBlockComment = String.raw`(?:\s|/\*.*?\*/)`;

// The tail of a block comment opened on an earlier line: any text holding no
// comment opener, up to the first comment close on the line.
const tailOfEarlierBlockComment = String.raw`(?:(?:(?!/\*).)*?\*/)`;

const rules = [
  {
    id: "dom-global",
    pattern: new RegExp(usedAsBareOrGlobalObjectMember(domAlternation), "g"),
    why: "shipped source may not touch a DOM global; it has to run where there is no DOM",
    documentedBy:
      "This module touches no browser global: no window object, no document object, and nothing else the DOM defines.",
    violation: "const a = window.innerWidth;",
  },
  {
    id: "node-global",
    pattern: new RegExp(usedAsBareOrGlobalObjectMember(nodeGlobalAlternation), "g"),
    why: "shipped source may not touch a Node global; it has to run where there is no Node",
    documentedBy:
      "This module touches no Node global, so it never reads the process environment and never builds a Buffer.",
    violation: "const a = process.env.HOME;",
  },
  {
    id: "dom-global-call",
    pattern: new RegExp(calledAsBareGlobal(domCalledGlobals.join("|")), "g"),
    why: "shipped source may not call a DOM global; it has to run where there is no DOM",
    documentedBy:
      "This module calls no browser global: it raises no dialog and opens no request object.",
    violation: 'alert("declined");',
  },
  {
    id: "node-global-call",
    pattern: new RegExp(calledAsBareGlobal(nodeCalledGlobals.join("|")), "g"),
    why: "shipped source may not call a Node global; it has to run where there is no Node",
    documentedBy:
      "This module calls no Node global, so it schedules nothing on the Node event loop.",
    violation: "setImmediate(run);",
  },
  {
    id: "node-global-bare",
    // `require` is anchored to its string literal, so an English sentence
    // containing "require (" stays quiet. The two module-path globals are the
    // bare-word exceptions the header describes.
    pattern: /\b__dirname\b|\b__filename\b|\bmodule\.exports\b|\brequire\s*\(\s*["'`]/g,
    why: "shipped source may not touch a Node global; it has to run where there is no Node",
    documentedBy:
      "This module uses no CommonJS-only global: it asks for no module path, exports through no CommonJS object, and calls no synchronous loader.",
    violation: "const a = __dirname;",
  },
  {
    id: "node-builtin-import",
    pattern: new RegExp(`${specifierPrefix}["']node:`, "g"),
    why: "shipped source may not import a Node built-in; it has to run where there is no Node",
    documentedBy:
      "This module imports no prefixed Node built-in, under any specifier spelling, whether or not it binds a name.",
    violation: 'import "node:fs";',
  },
  {
    id: "node-builtin-import-bare",
    pattern: new RegExp(`${specifierPrefix}["'](?:${bareNodeAlternation})${subpath}["']`, "g"),
    why: "shipped source may not import a Node built-in; it has to run where there is no Node",
    documentedBy:
      "This module names no bare Node built-in specifier and no subpath of one, in any of the four import shapes.",
    violation: 'import "fs/promises";',
  },
  {
    id: "package-import",
    pattern: new RegExp(`${specifierPrefix}["']${bareSpecifier}["']`, "g"),
    why: "shipped source may not import a package; this package declares no dependencies, and a bundler inlines whatever a source file imports",
    documentedBy:
      "This module names no bare import specifier, so no package outside this one can be bundled into it.",
    violation: 'import { pad } from "left-pad";',
  },
  {
    id: "module-resolve",
    // The resolution accessor on the module's own metadata reaches a builtin
    // by name with none of the import shapes above, and a constrained engine
    // has no module loader to answer it.
    pattern: /\bimport\.meta\.resolve\b/g,
    why: "shipped source may not ask the module loader to resolve a specifier; it reaches a builtin by name and has to run where there is no loader",
    documentedBy:
      "This module asks the module loader to resolve no specifier, builtin or otherwise.",
    violation: 'const a = import.meta.resolve("fs");',
  },
  {
    id: "dynamic-code-eval",
    // The call form, so that a word such as "evaluate" cannot match.
    pattern: /\beval\s*\(/g,
    why: "dynamic code is unavailable on a locked-down engine and refused by a strict content security policy",
    documentedBy: "This module never evaluates a string as code.",
    violation: 'const a = eval("1");',
  },
  {
    id: "dynamic-code-function",
    pattern: /\b(?:new\s+)?Function\s*\(/g,
    why: "dynamic code is unavailable on a locked-down engine and refused by a strict content security policy",
    documentedBy: "This module never constructs a function from source text.",
    violation: 'const a = new Function("return 1");',
  },
  {
    id: "dynamic-code-data-url",
    // A data URL whose media type is a script, or WebAssembly, carries its
    // own source, so importing it constructs and runs code exactly as the
    // Function constructor does. The anchor is the quote that opens the
    // string; media types match in any case, as they do in a URL.
    pattern: /["'`]data:(?:(?:text|application)\/(?:x-)?(?:java|ecma)script|application\/wasm)\b/gi,
    why: "source text in a URL is dynamic code by another name",
    documentedBy: "This module never imports source text written into a URL.",
    violation: 'const a = await import("data:text/javascript,export default 1");',
  },
  {
    id: "dynamic-code-alias",
    // The written escapes: assigning either entry point to a name, the
    // `(0, eval)` indirect call, either one through `globalThis`, and reaching
    // the Function constructor off an instance with `.constructor(...)`.
    pattern:
      /=\s*(?:eval|Function)\b(?!\s*\()|\(\s*0\s*,\s*eval\s*\)|\bglobalThis\s*(?:\.\s*(?:eval|Function)\b|\[\s*["'](?:eval|Function)["']\s*\])|\.\s*constructor\s*\(/g,
    why: "aliasing eval or the Function constructor is the same dynamic code by another name",
    documentedBy:
      "This module never aliases the dynamic code entry points, reaches them through the global object, or gets at them by way of a constructor property.",
    violation: "const F = Function;",
  },
  {
    id: "reference-directive",
    // The source typecheck holds `src/` to the target's library and to no
    // host's type declarations, and a triple-slash reference directive widens
    // that from inside the file. The anchor is three slashes and the tag name,
    // opening the line or directly after the close of a block comment; the tag
    // name matches in any case because the compiler reads it in any case.
    pattern: /(?:^|\*\/)\s*\/\/\/\s*<reference\b/gi,
    why: "shipped source may not widen the library or the type declarations it is checked against; a member the target lacks would then typecheck and ship",
    documentedBy:
      "This module writes no triple-slash directive, so it is checked against no library or type declarations beyond the ones the source typecheck names.",
    violation: '/// <reference lib="es2022" />',
  },
  {
    id: "global-merge",
    // The same widening with no directive: a block that augments the global
    // scope merges its declarations into the library's own interfaces. Two
    // spellings open such a block - the declaring keyword followed by the
    // global scope's name, and that name alone opening its line (the form
    // nested inside an ambient module declaration). The anchor is the opening
    // brace on the same line, so prose saying a module declares nothing global
    // stays quiet. A brace moved to the next line is not caught.
    pattern: new RegExp(
      String.raw`\bdeclare${spaceOrBlockComment}+global${spaceOrBlockComment}*\{|^${tailOfEarlierBlockComment}?${spaceOrBlockComment}*global${spaceOrBlockComment}*\{`,
      "g",
    ),
    why: "shipped source may not merge declarations into the global scope; a member the target lacks would then typecheck and ship",
    documentedBy:
      "This module augments no global scope, so no library interface gains a member the source typecheck does not name.",
    violation: "declare global { interface Array<T> { at(index: number): T | undefined; } }",
  },
  {
    id: "locale-sensitive",
    // Any comparison or rendering whose answer depends on the engine's locale
    // data. `localeCompare` and the `toLocale` family typecheck and lint clean.
    pattern: /\bIntl\s*(?:\.\w|\[)|\.\s*localeCompare\s*\(|\.\s*toLocale[A-Za-z]*\s*\(/g,
    why: "locale data is absent, stubbed or version-dependent across engines, so the same input would give different answers on two runtimes",
    documentedBy:
      "This module consults no locale data: it compares and converts strings by code unit, and leaves rendering for a human to the host.",
    violation: 'const a = "x".localeCompare("y");',
  },
];

// A declaration file is refused by its name, not by a line of its text: its
// top-level declarations land in the global scope, so an interface written
// there merges into the library's own. The build writes the declarations
// itself, so no declaration file belongs under an entry's directory at all.
const declarationFile = {
  id: "declaration-file",
  why: "shipped source may not include a declaration file; its top-level declarations merge into the global scope, so a member the target lacks would then typecheck and ship",
};

function isDeclarationFile(name) {
  return (
    [".d.ts", ".d.mts", ".d.cts"].some((ext) => name.endsWith(ext)) ||
    (name.endsWith(".ts") && name.includes(".d."))
  );
}

const args = process.argv.slice(2);

// Every path below returns a status to the bottom of this file, which sets
// `process.exitCode` and lets the process end on its own. None calls
// `process.exit`, which does not wait for a pending write to stdout or stderr,
// so a long report read through a pipe could otherwise be cut short while the
// exit status survived intact.
class Refusal extends Error {}

function fail(message) {
  throw new Refusal(message);
}

// The scanned set is the directory of every entry the build lists, so a new
// entry in a new directory is scanned with no edit here. The build's config is
// loaded rather than read as text, so the entry list is the value the config
// exports. Where that list cannot be turned into directories below the config,
// the stage stops rather than guessing.
async function entryRoots(configPath) {
  const base = dirname(configPath);
  const { tsImport } = await import("tsx/esm/api");
  const loaded = await tsImport(pathToFileURL(configPath).href, import.meta.url);
  const config = loaded.default;
  const configs = Array.isArray(config) ? config : [config];
  const entries = [];
  for (const one of configs) {
    const entry = one?.entry;
    const listed = Array.isArray(entry)
      ? entry
      : entry !== null && typeof entry === "object"
        ? Object.values(entry)
        : undefined;
    if (listed === undefined || listed.length === 0 || listed.some((e) => typeof e !== "string")) {
      fail(`cannot read an entry list from ${relative(base, configPath)}`);
    }
    entries.push(...listed);
  }
  const roots = new Set();
  for (const entry of entries) {
    if (/[*?[\]{}!]/.test(entry)) {
      fail(`the entry ${entry} is a pattern, and this stage derives its roots from file paths`);
    }
    const file = resolve(base, entry);
    if (!existsSync(file)) fail(`the entry ${entry} does not exist`);
    const root = dirname(file);
    if (root === base || relative(base, root).startsWith("..")) {
      fail(`the entry ${entry} is not inside a directory below the config`);
    }
    roots.add(root);
  }
  // A root inside another root is already scanned through it.
  const sorted = [...roots].sort();
  return {
    base,
    roots: sorted.filter(
      (root) => !sorted.some((other) => other !== root && !relative(other, root).startsWith("..")),
    ),
  };
}

// A path as the output shows it: relative to the config's directory, or to
// the directory given, which then shows as itself.
const shown = (base, dir) => `${relative(base, dir).split(sep).join("/") || dir}/`;

function sourceFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (sourceExtensions.some((ext) => entry.endsWith(ext))) {
      found.push(full);
    }
  }
  return found.sort();
}

function findingsIn(file, base) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const found = [];
  if (isDeclarationFile(basename(file))) {
    found.push({
      file: relative(base, file).split(sep).join("/"),
      line: 1,
      column: 1,
      rule: declarationFile,
      text: basename(file),
    });
  }
  for (const [index, line] of lines.entries()) {
    for (const rule of rules) {
      for (const match of line.matchAll(rule.pattern)) {
        found.push({
          file: relative(base, file).split(sep).join("/"),
          line: index + 1,
          column: (match.index ?? 0) + 1,
          rule,
          text: line.trim(),
        });
      }
    }
  }
  return found;
}

async function run() {
  // `--rules` hands the table to the suite, so the documenting sentences live
  // exactly once - here, beside the pattern they describe.
  if (args.includes("--rules")) {
    console.log(
      JSON.stringify(
        rules.map(({ id, documentedBy, violation }) => ({ id, documentedBy, violation })),
        null,
        2,
      ),
    );
    return 0;
  }

  // With a directory argument the stage scans that directory, which is how the
  // suite points the real check at a fixture. With `--config` it derives its
  // roots from that build config, and with neither from the repository's own
  // `tsup.config.ts`, which is what the gate runs.
  const configFlag = args.indexOf("--config");
  let base;
  let sourceRoots;
  if (configFlag !== -1 || args.length === 0) {
    const configArg = configFlag === -1 ? "tsup.config.ts" : args[configFlag + 1];
    if (configArg === undefined) fail("--config needs a path");
    const configPath = isAbsolute(configArg) ? configArg : resolve(repoRoot, configArg);
    if (!existsSync(configPath)) fail(`cannot read the build config ${configArg}`);
    ({ base, roots: sourceRoots } = await entryRoots(configPath));
  } else {
    sourceRoots = [resolve(repoRoot, args[0])];
    base = sourceRoots[0];
  }

  const files = [];
  for (const root of sourceRoots) {
    let found;
    try {
      found = sourceFiles(root);
    } catch {
      fail(`cannot read ${shown(base, root)}`);
    }
    // A check that silently scanned nothing would report the same success as a
    // clean tree. It is not allowed to, for any one root.
    if (found.length === 0) fail(`no source files found under ${shown(base, root)}`);
    files.push(...found);
  }

  const findings = files.flatMap((file) => findingsIn(file, base));

  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.file}:${finding.line}:${finding.column}: ${finding.rule.id}`);
      console.error(`    ${finding.text}`);
      console.error(`    ${finding.rule.why}`);
    }
    const plural = findings.length === 1 ? "" : "s";
    console.error(
      `engine-neutrality: ${findings.length} finding${plural} in ${files.length} files`,
    );
    console.error("Do not silence this by narrowing the rule. See Conventions in CLAUDE.md.");
    return 1;
  }

  console.log(
    `engine-neutrality: ${files.length} files clean under ${sourceRoots
      .map((root) => shown(base, root))
      .join(", ")}, ${rules.length} rules`,
  );
  return 0;
}

// The one exit. A refusal prints its message here, so that every path leaves
// through the same statement and none of them cuts its own output short.
try {
  process.exitCode = await run();
} catch (error) {
  if (!(error instanceof Refusal)) throw error;
  console.error(`engine-neutrality: ${error.message}`);
  process.exitCode = 1;
}
