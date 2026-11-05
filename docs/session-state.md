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
Site restyle, chosen ahead of new features so they don't need restyling later. Nothing
has changed yet. Three looks are waiting on the owner's choice:
- A. Warm glass (recommended): frosted panels, peach and gold glow, serif headings.
- B. Liquid glass: closest to the iPhone look, but busy behind recipe photos.
- C. Modern cookbook: calmest, big images, depends on recipes having photos.

Whichever is chosen includes a Light / Dark / Match device theme, a floating glass tab
bar on phones, and heavy blur only on the top bar, tab bar and pop-ups.

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
