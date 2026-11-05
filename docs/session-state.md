# FoodMe: session state

Claude keeps this file current so work survives compaction and new sessions.
Keep it under about 60 lines. Replace old status instead of adding to it.
This repo is public, so this file is too. Never put secrets or personal details here.
The to-do list and the owner's ideas are in `docs/roadmap.md`.

Last updated: 2026-11-05

## Goal
A recipe app: save recipes or import them from the web, plan meals by day, and build
one combined grocery list. It is a hobby project with limited funds, so prefer free routes.
"FoodMe" is a temporary name and may change. The look leans toward 60s diner nostalgia.

## Current status
- Live at https://jebue31.github.io/foodme.github.io/ (GitHub Pages, from `main`).
- Done: login, recipes, web import, meal plan, grocery list, profile page.
- Supabase is set up, sign-ups are closed, and `import-recipe` is deployed.
- Restyle E is live on `main` for a family trial: kinetic banner on every signed-in page
  with a per-page headline ("What's the damage?" is a trial word), olive FoodMe stamp,
  jukebox page links, lined recipe cards, one page width, grocery columns on wide screens.

## In progress
Cleanup, waiting on the owner's review. Branch `cleanup/five-passes` holds 15 review passes
and is not on `main`, so the live site doesn't have them yet. It adds `test/smoke.html`,
which tests every feature on the fake backend. Merging or pushing needs the owner's OK.

Not tested yet: the live site on real data, a real phone or ultrawide, the reduced-motion
setting, password recovery links, and the real Supabase backend.

The restyle is a trial and the owner may hate it. To undo the latest live round, run
`git revert aa8e5a3` on `main` and push. To undo the whole restyle, also revert `44459ae`.
Don't reset, because `main` is the live site. `9c9050d` is the last pre-restyle version.

## Feasibility test (owner wants to start here)
Can a phone read real receipts and shelf labels well enough, on the device? The owner will
find a couple of receipts, plus shelf photos. Test accuracy first, before building Go
shopping. Don't commit the photos: this repo is public.

## Decisions and why
- Supabase over Firebase or browser storage. Static site with no build step.
- Web import runs in an edge function, not a public proxy.
- Ingredients are stored as typed lines and parsed only when building the grocery list.
- MFA skipped for now: no recovery codes, and it needs extra rules.
- Installable web app rather than a store app, because it is free.
- Family members see each other's recipes automatically. Friends see only what is shared.
- Two-way calendar sync ruled out: too much work for a small benefit.
- Diet tags are estimates ("appears gluten free"), never allergy guarantees.
- Tonight's dinner is only re-read when the plan or recipes change, or the day rolls over,
  so a change made on another device shows after a reload.

## Known traps
- No node, gh or python on this PC. Large bash heredocs fail, so use the Write tool.
- PowerShell scripts with non-English characters need saving with a BOM.
- `sed` can strip backslashes from regexes, and awk `-v` breaks on Windows paths.
- The built-in browser never picked up the GitHub sign-in. Chrome worked.
- Touch dragging is intentionally unsupported on phones.
