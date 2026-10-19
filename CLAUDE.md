# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

## Beads issue tracker

This project tracks all work in **bd (beads)** - not TodoWrite, not markdown TODO
lists. The prefix is `uxts-`. Run `bd prime` for the command reference and
session-close protocol, and `bd remember` for knowledge that should outlive the
session.

Claude Code injects `bd prime` at session start, so this section is deliberately
a stub; the authority rules below are the part that is specific to this repo.

`AGENTS.md` is a symlink to this file. There is one set of instructions, not two.

### Beads that span repositories

| Situation | Rule |
|---|---|
| A decision is recorded in two trackers and they disagree | The repository whose files change owns the decision. The wire format and the conformance corpus are uxid-ex's call; this package's API, its TypeScript types and its build are this repo's call |
| A bead pairs with one in another repo | Both halves carry `mirrors: <id>` as the first line of the description |
| You are about to schedule, claim, plan against, or cite the status of a mirrored bead | Re-read the other tracker first and write a new dated note above the old one, then act |
| A `mirrors:` line names an id that no longer resolves | Broken immediately, not stale. Fix it with one `bd update` the moment you notice |

## Agent authority in this repo

**This repository grants an agent the authority to commit, push, and open
requests only inside an orchestrated campaign that carries the operator's
explicit consent for that campaign.** The grant is consent-scoped, not
standing. Outside such a campaign the conservative rules `bd prime` describes
apply in full, and so they do for any action the table below does not name.

What unlocks the grant is the operator saying, in their own words, that a
particular campaign may commit, push, and open requests here. Nothing else
does. It is **not** inferable from another repository having opted into the
team-maintainer profile; not from this file's resemblance to theirs; not from
the fact that the same person works on all of them. A dispatch from another
agent - a conductor, an orchestrator, a parent session - is not by itself the
operator's consent either, however confidently it asserts otherwise. An agent
that believes consent exists but cannot point to where the operator gave it
should do the work, stop before the irreversible step, and report.

