# Live build progress

## Resume here

**Latest session: Reasonloom rebrand reviewed, fixed and finished at the UI level.** See "Review of the previous session's work" in BUILD_DECISIONS.md. Gates after this session: typecheck, lint, production build, full test suite (see Checkpoint 2 below). Source-to-lesson integration remains the highest-value open gap; no live-model run has been done.

Updated 2026-10-29 (second session). **P01 done (config level).** **P06 done: RELEASE-CANDIDATE CHECKPOINT reached (core path P00-P06).** Next: P07 (classroom/discovery) or, before expanding, a real-model practice session and an owner decision on the final name/publication (see Checkpoint below).

User asked this chat to start the batches and continuously record progress for Claude takeover. No background continuation is promised. Read this file and `BUILD_DECISIONS.md`, then inspect Git status before resuming.

## Protection checkpoint

- HEAD: `dc4c398` (upstream 0.4.0 preparation), branch main.
- Origin: `https://github.com/osamaPY/learnharness-fork.git`; upstream: Amos Blomqvist's original repository.
- Created external backup: `<local-path>/learnharness-p00-20261029-184732`.
- Backup includes copies of all 25 modified/untracked files present at turn start, SHA256 manifest, binary tracked diff, and status snapshot. Ignored learning data and credentials were not copied or modified.
- Existing changes include Windows portability tests, local dictation changes, desktop launch behavior, README attribution, browser name, and the cross-platform test runner. Do not reset these.

## P00 observations

- Reviewed Windows permission/signal skips: POSIX-only assertions remain active on POSIX; Windows ACL/termination equivalence is not covered.
- Catalog fixtures now isolate Windows home/profile locations; this avoids finding the real installed Claude executable.
- Dictation test changed from bearer to token to match an existing local raw-key protocol change. This is not merely portability and still requires a separate credential-handling review; do not describe it as security-validated.
- Prior reported suite: 2,933 passed, 6 skipped; not rerun in this turn yet.
- First attempted bundled Next guide path used `.mdx`, which did not exist; locate actual bundled Markdown guide before coding.

## Patch queue

