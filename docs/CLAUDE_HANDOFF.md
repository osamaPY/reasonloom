# Claude implementation handoff

> Superseded operational handoff: use [CLAUDE_BUILD_PLAYBOOK.md](CLAUDE_BUILD_PLAYBOOK.md). It includes a current-state audit, the complete roadmap snapshot, patch checklist, identity proposals, and a copy-ready owner delegation for more autonomous implementation. This older prompt is retained as history; its baseline and approval assumptions are no longer the latest instructions when the owner submits the new delegation.

The text below is a ready-to-use prompt for a new Claude coding chat with access to this repository.

---

I want you to help me develop a substantial, polished fork of LearnHarness. Read the repository and roadmap carefully, implement approved milestones, and verify the resulting application. This is an implementation project, not a request for another generic brainstorm.

## Project and intent

- Local workspace: `<local-path>/learnharness`
- Original project: https://github.com/amosblomqvist/learnharness
- Full product roadmap: `docs/FORK_ROADMAP.md`
- Repository instructions: `AGENTS.md`

I liked LearnHarness and want to build on it with substantial improvements, publish my version on my GitHub, and clearly explain my contribution. The result should be impressive because it works well and adds useful capabilities. Preserve credit to the original author and distinguish inherited features from our changes.

The previous chat investigated the project and created the roadmap. It did not implement the proposed application features or create the GitHub fork. Existing local code changes predate that roadmap and must be preserved.

## Read before changing application code

1. Read `AGENTS.md` and any applicable nested instruction files.
2. Read **all of** `docs/FORK_ROADMAP.md`, including the consolidated C01-C17 and X01-X06 scope, investigation snapshot, experimental prototypes, milestones, acceptance checks, risks, and open decisions.
3. Inspect `README.md`, `package.json`, relevant architecture/development/release documentation, and the actual implementations involved in the first milestone. Some historical documents and comments are stale; resolve differences against current code and approved decisions.
4. Before writing Next.js code, read the relevant guides shipped in the installed `node_modules/next/dist/docs/`, as `AGENTS.md` requires. Do not assume this version matches older Next.js conventions.
5. Inspect Git status, branch, remotes, and recent history. Inventory tracked changes and untracked files before any synchronization or reorganization.

Do not claim to have read a file, run a command, inspected a screen, or tested a feature unless you actually did. If you do not have repository/tool access, tell me precisely what access is missing before claiming implementation progress.

## Fork attribution and README language

Use this as the basis of the README introduction once the derivative project is established:

