# FoodMe: roadmap

The owner's ideas, in order. This repo is public, so no personal details here.
Current status lives in `session-state.md`.

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

## Signature feature: Go shopping (place in the order not decided)
The owner's reason to use the app. A "Go shopping" button on the grocery list. Search for
and pick your store(s), then it finds the best deals on the list's items and splits the
list by store. Each item shows its price and physical aisle if available, with total cost
plus tax at the top.

- Research, 2026-11-04: no official free price or aisle API found for the owner's chains,
  only unofficial paid scrapers (Apify, per record), which may break or conflict with
  store terms.
- Proposed: a "price book" first, where prices and aisles are saved by hand per store and
  reused. Add a data source later only if the owner approves.
- Tax is an estimate: most groceries are zero-rated, but snacks, pop, candy and non-food
  are taxed.
- "Waze for grocery stores": people share prices so everyone saves. Order: price book,
  family-only scanning, confirmations, then city-wide sharing only if it works.
- Two optional inputs, maybe both for a while: a shelf-label photo when checking an item
  off, or a receipt photo.
- Owner's security rule for receipts: read on the device, never in the cloud. The user
  reviews the data and clicks send, so nothing personal goes out.

## Much later
A recipe store where people post recipes, and others grab, try, rate and add pictures to
them. Needs spam and duplicate protection, moderation and open sign-ups, so check free-tier
limits for users and photo storage first.

## Look ideas to revisit
- The owner wants to revisit the jukebox page buttons and may adjust them. Reminder: they
  don't love the white border in dark mode.
- Other link styles shown: guest check tabs, neon sign, checkerboard strip, full diner
  (adds turquoise and The Menu / Specials / The Check).
- Earlier looks, if E is dropped: A. Warm glass; B. Liquid glass; C. Modern cookbook;
  D. Technical wireframe and brutalist grid; F. Bento grid. A and F combined was the
  earlier recommendation.
- Planned but not built: a Light / Dark / Match device switch, and a floating phone tab bar.