- P00: complete within bounded scope; 96 targeted desktop/updater/release tests passed before identity changes.
- P01: DONE. Targeted run (automatic-updates, desktop-platform, verify-release, data-dir-seam) 106 pass/0 fail/0 skip; `npm run typecheck` and `npm run lint` clean; `node scripts/smoke-fork-identity.cjs` PASS for real Electron default and dev profile isolation. No upstream owner/update references remain in electron-builder.yml, electron/main.cjs, release.yml (package.json author credit intentionally kept). NOT verified: packaged installer build, real update feed, full suite/build rerun.
- P02: PARTIAL. Added `components/dashboard-panel.tsx` (Continue card: waiting sessions first, then most recent; Start-here guide when empty) rendered in the minimal home (graph.rendering off) + `tests/render-dashboard-panel.test.tsx`. Checks: 13 render tests pass (new + existing KnowledgeSummary), typecheck/lint clean, browser check at desktop-pane and 768px width with isolated LH_DATA_DIR: empty-state renders, no overlap. NOT done: dashboard on the default graph home (graph.rendering on is still the factory default; decision pending in BUILD_DECISIONS), Resume card not visually verified with real sessions (unit-tested only), subject navigation (P03), phone width (sidebar overlays main at 375px; pre-existing, desktop app).
- P03: DONE. `src/core/subjects.ts` (pure rules), `src/store/subjects.ts` (atomic write, refuses newer schema, corrupt reads empty), `src/server/subjects.ts`, API `/api/subjects` (GET/POST), `/api/subjects/[id]` (PUT rename/goal/archive), `/api/subjects/assign` (PUT), page `/subjects` (`components/subjects-view.tsx`), sidebar "Subjects" entry. Data: `<LH_DATA_DIR>/subjects.json`; chat records untouched. Checks: 11 tests (8 core + 3 store, incl. cross-process persistence, corrupt file, future-version refusal) pass; typecheck+lint clean; browser flow with isolated data dir: create, goal edit on blur, assign session, archive control present, and after a full server restart the subject, goal and assignment persisted; duplicate name -> 409, unknown chat -> 404. NOT done: archive/restore click not exercised in browser (logic unit-tested); no subject filter in the sidebar session list; no subject picker in the new-session flow or chat header (assign only on /subjects); dashboard dashboard-on-graph-home skipped (canvas overlay risk); API routes have no automated route tests; full suite not rerun.
- P04: DONE (minimal). `src/core/sources.ts` (ingest decision, passages, stable refs), `src/store/sources.ts` (`<data>/sources/index.json` + `<id>.txt`, atomic writes, id-validated paths), `src/server/sources.ts`, API `/api/sources` (GET, POST multipart <=25 files), `/api/sources/[id]` (GET w/ passages and optional `?ref=` resolution, PUT subject, DELETE), page `/sources` (`components/sources-view.tsx`), sidebar "Sources". Rules: .md/.markdown/.txt, <=1 MiB, no NUL; same sha256 = duplicate (stored nothing); same name + changed content = update in place, revision+1 (old text NOT kept); passage ref `<index>.<hash>` reports exact/moved/stale/invalid. Nothing is sent to a model. Checks: 18 core + 3 store tests pass; typecheck+lint clean; browser (isolated data dir): uploaded md/duplicate/pdf/blank -> correct per-file messages; subject select, passage list, search, exact link highlights+scrolls, stale link shows an alert. NOT done: retry for failed uploads is just re-adding (no stored failed state); no link from lessons/questions to passages yet (needs P06 integration); source-to-graph extraction still only via the existing Import notes flow; no PDF/URL/OCR (P08); copy-link click and subject select/remove not exercised in browser; fenced code blocks containing blank lines split into 2 passages; full suite not rerun.
- P05: DONE. Attempts are DERIVED (not stored): `attemptsFromMessages` folds clean problem+conclude tool calls from practice-session records; attempt id = conclude call id, so restarts/repeat reads never double-count. `src/core/reviews.ts` holds the policy (Leitner boxes: solved +1, solvedWithHints hold, movedOn -1, surrendered reset, dismissed/disputed ignored; intervals 1/3/7/14/30/60 days; UTC days), plain-language reasons, postpone (1/3/7 days, anchored to the UTC day so repeats do not drift, cleared by a newer attempt), and dispute/undispute. Stored data: only `<data>/reviews.json` events (`src/store/reviews.ts`). `src/server/reviews.ts`, API `/api/reviews` (GET), `/api/reviews/postpone`, `/api/reviews/dispute` (POST), page `/review` (`components/review-view.tsx`), sidebar "Review". Checks: 20 core + 4 server integration tests (seeded real practice records, cross-process, postpone idempotency, dispute, teaching sessions ignored) pass; typecheck+lint clean; `npm run build` passes with all new routes; browser on production build with seeded isolated data: due item with reason renders, postpone 3 days moves it to Coming up (persisted to reviews.json), dispute greys the attempt and removes its evidence. NOT done/limits: no live practice-with-a-model run (derivation tested on synthetic records shaped like the problem/conclude tools; real model output not exercised); concept labels come from graph proposition names (unknown ids labelled); scheduler is a convention, not evidence of retention; UTC days only; no reminders; review does not start a fresh problem on the concept (links to the last session); confidence collection, concept merge/delete effects, and manual rescheduling to arbitrary dates deferred; `next dev` full-reload loop seen when serving /review in dev (cause not isolated; production build is clean); full suite not rerun.
- P06: DONE. Added labelled sample workspace (`src/server/sample.ts`, `POST /api/sample`, button on empty Subjects page): synthetic subject + source + scripted practice record ("[Sample]" title, "(Sample data)" text); idempotent, removable via normal archive/delete. Subjects page now lists each subject's sources. `tests/e2e-journey.test.ts` (2 tests, separate processes = restarts): sample -> subject/source/session linked, review due with reason, passage refs exact, second create is a no-op, postpone survives restart, archive keeps session assignment. README rewritten: working vs planned, with explicit limits. FOUND + FIXED an integration regression from P01: renaming the package changed `APP_IDENTITY.attribution.name`, which is sent as the `x-opencode-client` header; 8 tests in `tests/provider-neutral-agents.test.ts` hard-coded "learnharness". Test now asserts against `APP_IDENTITY.attribution.name` (header = the app identity; assertion not weakened). Also revisit: the `x-opencode-client` header now reads `learnharness-fork` toward that third-party provider and the user-agent still says `learnharness/<version>` (src/agent/models.ts) - owner to decide whether the UA should also name the fork.
- P07-P19: pending. No new learner features claimed complete.

