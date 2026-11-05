# FoodMe: session state

Claude keeps this file current so work survives compaction and new sessions.
Keep it under about 60 lines. Replace old status instead of adding to it.
This repo is public, so this file is too. Never put secrets or personal details here.

Last updated: 2026-11-04

## Goal
A recipe app: save recipes or import them from the web, plan meals by day, and build
one combined grocery list. It is a hobby project with limited funds, so prefer free routes.

"FoodMe" is a temporary name and may change. The look is leaning toward 60s diner nostalgia.

## Current status
- Live at https://jebue31.github.io/foodme.github.io/ (GitHub Pages, from `main`).
- Done: login, recipes, web import, meal plan, grocery list, profile page.
- Meal plan redesign is live: 7-column board with drag and drop on computers, compact
  day list on phones. Tested on the fake backend only, not on a real phone or live data.
- Supabase is set up, sign-ups are closed, and `import-recipe` is deployed.

## In progress
Site restyle, chosen ahead of new features so they don't need restyling later. The owner
picked E. It is live on `main` as a trial, in commits `44459ae` and `aa8e5a3`:
- Kinetic typography, off for reduced motion. The "What's for dinner?" banner is on every
  signed-in page. Recipe card lines are lighter and the text is easier to read.
- Headline changes by page (Plan: "What's the plan?", Grocery: "What's the
  damage?", a family trial word) with FoodMe after it as an olive rubber stamp. Only the
  last word swings on page changes, over 0.9 seconds. No line above the banner.
  Page links sit below the ticker and replace the page headings. They are jukebox buttons
  (A1 Recipes, B2 Plan, C3 Grocery) for now. **The owner wants to revisit these buttons
  and possibly adjust them later.** Reminder: the owner doesn't love their white border in
  dark mode. Other ideas shown: guest check tabs, neon sign,
  checkerboard strip, full diner (adds turquoise and The Menu / Specials / The Check).
- Recipe cards look like old lined index cards, split by a curly bracket.

Live for a family trial on real data from phones and other computers. Tested on the fake
backend only before the push (it has a demo user, as real accounts can't sign in locally).
Reduced-motion rules are untested. A Light / Dark / Match device switch and a floating
phone tab bar were planned but are not built.

**This is a trial and the owner may hate it.** To undo the latest round, run
`git revert aa8e5a3` on `main` and push. To undo the whole restyle, also revert `44459ae`.
Don't reset, because `main` is the live site. `9c9050d` is the last pre-restyle version.

If E is dropped, the other looks were: A. Warm glass; B. Liquid glass; C. Modern cookbook;
D. Technical wireframe and brutalist grid; F. Bento grid. A and F combined was the
earlier recommendation: a bento home screen of warm glass tiles.

## Feasibility test (owner wants to start here)
Can a phone read real receipts and shelf labels well enough, on the device? The owner will
find a couple of receipts, plus shelf photos. Test accuracy first, before building Go
shopping. Don't commit the photos: this repo is public.

## Small fixes to do
- Move Delete off the recipe page to the bottom of the edit screen, so it doesn't get
  clicked by accident. Keep the "Are you sure?" prompt.

## Next steps, in order
1. Recipes page cards: keep the lined card but drop the curly bracket. Show a picture and
   a short restaurant-menu style blurb instead of recipe text. The full recipe card stays.
   Needs a place to store the blurb (database change) and a plan for recipes with no photo.
2. Grocery stars: a star beside ingredients needed for the next planned meal, marking
   them as important.
3. Friends, with invite links (needs a small server function; sign-ups stay closed).
4. Family groups: one family per person, with a My plan / Family plan switch.
5. Phone install (PWA) and photo recipes: paste-text parser first, then a free AI tier
   after checking limits and privacy terms. Optional "Keep the photo".
6. Recipe filters plus estimated nutrition and diet tags, with a nutrition card.
7. Diet icons on the recipe cards, in a bottom corner: gluten free, vegan, vegetarian,
   high protein. Uses the diet tags from step 6.
8. Card flip showing the back of the card: ingredients, nutrition facts and diet icons.
   Uses the nutrition from step 6. Plan: tapping the card opens the full recipe. A visible
   folded corner flips it, with a page-peel on click and a slight curl on hover. Swipe also
   flips on phones. The back has a "Full recipe" link and a way to flip back. Show a
   one-time tip above the cards, not text on each card. Click, not drag: drag is fiddly
   and has no keyboard route.
9. Calendar linking: a private subscription link for Google and Outlook (one-way).
10. Microsoft To Do (last, optional).
11. Ratings: difficulty, cost, time and taste out of 10, with an average on the main card.
    Open question: decide if 10 means best or most, so "hard" doesn't raise the average.

Signature feature, the owner's reason to use the app (place in the order not decided):
"Go shopping" button on the grocery list. Search for and pick your store(s), then it finds
the best deals on the list's items and splits the list by store. Each item shows its price
and physical aisle if available, with total cost plus tax at the top. Researched 2026-11-04:
no official free price or aisle API found for the owner's chains; only unofficial paid
scrapers (Apify, per record), which may break or conflict with store terms. Proposed: a
"price book" first, where prices and aisles are saved by hand per store and reused, then
add a data source later if the owner approves. Tax is an estimate: most groceries are
zero-rated, but snacks, pop, candy and non-food are taxed.
Idea, a "Waze for grocery stores": people share prices so everyone saves. Order: price
book, family-only scanning, confirmations, then city-wide sharing only if it works. Two
optional inputs, maybe both for a while: a shelf-label photo when checking an item off,
or a receipt photo. Owner's security rule for receipts: read on the device, never in the
cloud. The user reviews the data and clicks send, so nothing personal goes out.

Much later: a recipe store where people post recipes, and others grab, try, rate and add
pictures to them. Needs spam and duplicate protection, moderation and open sign-ups, so
check free-tier limits for users and photo storage first.

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