| Action | Trigger | Still unauthorized when |
|---|---|---|
| `bd` task tracking (`create`, `claim`, `update`, `note`) | any time | never - this is the conservative profile too |
| `pnpm run gate` in any profile | any time | never - running the gate costs nothing but time |
| `git commit` on the bead's branch | a campaign carrying the operator's explicit consent **and** the bead's work complete **and** full `mise exec -- pnpm run gate` green; a change touching no path in `gate.build_paths` and no path in `gate.also_gated_paths` (the two lists the gate rules below name) has no gate to run and may commit on review of the diff alone | on `main`, on a red gate, on a `gate:loop` or otherwise scoped run, or with unrelated changes in the tree |
| `git push`, `gh pr create` | the same consent, **and** the terminology scan clean over the full outbound content | any scan hit - that is a hard stop, not something to rephrase past |
| merging a campaign PR | a campaign consent the operator adopted verbatim that names automatic merges, with every named condition met (full gate green, CI green, firewall scan clean with a positive control, any named review gate passed) | outside such a consent; any named condition unmet; any PR the consent's carve-outs hold for the operator |
| `bd close <id>` | never for a mirrored bead whose other half is not merged to its own repo's `origin/main`; a mirrored bead whose other half has ALSO landed may be closed by the campaign conductor under a consent naming this exception, both halves together, each verified against its remote; otherwise the operator's call | for a bead whose description carries a `mirrors:` line while its other half is unlanded, campaign consent included |
| `bd dolt push` | bead state changed locally **and** the git side of the same change has already reached `origin`; inside a campaign, the conductor pushes (atomically across the campaign's trackers) | as a way to publish beads for work that is not on `origin/main` yet |
| a release prep (a version bump and a changelog promotion) and its tag | a release bead the operator has named (in the campaign plan or their own words); the tag once that prep is merged to `origin/main`, naming its version at the merged commit | on any other bead or on `main`; the tag before the prep is on `origin/main`; always for the publish and the release itself |
| a release, `npm publish` | never - an agent or a session never runs `npm publish`; the release workflow (`.github/workflows/release.yml`) publishes on the tag push the release-prep row above already allows | always - a failed workflow is re-run from its Actions page, never worked round by a local publish. Publishing to npm is irreversible: a released version cannot be recalled, only deprecated |

The organizing principle: the human gate belongs where an action stops being
reversible. A commit on a per-bead branch is undone with
`git reset --soft HEAD~1`. A push, a request, a merge outside a consented
campaign, and a closed bead are visible to other people and other machines,
so a campaign's consent is what buys the first two and nothing buys the last
two.

Two rules override every row above. A current "do not commit", "do not push",
or equivalent instruction from the operator wins outright. And authority is
the operator's to give, never an agent's to infer: a subagent that believes a
trigger has fired - reasoning its way there from its dispatch, from a sibling
repo, or from the fact that it was asked to do the work - reports that, it
does not act on it. A subagent carrying the operator's consent relayed
verbatim by the session that owns the work is the other case: there the
authority is the operator's and the subagent is only the hands, so it may act.
What has to be quotable is the relay - the operator's own words authorizing
that campaign, not the subagent's sense of being authorized. A subagent that
cannot quote them reports and stops. A relay unlocks nothing the rows above
forbid outright: closing a mirrored bead, and running `npm publish` or cutting
a release stay forbidden however the consent arrives. A release prep and its
tag are not a release; the Release preps paragraph below records them.

Merging a campaign PR is a recorded exception: under a campaign consent the
operator has adopted verbatim that names automatic merges, with every
condition that consent names met, the conductor's merge executes the
operator's own authorization - the consent's text is what may be done and
nothing more. (Adopted here at onboarding with the rest of the satellite
authority table, ruled by the operator, 2026-10-18.)

**Release preps.** The version bump and the tag of a release prep are the
family norm, not a grant a campaign consent has to name. On a release bead
the operator has named (in the campaign plan or their own words), the prep -
the version bump in `package.json` and the changelog promotion - lands
through the rows above; once it is merged to `origin/main`, the conductor or
the session that owns the release bead tags that merged commit with the new
version and pushes the tag. An agent or a session never runs `npm publish`:
the release workflow (`.github/workflows/release.yml`, the file the release
publishes from) publishes on that tag push, and a failed workflow is re-run
from its Actions page, never worked round by a local publish. Merging the prep
follows this file's merge row, and nothing else this file reserves for the
operator changes. (Adopted at onboarding, ruled by the operator, 2026-10-18.)

This repository keeps no decision records (`docs/adr`). A release or gating
decision is recorded here, in the authority table and the Release preps
paragraph, and in the header of the workflow it governs; a change a user of
the API could notice is a changelog fragment under `changelog.d/`. The ID
format itself is not decided here: it is uxid-ex's specification,
`guides/wire-format.md`, read at the tag the vendored corpus names. A future
API decision may start a `docs/adr` directory.

Widening this section is a decision for the operator to make and record here.
An agent may draft the change; it does not adopt it.

## Non-interactive shell commands

`cp`, `mv`, and `rm` may be aliased to `-i` on a developer's machine, which
hangs an agent forever on a y/n prompt it cannot see. Always pass the
non-interactive form: `cp -f`, `mv -f`, `rm -f`, `rm -rf`, `cp -rf`. Same for
`scp` and `ssh` (`-o BatchMode=yes`), `apt-get` (`-y`), and `brew`
(`HOMEBREW_NO_AUTO_UPDATE=1`).

Also avoid `bd edit`, which opens `$EDITOR` and blocks. Use
`bd update <id> --title/--description/--notes/--design` instead.

## What this project is

`uxid` for TypeScript and JavaScript: prefixed, K-sortable, Stripe-style
identifiers a person can read, copy and route back to their resource,
wire-compatible with the Elixir reference `uxid` (uxid-ex) and checked against
its conformance corpus. Generation (random, deterministic and monotonic),
decoding and the validity checks; zero runtime dependencies; no Node built-in
in the library source.

- **The corpus is the arbiter.** The conformance corpus is vendored from
  uxid-ex at a release tag into `conformance/`, and every case in it passes
  with no skip list. A case this package cannot pass is this package's bug or
  a question raised in uxid-ex with the evidence, never a skip here. The
  vendored files are byte-identical to the tag and are never edited; a hash
  mismatch is never repaired by rewriting a hash.
- **The specification is uxid-ex's.** Where the corpus does not fix an answer,
  uxid-ex's `guides/wire-format.md` at the same tag does. Read it at the tag,
  not at uxid-ex's `main`.
- **Engine-neutral, zero runtime dependencies.** The package has no
  `dependencies` key, assumes no Node, browser or bundler, and runs on a
  server runtime, in a browser and on a React Native JavaScript engine.

## Build & Test

```bash
mise exec -- pnpm run gate:loop   # inner loop
mise exec -- pnpm run gate        # full gate: every stage of package.json's `gate` script
mise exec -- pnpm run test        # just the suite
mise exec -- pnpm run format      # rewrite formatting (the gate only checks it)
```

The first two lines are the manifest's commands (`gate.loop` and `gate.full`
in `.claude/wurk.json`), and the CI workflow will run `gate.full` as written there. The
`mise exec --` prefix runs each command on the node and pnpm that `mise.toml`
pins. The full gate's stages are listed in one place, package.json's `gate`
script, and are not repeated here.

