# FoodMe

Static recipe, meal plan and grocery list site on GitHub Pages, backed by Supabase.
See README.md for setup, `docs/session-state.md` for where the work stands, and
`docs/roadmap.md` for the to-do list.

## Keeping context safe

`docs/session-state.md` is the record of this project's current state. It is reloaded
automatically after compaction, so anything that must survive belongs there.

- Read it at the start of every session, before doing any work.
- Update it when a decision is made, a task is finished, or the plan changes, and
  before a long or risky step. Record why, and any options ruled out.
- Keep it short. Replace old status instead of adding to it.
- If the user states a lasting rule, add it to this file, not only to the chat.
- After compaction, trust the state file and the code over the summary. If they
  disagree, or something seems missing, ask instead of guessing.

## Rules

- This repo is public and `main` is the live site. Everything committed can be read by
  anyone, including this file and the state file.
- Never put the Supabase `service_role` or secret key, or the database password, in the
  repo. Do not ask the user to send them. Only the URL and publishable key go in `config.js`.
- Keep personal details out of commits and docs. Commit as
  `git -c user.name=jebue31 -c user.email=jebue31@users.noreply.github.com commit`.
- Build and test one feature at a time locally. The owner reviews it first.
- Ask before big changes or anything that could break things, such as merging a branch
  into `main` or pushing to `main`, which changes the live site.
- Test locally with `test/server.ps1` (fake backend, port 8123), `test/tests.html` and `test/smoke.html`.
- Give database changes as a re-runnable `supabase/schema.sql` before relying on them.
- No build step, and nothing that needs paid services without asking first.
