# FoodMe: session state

Claude keeps this file current so work survives compaction and new sessions.
Keep it under about 60 lines. Replace old status instead of adding to it.
This repo is public, so this file is too. Never put secrets or personal details here.

Last updated: 2026-11-04

## Goal
A recipe app: save recipes or import them from the web, plan meals by day, and build
one combined grocery list. It is a hobby project with limited funds, so prefer free routes.

## Current status
- Live at https://jebue31.github.io/foodme.github.io/ (GitHub Pages, from `main`).
- Done: login, recipes, web import, meal plan, grocery list, profile page.
- Meal plan redesign is live: 7-column board with drag and drop on computers, compact
  day list on phones. Tested on the fake backend only, not on a real phone or live data.
- Supabase is set up, sign-ups are closed, and `import-recipe` is deployed.

## In progress
Site restyle, chosen ahead of new features so they don't need restyling later. The owner
picked E. It is live on `main` as a trial, in commit `44459ae`:
- Kinetic typography, with motion only on the Recipes home screen. Off for reduced motion.
- Recipe cards look like old lined index cards, split by a curly bracket.

Pushed so the owner can try it on real data from a phone and another computer. The local
test server uses a fake backend, so real accounts can't sign in there. Before the push it
was tested on that fake backend only. Reduced-motion rules are untested. A Light / Dark /
Match device switch and a floating phone tab bar were planned but are not built.

**This is a trial and the owner may hate it.** To revert, run `git revert 44459ae` on
`main` and push. Don't reset, because `main` is the live site. `9c9050d` is the last
version before the restyle.

If E is dropped, the other looks were: A. Warm glass; B. Liquid glass; C. Modern cookbook;
D. Technical wireframe and brutalist grid; F. Bento grid. A and F combined was the
earlier recommendation: a bento home screen of warm glass tiles.

## Next steps, in order
1. Friends, with invite links (needs a small server function; sign-ups stay closed).
2. Family groups: one family per person, with a My plan / Family plan switch.
3. Phone install (PWA) and photo recipes: paste-text parser first, then a free AI tier
   after checking limits and privacy terms. Optional "Keep the photo".
4. Recipe filters plus estimated nutrition and diet tags, with a nutrition card.
5. Calendar linking: a private subscription link for Google and Outlook (one-way).
6. Microsoft To Do (last, optional).

## Decisions and why
- Supabase over Firebase or browser storage. Static site with no build step.
- Web import runs in an edge function, not a public proxy.
- Ingredients are stored as typed lines and parsed only when building the grocery list.
- MFA skipped for now: no recovery codes, and it needs extra rules.
- Installable web app rather than a store app, because it is free.
- Family members see each other's recipes automatically. Friends see only what is shared.
- Two-way calendar sync ruled out: too much work for a small benefit.
- Diet tags are estimates ("appears gluten free"), never allergy guarantees.

## Known traps
- No node, gh or python on this PC. Large bash heredocs fail, so use the Write tool.
- `sed` can strip backslashes from regexes, and awk `-v` breaks on Windows paths.
- The built-in browser never picked up the GitHub sign-in. Chrome worked.
- Touch dragging is intentionally unsupported on phones.