## Handoff rules

Record exact commands/results and limits here after each meaningful step. Never infer passing tests from prior runs. Keep test data isolated. No push, release, or destructive data migration has been performed.

## Credential finding (do not publish backups)

Found credential literals in three existing untracked launch scripts. Removed assignment lines from `scripts/run-desktop.ps1`, `start-desktop.bat`, and `start-web.bat`. No values are recorded here. User notified that affected keys should be rotated. Existing external backups contain original literals and must remain private; deleting local literals does not revoke keys. Do not restore these lines during takeover.

## P01 changes in progress

- Package name/executable/desktop launcher: `learnharness-fork`; product name: `LearnHarness Fork`; app ID: `io.github.osamapy.learnharnessfork`.
- Electron reads product name from package metadata before the single-instance lock. Default profile and auth/data paths follow the independent name; dev profile retains its `-dev` suffix.
- Runtime updater explicitly selects the fork repository even if a bundle carried stale upstream update metadata. Existing test-only feed override remains available.
- Builder names and release verifier use `LearnHarness-Fork-*` artifacts; workflow smoke paths use the new executable/bundle name. Lockfile root name updated without dependency changes.
- README separates configuration changes from unverified packaged-install/update behavior. Original author/license preserved.
- Bundled Next installation guide read (`.md`, not `.mdx`). No Next API changes in P01.

## Checkpoint (end of P06)

Gates run at this checkpoint, all on the working tree (nothing committed): `npm run typecheck` clean; `npm run lint` clean; `npm run build` succeeds (inherited filesystem-tracing warning only); full `npm test` = 3012 tests, 3006 pass, 0 fail, 6 skipped (Windows POSIX-only skips). Browser walkthrough on the production build, isolated data dir: Subjects -> Load sample -> subject card with its source -> sample session opens (problem/conclude cards render, "(Sample data)" visible) -> Review shows due item with reason -> postpone/dispute (P05).

NOT verified: any live-model teaching or practice session through the new pages; packaged desktop installer and updater; Windows ACL behaviour; macOS/Linux; accessibility audit; performance on large libraries; `next dev` shows a full-reload loop on /review (production clean).

