# Reasonloom

**Weave ideas into understanding.**

An AI learning workspace for teaching, practice, and the connections between ideas. Organize sessions into subjects, keep a local source library, and revisit concepts through review.

[How it works](#how-it-works) · [Documentation](docs/development.md) · [Issues](https://github.com/osamaPY/learnharness-fork/issues) · [Build progress](docs/BUILD_PROGRESS.md)

Reasonloom is an independent fork of [LearnHarness](https://github.com/amosblomqvist/learnharness), created by **Amos Blomqvist**. We liked its approach to adaptive AI-assisted learning and are building on that foundation. The teaching engine, knowledge graph, practice, dictation, provider support, and desktop shell are inherited from upstream. Original authorship and the AGPL-3.0 license are preserved; Reasonloom is not an official upstream release. The changes below distinguish our work from that foundation.

There is no published Reasonloom release yet. Upstream downloads and screenshots below describe the original application.

## What this fork changes (working)

- Updated the local development baseline from upstream 0.3.9 to its 0.4.0-preparation revision while retaining existing local edits. Upstream's new provider, Claude Code, file-path, and image capabilities are **inherited**, not fork-authored features.
- Made existing automated tests run on Windows by using native paths and file URLs, adapting test fixtures to retained local changes, and excluding POSIX-only file-mode and signal assertions on Windows. The 0.4.0-preparation suite, typecheck, lint, and production build pass under the conditions recorded in the [fork roadmap](docs/FORK_ROADMAP.md). These are development and verification changes, not new learner-facing features.
- Named the browser and desktop application **Reasonloom**, with an independent application ID and executable. Desktop profiles intentionally retain `LearnHarness Fork` / `LearnHarness Fork-dev` to preserve existing fork data. The original application's data is not migrated or modified; ordinary web development retains its configured data directory.
- Directed installer publishing and packaged update checks to `osamaPY/learnharness-fork`, with distinct installer names and release-validation checks. No fork installer or update has been published or tested on a real installed copy yet.
- Removed hardcoded credential assignments from the local Windows launch helpers. Configure providers in Settings or through your own environment; do not add credentials to these scripts.
- Retained earlier local Deepgram and Electron edits and Windows launch helpers for further review; their behavior has not been approved or verified as a fork release feature.

## Fork learning workspace (implemented, early)

These pages are new in this fork and are reachable from the sidebar. They are working but early; each has automated tests and a browser check on an isolated data folder, and none has been used in a long real-world study session yet.

- **Subjects** (`/subjects`): create subjects with a goal, rename, archive and restore them, and move sessions between them. A session belongs to at most one subject. Subjects are archived, never deleted.
- **Sources** (`/sources`): keep `.md`, `.markdown` and `.txt` notes (up to 1 MiB each) as a local text library. Duplicates are detected; a changed file with the same name updates in place (the old text is not kept). Each passage has a stable link that reports when the passage moved or was edited. Nothing is sent to a model, and this library is separate from the original "Import notes" graph extraction.
- **Review** (`/review`): finished practice problems become attempts; concepts return on a fixed schedule (1, 3, 7, 14, 30, 60 days) with a plain-language reason. You can postpone an item or flag a grade as wrong. The schedule is a simple convention, not evidence that it improves retention.
- **Source-grounded sessions**: on a subject card, "Start a lesson" or "Start practice" opens a new session that joins the subject and hands the model that subject's passages (labelled S1.P1, S1.P2, ...) with an instruction to prefer them, to say when the material does not cover a question, and to cite labels it relied on. A cited label in the reply becomes a link to the exact passage on the Sources page; made-up labels stay plain text. A collapsible "Sources" card at the top of the session shows what the model was given.
- **Sample workspace**: on an empty Subjects page, "Load the sample workspace" creates clearly labelled synthetic data (a subject, a source, and a scripted practice record) so the path can be explored without a provider. No model produced it.
- **Dashboard card**: when graph rendering is turned off, the minimal home shows a Continue card and a start guide.

Known limits: source grounding is an instruction to the model, not a fence — nothing verifies that a lesson or practice problem stayed within your material, and a citation shows the passage exists, not that it supports the claim; the context is capped (about 24,000 characters, 10 sources) and the card says when material was left out; it is only added when a session is started with a subject chosen (from a subject card, or the subject picker on the home composer and new-session draft), never retroactively to existing sessions; sources are not yet fed to the knowledge graph; review does not start a fresh problem for you; review days are UTC; PDFs, URLs and OCR are not supported in the library; there is no backup/restore, export, or per-subject filter in the sidebar session list. Practice attempts were verified on scripted records shaped like the real tool output, not on a live model session.

## Planned, not implemented

Enforced (not just advised) source grounding and passage ranking, richer imports, exam and teach-back modes, study exports and backups, the experimental learning ideas, and a published fork release remain plans in the [fork roadmap](docs/FORK_ROADMAP.md). Nothing has been published. Follow the [live build progress](docs/BUILD_PROGRESS.md) for completed patches, test evidence, and remaining verification.

LearnHarness uses AI agents to plan and teach lessons from your current understanding to your goal. It builds a detailed picture of what you understand and how you reason. That picture is updated as you learn.

Instead of just giving you an explanation, it uses your answers and thinking to decide what you need next. Teaching builds understanding one reasoning step at a time. Practice makes it usable. A persistent knowledge graph carries it across sessions.

![Upstream LearnHarness teaching session](docs/assets/teaching-session.png)

## How it works

1. **Measure.** Before teaching, the agent finds where your understanding ends on each part the lesson depends on. Your answers, confidence, and thinking show it where to start.
2. **Plan.** It works out a dependency map from that starting point to your goal. You can see the plan, and the lesson adapts when your understanding turns out different.
3. **Teach.** Each step builds on something you already understand. You predict, get an explanation, and check your understanding. Confusions are repaired before anything is built on them. The aim is for the goal to feel obviously true, not merely familiar.
4. **Practice.** Separate sessions pose varied problems that require the right knowledge to come to mind without being named first. Problems and hints adapt to your reasoning.

**Think out loud.** The thinking fields let you explain your reasoning, uncertainties, and reactions in your own words. This is how the agent gets a detailed picture rather than just a record of right and wrong answers. You can type or use dictation.

The agent can also research questions in the background, create visual explanations, and build interactive demonstrations.

## Knowledge that carries forward

What you are taught accumulates as propositions and reasoning chains: individual claims and the premises that lead to them. The graph shows this structure, with links back to the source sessions. You can also import notes.

Future teaching sessions can read the graph instead of starting from scratch. Practice sessions can draw their material from it. It stores the ideas and their connections, not ratings of your ability.

![Upstream LearnHarness knowledge graph](docs/assets/knowledge-graph.png)

## Upstream downloads (not Reasonloom)

**[Download from learnharness.ai](https://learnharness.ai)** · [GitHub Releases](https://github.com/amosblomqvist/learnharness/releases)

- **macOS (Apple Silicon):** signed and notarized DMG. Drag the app to Applications.
- **Windows (x64):** run the installer. It is currently unsigned; Windows may show an “unknown publisher” or SmartScreen warning.
- **Linux (x64):** make the AppImage executable and open it, or install the Debian/Ubuntu `.deb`.

Add your provider API key and choose your models, then start a session with what you want to understand. LearnHarness supports 30+ provider options, including OpenAI, Anthropic, Google, DeepSeek, and OpenRouter. Optional dictation and web search use separate service keys.

All three platforms support in-app updates.

**Dictation:** Create a [Deepgram API key](https://console.deepgram.com/) with the **Member role or higher** ([required for token minting](https://developers.deepgram.com/reference/auth/tokens/grant)) and add it under **Settings → Providers → Dictation**. Choose the language below the key; **Multilingual** supports automatic recognition and mixed-language speech. A `403 Insufficient permissions` error during token minting can indicate an insufficient key role.

## Your keys, your data

- **Your keys and models.** No LearnHarness subscription or markup. You pay your providers for usage; a live cost meter shows model costs.
- **Local storage.** Your chats, graph, settings, and API keys live on your machine. Learning records are plain files you can inspect.
- **External services.** Models run through your configured providers. Model requests send the context needed for the task; web research and dictation also contact external services. Local storage does not mean offline processing.
- **Inspectable behavior.** System prompts are visible and editable. The app is open source under the AGPL-3.0 license.

## Development and support

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # deterministic, no LLM, no network
```

See the [development guide](docs/development.md), [architecture](docs/architecture.md), and [desktop release guide](docs/desktop-release.md).

Questions, bug reports, and feature requests: [GitHub Issues](https://github.com/amosblomqvist/learnharness/issues).

## License

[AGPL-3.0](LICENSE)

The app is free and open forever. If we ever charge for anything, it will be for convenience — managed keys, hosting — never for features you can run locally.