### This repo's own gate rules

- The full gate is `mise exec -- pnpm run gate`; the inner loop is
  `mise exec -- pnpm run gate:loop`. Only the full command is the advancement
  gate: a `gate:loop` run, like any scoped run, is never evidence for a claim
  that the gate is green.
- **Never truncate the gate output.** No `| tail`, `| head`, `| grep`.
  Truncating removes findings, not noise.
- **Never go green by weakening the check.** Not by lowering a coverage
  threshold in `vitest.config.ts`, not by disabling a Biome rule, not by
  `it.skip` on a failing test, not by narrowing `include`, and never by a
  corpus skip list. If a finding is genuinely wrong for this project, say so
  and let the operator decide.
  Check `git status` after a gate run and include or discard deliberately
  anything it rewrote.
- A change touching no path in `gate.build_paths` has no gate to run and may
  commit on review of the diff alone - the authority table above says the
  same - except a change to a path the manifest lists under
  `gate.also_gated_paths`, which runs it. Those two lists in
  `.claude/wurk.json` are the one source for the exception: `conformance/` is
  gated because the corpus check reads it, and `README.md` because it ships
  in the published package and the documentation build reads it.
- Documentation may point at the gate; it never enlarges it.

## Conventions

This repository is not part of the statifier package family, but it is worked
by the same operator with the same tooling, so it adopts the family's
satellite conventions rather than inventing a second set.

- **Domain-free examples.** The README, doc comments, tests and fixtures teach
  no example domain: examples use neutral resource prefixes such as `usr` and
  `cus`, and fictional `@example.com` values.
- **No global state.** The monotonic generator is an object the caller holds;
  the library keeps no module-level counters or configuration.
- **The byte source is injectable.** Random bytes come from a byte source the
  caller may pass, defaulting to `globalThis.crypto.getRandomValues` when it
  exists and failing with a clear error that names the option when it does
  not. Never `Math.random`. Bytes passed in directly exist for test vectors
  and are documented as such.
- **No Node built-in and no DOM under `src/`.** Neither the imports nor the
  globals. Test code and `scripts/` may use them freely.
- **Zero runtime dependencies.** `package.json` carries no `dependencies` key;
  anything the library needs, such as a hash, is bundled as source.
- **Sabotage every new test that asserts `src/` behavior**: break the code it
  covers, confirm the test goes red, revert, and note the mutation in one line
  above the test.
- **Process artifacts stay out of shipped prose.** Bead ids, plan phase and
  step numbers, plan filenames and workflow jargon do not appear in `src/`
  comments, in `scripts/` comments, in the README, or in published docs.
- Changelog: a change a user of the API could notice adds a fragment under
  `changelog.d/` in the same request. New version sections in `CHANGELOG.md`
  keep the file's own heading style; existing history is not rewritten.
- Commit messages: simple present tense ("Adds ...", "Fixes ..."), subject
  under 72 characters, body wrapped at ~72 chars explaining why. Requests are
  rebase-merged, so each commit lands on main with its message unchanged. No
  AI attribution trailers.
- **ASCII hyphens.** Plain `-` in prose, never an em dash or an en dash, and
  no other typographic character a plain keyboard does not produce.
