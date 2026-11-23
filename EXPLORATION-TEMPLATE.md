# Exploration template

Every exploration folder (`v1/` … `v8/`) has a `README.md` with these sections, in this order. Keep the headings exactly as written, so the explorations can be read side by side. Write plainly; every number and file name must be one you can point to in the code, a results file, `index.html`, `README.md` or the commit history.

```markdown
# vN: <one-line name>

| | |
| --- | --- |
| **Status** | Chosen · Superseded by vM · Rejected · Baseline · Ported (one of these) |
| **Builds on** | vK (or "—") |
| **Question** | The one question this exploration set out to answer |
| **Answer** | The one-line answer it gave |
| **Checks** | `n/n` in jsdom; real desk: … (or "jsdom only") |

## Idea

What was tried, in 3–6 sentences or bullets. What is different from the exploration it builds on.

## What's here

| File | What it is |
| --- | --- |

## How to run

The exact command(s), from the repository root, and what a passing run prints.

## What it proved

Bullets. Each one names the check, probe or measurement that shows it.

## Why it didn't work

Only when the repository records the reason (root `README.md`, `index.html`, `LEARNINGS.md`, a results file, or the code). Say what failed, the evidence, and what replaced it. If no reason is recorded, leave this section out entirely: no placeholder, no guess.

## What it cost / what broke

Bullets. Measured costs and failures.

## Carried forward

What the next exploration kept, and what it dropped.

## Open questions

What this exploration left unanswered (or "None": then say what answered them, and where).

## See also

Links to the related sections of `index.html`, `LEARNINGS.md`, `compat/`, `bench/`, and the other explorations.
```

A folder can add more sections after **See also** (for example `v8/` keeps its full design notes there), but the sections above come first.
