# FoodMe

Save recipes, plan meals for the week, and turn the plan into one combined grocery list.

The site is plain HTML, CSS and JavaScript hosted on GitHub Pages, with no build step. Login, the database and recipe import run on [Supabase](https://supabase.com), which has a free plan.

## Setup

### 1. Create the database

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in all of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.

### 2. Connect the site

1. In Supabase, open **Project Settings > API** and copy the **Project URL** and the **anon** (or **publishable**) key.
2. Paste them into [`config.js`](config.js), then commit and push.

The anon key is meant to be public, because the database rules are what protect your data. Never put the `service_role` or secret key in this repo.

### 3. Set the login redirect

In Supabase, open **Authentication > URL Configuration** and set **Site URL** to the site's address. Without this, confirmation and password-reset emails link to the wrong place.

### 4. Turn on importing from the web

1. In Supabase, open **Edge Functions** and choose to deploy a new function from the editor.
2. Name it exactly `import-recipe`.
3. Paste in all of [`supabase/functions/import-recipe/index.ts`](supabase/functions/import-recipe/index.ts) and deploy.
4. In the function's settings, turn **Verify JWT** off. The function checks the signed-in user itself, and this avoids problems with newer key types.

Everything except web import works without this step.

### 5. Close sign-ups (recommended)

Anyone who finds the site can create an account. They can't see your recipes, but they could use your free database quota. Once your account exists, turn off **Allow new users to sign up** under **Authentication > Sign In / Providers**.

## How it works

- **Ingredients** are stored as the lines you type. They are only parsed when building the grocery list.
- **The grocery list** adds up every meal planned for the selected week. It converts between units such as tsp, tbsp and cups, and merges singular and plural names. Rebuilding keeps items you added by hand and anything you've ticked off.
- **Web import** reads the recipe data that most recipe sites publish for search engines. Sites without that data, or that block automated requests, need entering by hand.
- **Accounts are separate.** To share recipes and a list, share one login.

## Tests

Run a local copy with a fake in-browser backend, so no Supabase project is needed:

```bash
powershell -ExecutionPolicy Bypass -File test/server.ps1
```

Then open `http://localhost:8123/` for the app, which signs you in as a made-up demo user with sample recipes. For tests, open `http://localhost:8123/test/tests.html` (parser) or `http://localhost:8123/test/smoke.html` (every feature; it resets the demo data).
