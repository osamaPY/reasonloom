# Build decisions

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
