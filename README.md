<p align="center">
  <img src="docs/assets/reasonloom/icon.png" alt="Reasonloom icon" width="96">
</p>

<h1 align="center">Reasonloom</h1>

<p align="center"><strong>Weave ideas into understanding.</strong><br>
An AI learning workspace: keep your sources, learn from them, practice, and come back to review.</p>

![Reasonloom branding: icon, wordmark, palette, type](docs/assets/reasonloom/branding.png)

> **Independent fork of [LearnHarness](https://github.com/amosblomqvist/learnharness) by Amos Blomqvist.** The teaching engine, knowledge graph, practice agent, dictation, provider support and desktop shell are his, inherited under AGPL-3.0. This fork adds the workspace, rebrand and features below. Not endorsed by the original author.

## What changed

| LearnHarness (before) | Reasonloom (now) |
| :---: | :---: |
| ![Before: upstream teaching session](docs/assets/teaching-session.png) | ![After: source-grounded session with citations](docs/assets/reasonloom/grounded-session.png) |

New look: ink, paper and teal; serif headings; a woven-grid mark; a visible keyboard focus ring on the new pages. New sidebar sections: **Subjects, Sources, Review**.

### Subjects
Group sessions by what you're learning, with a goal. Archive instead of delete.

![Subjects page](docs/assets/reasonloom/subjects.png)

### Sources
Keep `.md` / `.txt` notes as a local library. Duplicates are caught, and every passage has a stable link that tells you if the text moved or was edited. Nothing is sent to a model.

![Sources page with a highlighted passage](docs/assets/reasonloom/sources.png)

### Source-grounded sessions
Start a lesson or practice from a subject (card button, or the picker on the home composer). The model gets that subject's passages (`S1.P1`, `S1.P2`, …), is told to prefer them and say when they don't cover something, and to cite what it used. Cited labels become links to the exact passage. A "Sources" card shows what the model was given.

*The reply in the screenshot above is a scripted example, not live model output.*

![Home with the subject picker](docs/assets/reasonloom/home.png)

### Review
Practice attempts are recorded, and concepts come back on a fixed schedule (1, 3, 7, 14, 30, 60 days) with the reason shown. Postpone an item, or flag a grade as wrong.

![Review page](docs/assets/reasonloom/review.png)

### Try it without an API key
On an empty Subjects page, click **Load the sample workspace**: a labelled, synthetic subject, source and practice record. No model involved.

## Run it

Needs Node.js (developed and tested on Node 24).

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # no network, no LLM
```

Add a provider key in **Settings** and pick your models. Your chats, graph, sources and keys stay on your machine; model requests go to the provider you choose.

## Honest limits

- No downloadable installer or release yet. Run from source.
- Source grounding is an instruction to the model, **not enforced**. A citation proves the passage exists, not that it supports the claim. Not yet tested against a live model.
- The review schedule is a simple convention, not proof it improves retention. Days are UTC.
- Library: text and Markdown only (no PDF, URLs or OCR). Grounding context is capped (~24k characters, 10 sources) and the card says what was left out.
- Sessions are grounded only when started with a subject chosen.
- The macOS icon and installer art still use upstream artwork. The name "Reasonloom" hasn't been trademark-checked.

## Docs

[Build progress and test evidence](docs/BUILD_PROGRESS.md) · [Decisions](docs/BUILD_DECISIONS.md) · [Roadmap](docs/FORK_ROADMAP.md) · [Development](docs/development.md) · [Architecture](docs/architecture.md) · [Desktop release](docs/desktop-release.md) · [Issues](https://github.com/osamaPY/learnharness-fork/issues)

## License

[AGPL-3.0](LICENSE). Original copyright and notices are preserved. If you run a modified version for others over a network, you must offer them the source.