> This project is a fork of [LearnHarness](https://github.com/amosblomqvist/learnharness), originally created by Amos Blomqvist. I liked its approach to adaptive AI-assisted learning and wanted to build on that foundation with my own improvements. This repository documents what I changed, what comes from upstream, and what is still planned. Full credit to the original author and contributors for the foundation.

Keep that straightforward tone. Preserve the applicable license and notices. The inspected package uses AGPL-3.0-only; review the actual license and maintain the necessary attribution and source availability for the distribution we choose.

Add a prominent **“What this fork changes”** section. List only features actually implemented, with screenshots or links where useful. Keep planned work in a separately labeled roadmap section. For example, describe subject workspaces, source references, and review scheduling as completed changes only when they genuinely function.

Do not claim we wrote the original teaching engine, knowledge graph, practice mode, dictation, provider support, or desktop shell. Explain how our changes extend them.

## Preserve and establish the baseline

The earlier investigation found local package version 0.3.9 at `3dd5211`; the inspected upstream comparison was 60 commits ahead and prepared 0.4.0. Treat this as a historical snapshot and recheck current state. Avoid independently rebuilding capabilities that upstream has since added.

Existing modifications observed at handoff:

- `app/api/stt/token/route.ts`
- `components/dictation.tsx`
- `electron/main.cjs`
- `package-lock.json`
- Untracked Windows helpers: `run-desktop.vbs`, `scripts/run-desktop.ps1`, `start-desktop.bat`, `start-server-silently.vbs`, and `start-web.bat`.
- Planning documents created by the previous chat, including this handoff and the roadmap.

Reinspect rather than assuming this list is still complete. Preserve the work; do not use a destructive reset or overwrite local learning data. Establish a recoverable baseline before integrating upstream or changing data formats.

Resolve the GitHub account, repository/product name, baseline, and desktop identity with me if they remain unknown. When setting up the fork, keep the original available as `upstream` and use my repository as `origin`. Separate the fork's application identity, data directory, installer/update configuration, and release destinations. Review inherited website-dispatch and signing configuration rather than copying upstream deployment assumptions.

## Design and approval workflow

Respect `AGENTS.md`: investigate, resolve ambiguity, get the plan approved, then implement. My enthusiasm for the roadmap is not a decision about every name, screen, schema, default, or grading policy.

- Ask one focused question at a time using your question tool, or a concise chat question if no such tool is available.
- Explain the options and give a recommendation so I can decide easily.
- Ask about decisions relevant to the next milestone rather than presenting the entire backlog of questions at once.
- Present concrete screen proposals, behavior, data implications, acceptance checks, and boundaries for approval.
- After a milestone's design/plan is approved, implement it and run the agreed verification without repeatedly asking permission for the same work.
- If implementation uncovers a new ambiguous design decision, resolve it before implementing the affected behavior. Continue other already approved work where possible.

Keep communication short. I do not want long chat essays. Put detailed plans, decision records, and test evidence in repository Markdown files; summarize the important results in chat.

## Product scope and sequencing

The central journey is:

**Subject -> selected sources -> lesson -> practice -> explained review.**

The roadmap is the detailed scope reference. Account for all 23 grouped items; do not quietly drop the ambitious ideas or imply they are shipped. Separate core implementation, later expansions, and experimental prototypes.

Recommended sequence to evaluate with me:

1. **Foundation:** Preserve existing work, choose the upstream baseline, establish checks, and configure fork identity.
2. **Workspace:** Approved visual direction, subject organization, dashboard, session navigation, and resume behavior.
3. **Sources:** Library, supported imports, previews, stable references, source versions, and practice scope.
4. **Review:** Persistent attempt evidence, deterministic scheduling, review queue, and inspectable history.
5. **Release quality:** Classroom polish, search/bookmarks, data portability, recovery, accessibility, performance, diagnostics, documentation, and demo.
6. **Expansions:** Select bounded increments from exam preparation, teach-back, misconception journal, richer imports, artifact shelf, language/voice features, and the rest of the roadmap.
7. **Experimental experiences:** Prototype prediction laboratory (X01) and practical missions (X03) first if approved. Later candidates are reasoning debugger (X02), error-hunting challenges (X04), cross-subject connections (X05), and learning evidence portfolio (X06).

For the experiments, use the small scopes and success checks in the roadmap. A prediction lab should record a real prediction and reproducible experiment result. A practical mission should have a deliverable, checkpoints, and inspectable evidence. A mock screen or generated description is not a functioning prototype.

Keep the existing stack and architecture unless a specific approved requirement warrants changing them. Reuse existing provider adapters, extraction, PDF-reading, artifact, usage, and job infrastructure. Keep learner attempt/review evidence separate from graph facts. Use stable references and deliberate migrations.

Do not replace the entire application in one giant change. Complete coherent user stories with working persistence and error behavior. Preserve existing features unless an approved design explicitly replaces them.

## Implementation standards

- Build functional interfaces connected to real behavior, not decorative buttons or permanently hardcoded production data.
- Use synthetic/licensed fixtures for tests and the clearly labeled demo mode. Do not expose personal conversations, source documents, credentials, or private paths in screenshots or exports.
- Make loading, empty, partial-failure, retry, cancel, and restart behavior part of the approved design.
- Preserve user edits and source provenance. Do not turn unsupported model assessments into factual mastery claims.
- Ground citation checks in the actual source revision and passage; a valid link alone does not prove support for a claim.
- Distinguish learner work from model-generated assistance in practice and mission evidence.
- Keep experimental/generated content isolated as appropriate to the existing runtime. Deliberately flawed practice material must not become verified graph knowledge.
- Measure performance before optimizing. Avoid unrelated framework rewrites or dependency churn.
- Maintain a milestone tracker with approved decisions, changed files, completed acceptance checks, failures, and remaining work. Use the roadmap IDs so another chat can resume accurately.

## Testing and verification

Read the scripts and CI configuration and establish baseline results before making substantial changes. The repository has typecheck, lint, tests, and build scripts; run the relevant checks using commands that actually work in the available environment.

This workspace is Windows/PowerShell. Some existing scripts use POSIX environment assignments or shell syntax. If a command cannot run as written, use an equivalent supported invocation or propose a deliberate script fix; do not report a skipped command as a pass.

For each milestone:

1. Add or update meaningful tests for the new behavior and identified failure cases.
2. Run targeted tests during implementation, then the necessary regression/typecheck/lint/build gates for integration.
3. Fix regressions caused by your changes. Record pre-existing failures separately with reproduction evidence.
4. Run the application and exercise the actual user flow in a browser. Verify packaged desktop behavior when the milestone changes desktop-specific functionality.
5. Check small-window layouts, long questions/documents, keyboard navigation, and relevant focus/accessibility behavior.
6. Verify persistence and recovery after refresh/restart; use isolated data directories and copied fixtures for destructive or migration scenarios.
7. Record exactly what passed, failed, or was not run, with any material limitations.

Priority scenarios include:

- Create subject -> import source -> start lesson -> open citation -> answer practice -> inspect review -> restart and resume.
- Duplicate/partial imports, changed sources, broken references, and missing provider configuration.
- Scheduling across time boundaries, repeated submissions, rescheduling, and corrected assessments.
- Backup/export/restore into a separate directory with private credentials excluded under the approved policy.
- Existing lessons, dictation, graph, practice, and provider behavior remaining usable.
- Fork-specific desktop identity and update destinations.
- Deterministic experimental results and correctly recorded mission evidence.

Use bounded, explicitly agreed live-model evaluation where needed. Keep deterministic checks separate from live-model checks and report which path was exercised. Do not infer model quality from mocked tests. If credentials, browser tools, signing tools, or another dependency are missing, state the exact limitation and continue the verification that is available.

## Completion and handoff

At each milestone, update the tracker and roadmap status. Keep completed work distinct from prototypes, pending designs, and deferred ideas. Update the README's change list only to match the implemented result.

At a release-ready point, provide accurate attribution, a concise implemented-feature comparison, screenshots, a clean setup guide, relevant architecture notes, known limitations, and verified release instructions. Make the demo easy to try without confusing simulated behavior with live inference.

Your final chat update should be a short TLDR:

- What changed.
- What was tested and the result.
- What remains or needs a decision.
- Where I can open the result or read the detailed evidence.

Start now by reading the files, checking the repository state, and establishing what already works. Then propose the first concrete milestone and ask the first unresolved decision needed to approve it. Once approved, move into implementation and testing; do not stop at another broad list of ideas.
