# Build decisions

## Reasonloom rebrand (owner-selected, 2026-10-29)

- Public name: Reasonloom. Package/executable: reasonloom. Installer prefix: Reasonloom. GitHub repository remains osamaPY/learnharness-fork; no remote rename or publication implied.
- Retain the existing LearnHarness Fork desktop profile (and -dev profile) across branding changes. Set that storage path explicitly before restoring the Reasonloom display name, preventing saved fork data from appearing lost. Original upstream LearnHarness data remains separate.
- Provider user-agent derives from package identity rather than a hardcoded upstream name.
- Review Claude's P01-P06 as implementation, not proof of source-grounded learning: sources still need integration into lessons. Document real fixes and limits rather than certifying all roadmap items done.

### Review of the previous session's work (this session)

- Reviewed Codex's uncommitted rebrand on top of `3ab7920`. Kept: rename to Reasonloom (package, executable, app ID, installers, provider identity), retained `LearnHarness Fork` desktop profile path so saved data is not orphaned, the sample-workspace data-loss fix (the sample no longer routes through normal ingestion, which could update or re-assign a learner's same-named or identical source), source-update rollback on an index write failure, and Review page HTTP-error handling. All verified with regression tests and a rerun of the identity/release/desktop/provider tests (146 pass).
- Changed: (1) the global `:focus-visible` outline that replaced upstream's deliberate "no-ring law" was scoped back to Reasonloom's own pages and sidebar navigation, so the teaching surfaces keep upstream behaviour (arrow keys in the quiz no longer light up a previously clicked element) while the new pages gain a visible keyboard ring; (2) removed the duplicate wordmark Codex added to the home header (the sidebar carries the wordmark; the header one overlapped the sidebar toggle); (3) subject goal textarea auto-grows (`field-sizing: content`) instead of clipping long goals.
- Brand additions: original weave mark (warp threads in paper, weft in teal) used for the sidebar mark, browser favicon (`app/icon.svg`), and regenerated Windows/Linux app icons (`build/icon-flat.svg` -> `build/icon.ico`, `build/icon.png`); page metadata description now states the product promise.
- Not done: the macOS icon (`build/icon.icns`, `build/icon.icon`) still carries upstream artwork and needs Icon Composer/actool; installer images (`build/background*.png`, DMG) not redrawn; the name is not trademark/domain cleared; no light theme (the app is dark-only by upstream design).

## Execution scope

The user asked to start the documented batches and keep a simultaneous handoff log. Proceed with the described bounded patches, preserving local work and recording reversible implementation choices. The earlier request was for automation; avoid repeating already settled questions. Public final brand selection remains open.

## P01 proposal being implemented

- Keep the already approved temporary display name **LearnHarness Fork**.
- Use independent desktop app identity and a new data directory; never migrate original app records or credentials implicitly.
- Route package metadata/update configuration to `osamaPY/learnharness-fork`; retain original authorship and AGPL notices.
- Keep installer names and release validation consistent. Verify naming against installed builder APIs where needed.
- Do not publish or sign with upstream credentials. Public release and actual installer/update checks remain separate verification gates.
- Preserve established UI/provider behavior; this patch concerns identity and isolation only.

## Baseline limitations

Existing Windows POSIX-mode skips do not verify ACL protection. Existing local dictation sends the configured long-lived key to the client; this must be audited in P11/P12 and is not a change introduced by P01.

## P02

- Dashboard is a new pure component beside the existing minimal home; KnowledgeSummary and its pinned tests are untouched.
- Resume rule: sessions waiting on the learner (pending question/problem) first, then most recently updated. No fabricated review/progress data until P05.
- Open: whether to make the dashboard the default home over the graph (factory default `graph.rendering` stays on for now; changing it alters upstream behavior).

## P03

- Graph stays the default home; no dashboard overlay on the canvas (would risk graph interaction/drag regions for little value).
- One subject per session; assignments stored in `subjects.json`, not in chat records. Subjects are archived, never deleted; names unique case-insensitively across active and archived. Assigning to an archived subject is refused; existing assignments survive archiving.
- Sessions deleted elsewhere simply vanish from counts (filtered by live chat list); stale assignment rows are harmless.

## P04

- The library is independent of the existing graph import: it stores a normalised text copy and never calls a model. Graph extraction stays behind the existing "Import notes" button; linking the two is deferred.
- Duplicate = identical normalised content; same name + new content = in-place update with revision bump and no history (history is P08). Name match is case-insensitive.
- Passage identity is by text hash; the index is a hint. Moved/stale are reported rather than silently re-pointed.
- Removing a source deletes only the library copy.

## P05

- Attempts are a derived read model over practice-session records; the only stored learner data is a small event list (postpone/dispute). This keeps evidence apart from graph facts and makes double-counting impossible.
- One policy: per-concept Leitner boxes with fixed intervals, every queue item carries its reason. Dismissed and disputed attempts give no evidence; never-practised concepts are unassessed and never queued.
- Postponement choices are 1/3/7 days, anchored on the UTC day (idempotent), and end when a newer attempt arrives. UTC days are a known limit.
- Untagged practice problems schedule under a per-session "topic" concept.
- `next dev` rewrote the Next-managed heading in AGENTS.md during testing; that generated change was reverted.

## Source-grounded sessions

- Grounding is a one-time marker message at session creation (same mechanism as the graph-context pick), built from the subject's sources. Chosen over per-turn retrieval: no new agent tooling, no embedding dependency, and the record shows exactly what the model was given.
- Labels, not hashes, are what the model cites (S1.P3); the marker's `details` hold the label -> (sourceId, passage ref) map, so refs stay exact and a made-up label cannot become a live link.
- Bounded context (24,000 chars, 10 sources, 1,200 chars per passage) with explicit omission notes to both the model and the learner. Earliest passages win; no ranking yet.
- Starting is from the Subjects page (`/chat/new?subject=`), not the home composer, to avoid touching that component's dense layout; a picker there is a follow-up.
- Grounding is advisory. It is documented as such in the README rather than implied as enforcement.