Caveats to resolve before publishing: rotate the API keys that were in the old launch scripts (and never commit those scripts' backups); final product name is still the temporary "LearnHarness Fork"; nothing is committed or pushed; AGENTS.md may be rewritten by `next dev` (revert with `git checkout -- AGENTS.md`).

## Resume here (for the next session)

Read this file, BUILD_DECISIONS.md and `git status`. Next dependency-ready work: P07 (long-question layout, plan/source panels, search/bookmarks, graph filters) or P08 (richer sources) - but first consider the integration gap flagged in the README limits (lessons/practice do not use sources yet) which is the highest-value follow-up.

## Checkpoint 2 (Reasonloom review + brand pass)

Gates on the working tree: `npm run typecheck` clean; `npm run lint` clean; `npm run build` succeeds; full `npm test` = 3014 tests, 3008 pass, 0 fail, 6 skipped. Real Electron profile smoke passes (default and dev; profile path deliberately remains `LearnHarness Fork`). Browser check on the production build with the sample workspace: Subjects, Review, and home show the Reasonloom mark/wordmark, teal accent, and editorial headings; no duplicate wordmark.

The rename initially broke 14 tests that hard-coded the old identity or mocked Electron `app` without `getPath`/`setPath`; fixed by deriving expectations from package metadata, adding the missing mocks, and updating the copy assertions (no assertion was loosened or skipped).

Still not verified: live-model sessions; packaged installer/updater; macOS icon artwork (upstream art remains in `build/icon.icns`/`icon.icon`); accessibility audit beyond the keyboard-ring scoping; name/trademark clearance for "Reasonloom".

## Checkpoint 3 (source-grounded sessions)

Added: `src/core/source-context.ts` (bounded context builder with S#.P# labels, `linkCitations`), `source-context` marker (native-messages, view projection, `src/server/source-context.ts`), `POST /api/chats` accepts `subjectId` (validated before creation: unknown -> 404, archived -> 409, no orphan session; the session joins the subject and gets the marker), `/chat/new?subject=<id>[&mode=practice]` with a `SubjectChip`, "Start a lesson / Start practice" on subject cards, `SourceContextCard` in the transcript, and citation links in assistant text (a capture-phase click handler routes a cited label to `/sources?source=..&ref=..`, because Streamdown otherwise renders links as safety-gated buttons).

Tests: `source-context.test.ts` (12), `source-context-marker.test.ts` (2, real library in a child process: only the subject's own sources, model sees it as a user message, card projection), `render-new-session` (+1: subjectId rides the create). Full suite: 3029 tests, 3023 pass, 0 fail, 6 skipped. Typecheck, lint, production build clean. Browser (production build, isolated data): session created through the API with a subjectId has the marker as message 0 and is assigned to the subject; the card lists 6 passage links; a seeded assistant message with `[S1.P2]` renders a link, an unknown `[S9.P9]` and code-quoted label stay plain; clicking the link opens the Sources page with exactly that passage highlighted; the new-session draft shows "grounded in 1 source".

NOT verified: any live model actually citing labels or staying inside the material (the instruction is untested against a real model); starting a session by clicking Send in the UI (needs a configured provider; the create body is unit-tested and the API verified with curl); behaviour after context compaction (the marker may be summarised away; the card and citation map stay in the record); sessions started from the home composer have no subject picker.

Next highest-value: run a real-provider session from a subject and check citation fidelity; add a subject picker to the home composer; let Review open a fresh practice session on a due concept inside its subject.

## Checkpoint 4 (subject picker)

Added `components/subject-picker.tsx` (select of active subjects with source counts, hidden until a subject exists, clears a stale/archived link with a visible note) in the home composer and the new-session draft (replaces the URL-only chip; `/chat/new?subject=` still seeds it). `ComposerActions` gained a `subject` slot and hides its row when empty. Home now sends `subjectId` on create. Tests: `subject-picker.test.tsx` (6). Full suite 3035 tests, 3029 pass, 0 fail, 6 skipped; typecheck, lint, production build clean. Browser (production build, isolated data): picker absent with no active subject; present with options "No subject" / "Sample: Eigenvalues · 1 source" after loading the sample; archived subject in the draft URL shows the stale note.

NOT verified: pressing Send from the home composer with a subject chosen (needs a configured provider; the draft path is unit-tested, the home path shares the same starter but its create body is not asserted by a test); live-model citation fidelity (still open from Checkpoint 3).

## Live-provider attempt (after Checkpoint 4)

Authorised scope: one already-configured provider, minimal spend. The only configured provider is Google (Gemini key in `.env.local`; selections in `data/settings.json`). I ran the production build against an ISOLATED data dir (your real `data/` was not touched), with all three model slots set to the cheapest configured model (`gemini-2.5-flash`, thinking low) and the sample workspace loaded; the key was read from `.env.local` by the app and never printed.

Result: **the live citation test did not run.** Google answered the first request with HTTP 401 `API key not valid` (`UNAUTHENTICATED`), so no model output was produced and no spend was incurred. Everything before the model call was exercised for real through the UI: the draft preselected the sample subject via the picker; Send created a session; the session was assigned to the subject; message 0 is the `source-context` marker (1,382 chars) and message 1 the learner text; the request reached the provider; the failure surfaced in the transcript with the Sources card above it (the error text is the raw provider JSON, an inherited presentation).

I did not look for or use any other credentials (e.g. the installed LearnHarness profile), and did not change the key: that is yours to do. Likely causes: the key was revoked or rotated (it also appeared in the old launch scripts, which were flagged for rotation) or is not a valid Gemini API key.

To finish the live check: add a working key in Settings (or `.env.local`), then run a session from a subject and check (1) that cited labels exist in the marker, (2) that claims sit inside the cited passage, (3) that an out-of-scope question is answered with a "not in your material" note. Budget: a handful of turns on a flash-class model.

## Checkpoint 5 (math rendering everywhere)

Request: any formula must be typeset as LaTeX and easy on the eye. The inherited Markdown pipeline (Streamdown + KaTeX) already did this for replies; the gaps were in surfaces this fork added or that print plain strings. Fixed: Sources passages and Review problem statements/verdicts now render through the Markdown + math pipeline; session titles (sidebar, chat header), Review labels and the Sources-card previews use a new `MathText` (inline `$..$`, `$$..$$` on one line, `\(..\)`; currency, `\$` and malformed TeX stay text; KaTeX trust off); previews are cut math-safely and newline-collapsed; passage headings capped in size. Currency: "$5 and then $6" was typeset as one math span by the inherited renderer; `transformMathDelimiters` now escapes a price pair (padded edge + digit), and two upstream tests that pinned the old behaviour ("leaves currency untouched") were updated to the new, stricter expectation. Sample source and sample problems now contain LaTeX.

Tests: `math-text.test.ts` (12), `render-math-text.test.tsx` (5), `currency-vs-math.test.ts` (3). Full suite 3055 tests, 3049 pass, 0 fail, 6 skipped. Typecheck, lint, production build clean. Browser (production build): inline, display, matrix, aligned, legacy `\(..\)`/`\[..\]`, literal `\$`, long equation, LaTeX in sidebar and header titles, Sources passages, Review and the Sources card; no raw `$` left in those surfaces and no `.katex-error`.

Not verified: other inherited surfaces (graph node labels, quiz dock options) beyond what upstream already rendered; very long single-line display equations in narrow windows; copy-as-LaTeX.

## Checkpoint 6 (live end-to-end with a real model)

Run: production build against an isolated data dir (real `data/` untouched), DeepSeek key supplied only through the `DEEPSEEK_API_KEY` environment variable of the test server (never written to a file, the repo or this log; the temp dir was deleted afterwards), all three slots = `deepseek-flash`, thinking low. Total spend about two cents across ~8 model turns.

What ran for real, through the UI: sample workspace -> Subjects -> "Start a lesson" and "Start practice" from the card -> home composer with the subject picker -> real replies. Verified from the stored records and the UI:
- Marker: message 0 of each session is the `source-context` marker; the session is assigned to the subject (also from the home composer, which was the last unverified path).
- Practice: the model posed a problem built from the notes (characteristic equation, nonzero eigenvectors), its hidden worked solution cited `[S1.P4]` and `[S1.P6]` (valid labels, relevant passages), I answered, it concluded `solved` with a verdict, the attempt was derived from that real record and Review scheduled it (box 1, due in 3 days). So the review derivation works on real `problem`/`conclude` output, not just scripted records.
- Teaching: the first lesson turn ignored the notes (a probe about the Jordan form, no citation). Fix: the marker now tells the model to build questions/quizzes/problems from the passages and to cite labels in every explanation or reveal. Re-run: the probe quoted the notes and cited `[S1.P3]`; a later run in a new session did not cite at all, so grounding in lessons is improved, not guaranteed.
- Math: matrices, display equations and aligned derivations from the real model rendered correctly in replies, the quiz dock and practice cards (no `.katex-error`).

Bugs found and fixed:
1. Cited labels were only linked in normal reply text; in practice reveals and quiz explanations (where the model actually cites) they stayed plain. A `CitationsProvider` + `CitationBoundary` now links them in every `ToolContentResponse` (3 new tests).
2. Review showed a long multi-part problem in full, pushing the list off screen; statements are now clamped with Show more / Show less.
3. Lesson grounding wording (above).

Not an upstream bug: the "Why" button under "YOUR THINKING" is the collapsed explanation toggle.

Still open / not verified: citation fidelity beyond a handful of runs (this is not an evaluation); the other providers; the desktop installer/updater; macOS icon art; name clearance. The key was pasted in chat, so it should be rotated.
