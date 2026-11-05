import * as api from "./api.js";
import { buildGroceryLines, ingredientKey } from "./ingredients.js";

/* ---------- safe HTML templating: every ${value} is escaped unless it came from h`` ---------- */

class Safe { constructor(s) { this.s = s; } }
const esc = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const piece = (v) => v instanceof Safe ? v.s
  : Array.isArray(v) ? v.map(piece).join("")
  : v == null || v === false ? "" : esc(String(v));
const h = (strings, ...values) =>
  new Safe(strings.reduce((out, s, i) => out + s + (i < values.length ? piece(values[i]) : ""), ""));

/* ---------- state ---------- */

const root = document.getElementById("app");
const state = {
  session: null,
  recovering: false,
  recipes: null,
  week: startOfWeek(new Date()),
  draft: null,
  query: "",
  profile: undefined, // undefined = not loaded yet, null = no name saved
  tonight: null,
};
let renderToken = 0;

const SLOTS = ["breakfast", "lunch", "dinner"];
const recipeById = (id) => state.recipes?.find((r) => r.id === id);
const safeHttpUrl = (u) => (/^https?:\/\//i.test(u ?? "") ? u : null);

/* ---------- dates: local calendar days, never UTC, so evenings don't slip a day ---------- */

function startOfWeek(d) {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7)); // Monday
  return day;
}
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shortDate = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
const weekLabel = (start) => `${shortDate(start)} – ${shortDate(addDays(start, 6))}`;

/* ---------- small helpers ---------- */

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 4000);
}

function guarded(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error(err);
      toast(err.message || "Something went wrong.");
    }
  };
}

async function busy(button, fn) {
  button.disabled = true;
  try {
    return await fn();
  } finally {
    button.disabled = false;
  }
}

const go = (hash) => {
  if (location.hash === hash) render();
  else location.hash = hash;
};

async function ensureRecipes() {
  state.recipes ??= await api.listRecipes();
  return state.recipes;
}

function resort() {
  state.recipes.sort((a, b) => a.title.localeCompare(b.title));
}

const displayName = () => state.profile?.display_name ?? state.session?.user?.email?.split("@")[0] ?? "there";

// The greeting shouldn't take the whole app down if the profile can't load.
async function ensureProfile() {
  if (state.profile !== undefined) return;
  try {
    state.profile = await api.getProfile();
  } catch (err) {
    console.error(err);
    state.profile = null;
  }
}

/* ---------- shell ---------- */

function shell(active, content) {
  const tab = (href, id, code, label) =>
    h`<a href="${href}" class="tab" ${id === active ? h`aria-current="page"` : ""}><i aria-hidden="true">${code}</i>${label}</a>`;
  root.innerHTML = h`
    <header class="topbar">
      <a class="hello" href="#/profile" ${active === "profile" ? h`aria-current="page"` : ""}>Hi, ${displayName()}</a>
    </header>
    <main class="page">
      ${kineticBanner(active)}
      <div class="page-head" id="nav-row">
        <nav class="tabs" aria-label="Main">
          ${tab("#/recipes", "recipes", "A1", "Recipes")}
          ${tab("#/plan", "plan", "B2", "Plan")}
          ${tab("#/grocery", "grocery", "C3", "Grocery")}
        </nav>
      </div>
      ${content}
    </main>`.s;
  // The page links sit beside the page's own heading when it has one.
  const heading = root.querySelector(".page-head:not(#nav-row) h1");
  if (heading) {
    heading.after(root.querySelector(".tabs"));
    document.getElementById("nav-row").remove();
  }
  startBanner();
}

/* ---------- auth screens ---------- */

function authView(mode = "in", notice = "") {
  const title = { in: "Sign in", up: "Create your account", reset: "Reset your password", newpass: "Choose a new password" }[mode];
  root.innerHTML = h`
    <main class="auth">
      <h1 class="auth-brand">FoodMe</h1>
      <p class="auth-tag">Recipes, meals, and the shopping that follows.</p>
      <form class="card auth-card" id="auth-form" data-mode="${mode}">
        <h2>${title}</h2>
        ${notice ? h`<p class="notice" role="status">${notice}</p>` : ""}
        ${mode !== "newpass" ? h`
          <label>Email <input name="email" type="email" required autocomplete="email" autofocus></label>` : ""}
        ${mode !== "reset" ? h`
          <label>Password
            <input name="password" type="password" required minlength="8"
              autocomplete="${mode === "in" ? "current-password" : "new-password"}">
          </label>` : ""}
        <p class="form-error" id="auth-error" role="alert" hidden></p>
        <button class="primary" type="submit">${
          { in: "Sign in", up: "Create account", reset: "Send reset link", newpass: "Save password" }[mode]
        }</button>
        ${mode === "in" ? h`
          <div class="auth-links">
            <button type="button" class="link" data-action="auth-mode" data-mode="up">Create an account</button>
            <button type="button" class="link" data-action="auth-mode" data-mode="reset">Forgot password?</button>
          </div>` : mode !== "newpass" ? h`
          <div class="auth-links">
            <button type="button" class="link" data-action="auth-mode" data-mode="in">Back to sign in</button>
          </div>` : ""}
      </form>
    </main>`.s;
  root.querySelector("input")?.focus();
}

async function submitAuth(form) {
  const { mode } = form.dataset;
  const { email, password } = Object.fromEntries(new FormData(form));
  const errorEl = form.querySelector("#auth-error");
  errorEl.hidden = true;
  const button = form.querySelector("[type=submit]");
  try {
    await busy(button, async () => {
      if (mode === "in") {
        await api.signIn(email, password);
      } else if (mode === "up") {
        const { session } = await api.signUp(email, password);
        if (!session) authView("in", "Check your email to confirm your account, then sign in.");
      } else if (mode === "reset") {
        await api.sendReset(email);
        authView("in", "If that address has an account, a reset link is on its way.");
      } else {
        await api.setPassword(password);
        state.recovering = false;
        toast("Password updated.");
        history.replaceState(null, "", "#/recipes");
        render();
      }
    });
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

/* ---------- recipes ---------- */

const BRACE = h`<span class="brace" aria-hidden="true"><i></i><i></i></span>`;
const CARD_INGREDIENTS = 5;

function recipeCards(recipes) {
  return recipes.map((r) => {
    const meta = [r.minutes ? `${r.minutes} min` : null, r.servings ? `serves ${r.servings}` : null].filter(Boolean).join(" · ");
    const image = safeHttpUrl(r.image_url);
    const crowded = r.ingredients.length > CARD_INGREDIENTS;
    const shown = r.ingredients.slice(0, crowded ? CARD_INGREDIENTS - 1 : CARD_INGREDIENTS);
    return h`
      <a class="recipe-card index-card" href="#/recipes/${r.id}">
        <span class="ic-head"><strong>${r.title}</strong>${meta ? h`<small>${meta}</small>` : ""}</span>
        <span class="ic-body">
          <span class="ic-left">
            ${shown.map((i) => h`<span>${i}</span>`)}
            ${crowded ? h`<span class="ic-note">+ ${r.ingredients.length - shown.length} more</span>` : ""}
          </span>
          ${BRACE}
          <span class="ic-right">
            ${image ? h`<img src="${image}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
            ${r.steps || h`<span class="ic-note">No method yet.</span>`}
          </span>
        </span>
      </a>`;
  });
}

/* ---------- the "What's for dinner?" banner, on every signed-in page ---------- */

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let tonightTimer;
let tonightIndex = Math.floor(Math.random() * 1000);
let bannerEntered = false; // the headline rises once, not on every page change

function motionPaused() {
  try {
    return localStorage.getItem("foodme-motion") === "off";
  } catch {
    return false;
  }
}

// The planned dinner when there is one, otherwise a rotating suggestion from the cookbook.
async function tonightChoices() {
  const today = dayKey(new Date());
  try {
    const meals = await api.listMeals(today, today);
    const dinners = meals.filter((m) => m.slot === "dinner").map((m) => recipeById(m.recipe_id)?.title).filter(Boolean);
    if (dinners.length) return { label: "Tonight:", names: dinners };
  } catch (err) {
    console.error(err); // a decoration shouldn't take the page down
  }
  return { label: "Tonight, maybe:", names: (state.recipes ?? []).map((r) => r.title) };
}

async function ensureBanner() {
  try {
    await ensureRecipes();
  } catch (err) {
    console.error(err);
  }
  state.tonight = await tonightChoices();
}

function swingTonight(el, duration = 500) {
  if (reducedMotion.matches) return;
  el.animate(
    [{ transform: "translateY(40%) rotate(-3deg)", opacity: 0 }, { transform: "none", opacity: 1 }],
    { duration, easing: "ease" },
  );
}

const HEADLINES = {
  plan: ["What's", "the", "plan?"],
  grocery: ["What's", "the", "damage?"],
};
const DEFAULT_HEADLINE = ["What's", "for", "dinner?"];
let headline = DEFAULT_HEADLINE;
let shownHeadline = null;

function kineticBanner(active) {
  headline = HEADLINES[active] ?? DEFAULT_HEADLINE;
  const { label, names } = state.tonight ?? { label: "", names: [] };
  // Enough titles to fill a wide screen, doubled so the -50% loop is seamless.
  const titles = (state.recipes ?? []).map((r) => r.title);
  const run = Array.from({ length: Math.max(titles.length, 12) }, (_, i) => titles[i % titles.length]);
  return h`
    <section class="kinetic ${bannerEntered ? "" : "enter"} ${motionPaused() ? "still" : ""}" id="kinetic">
      <p class="kinetic-title">${headline.map((word) => h`<span>${word}</span> `)}<a class="kinetic-brand" href="#/recipes">FoodMe</a></p>
      ${names.length ? h`
        <div class="kinetic-row">
          <p class="tonight">${label} <span id="tonight">${names[tonightIndex % names.length]}</span></p>
          <button class="link motion-toggle" data-action="toggle-motion">${motionPaused() ? "Play motion" : "Pause motion"}</button>
        </div>
        <div class="ticker" aria-hidden="true"><div>${[...run, ...run].map((t) => h`${t}<b>/</b>`)}</div></div>` : ""}
    </section>`;
}

function startBanner() {
  clearInterval(tonightTimer);
  // Moving between pages: only the last word swings into place.
  if (shownHeadline && shownHeadline !== headline && !motionPaused()) {
    swingTonight(document.querySelector(".kinetic-title span:nth-child(3)"), 900);
  }
  shownHeadline = headline;
  const track = document.querySelector(".ticker div");
  if (track) {
    // Same speed however long the names are: half the track is one loop, at 60px a second.
    // The delay keeps the ticker from jumping back to the start on every page change.
    const seconds = track.offsetWidth / 2 / 60;
    track.style.animationDuration = `${seconds}s`;
    track.style.animationDelay = `${-(performance.now() / 1000 % seconds)}s`;
  }
  const el = document.getElementById("tonight");
  const firstShow = !bannerEntered;
  bannerEntered = true;
  if (!el) return;
  if (firstShow) swingTonight(el);
  const { names } = state.tonight;
  if (names.length < 2) return;
  tonightTimer = setInterval(() => {
    if (!el.isConnected) return clearInterval(tonightTimer);
    if (reducedMotion.matches || motionPaused()) return;
    tonightIndex += 1;
    el.textContent = names[tonightIndex % names.length];
    swingTonight(el);
  }, 3500);
}

async function recipesView() {
  const recipes = await ensureRecipes();
  shell("recipes", h`
    <div class="page-head">
      <h1>Recipes</h1>
      <a class="button primary" href="#/recipes/new">New recipe</a>
    </div>
    <form class="import card" id="import-form">
      <label for="import-url">Add from the web</label>
      <div class="inline">
        <input id="import-url" name="url" type="url" required placeholder="https://… paste a recipe link">
        <button type="submit">Import</button>
      </div>
      <p class="form-error" id="import-error" role="alert" hidden></p>
    </form>
    ${recipes.length ? h`
      <input class="search" id="recipe-search" type="search" placeholder="Search recipes or ingredients"
        aria-label="Search recipes" value="${state.query}">
      <div class="recipe-grid" id="recipe-grid"></div>` : h`
      <div class="empty">
        <h2>Your cookbook is empty</h2>
        <p>Paste a recipe link above, or type in a family favourite.</p>
      </div>`}`);
  if (recipes.length) showRecipeMatches();
}

function showRecipeMatches() {
  const grid = document.getElementById("recipe-grid");
  if (!grid) return;
  const q = state.query.trim().toLowerCase();
  const found = !q ? state.recipes : state.recipes.filter((r) =>
    r.title.toLowerCase().includes(q) || r.ingredients.some((i) => i.toLowerCase().includes(q)));
  grid.innerHTML = found.length ? h`${recipeCards(found)}`.s : h`<p class="muted">No recipes match “${state.query}”.</p>`.s;
}

async function submitImport(form) {
  const button = form.querySelector("button");
  const errorEl = form.querySelector("#import-error");
  const url = form.url.value.trim();
  errorEl.hidden = true;
  button.textContent = "Importing…";
  try {
    await busy(button, async () => {
      state.draft = await api.importRecipe(url);
      go("#/recipes/new");
    });
  } catch (err) {
    button.textContent = "Import";
    errorEl.replaceChildren(`${err.message} `);
    const manual = document.createElement("button");
    manual.type = "button";
    manual.className = "link";
    manual.dataset.action = "enter-by-hand";
    manual.dataset.url = url;
    manual.textContent = "Enter it by hand instead";
    errorEl.append(manual);
    errorEl.hidden = false;
  }
}

async function recipeDetail(id) {
  await ensureRecipes();
  const r = recipeById(id);
  if (!r) return notFound();
  const steps = r.steps.split("\n").map((s) => s.trim()).filter(Boolean);
  const image = safeHttpUrl(r.image_url);
  const source = safeHttpUrl(r.source_url);
  const meta = [r.minutes ? `${r.minutes} minutes` : null, r.servings ? `Serves ${r.servings}` : null].filter(Boolean).join(" · ");
  shell("recipes", h`
    <a class="back" href="#/recipes">All recipes</a>
    <div class="recipe-tools actions">
      <a class="button" href="#/recipes/${r.id}/edit">Edit</a>
      <button class="danger" data-action="delete-recipe" data-id="${r.id}">Delete</button>
    </div>
    ${image ? h`<img class="hero" src="${image}" alt="" referrerpolicy="no-referrer">` : ""}
    <article class="index-card recipe-sheet">
      <header class="ic-head"><h1>${r.title}</h1>${meta ? h`<small>${meta}</small>` : ""}</header>
      <div class="ic-body">
        <section class="ic-left">
          <h2>Ingredients</h2>
          ${r.ingredients.length ? h`<ul>${r.ingredients.map((i) => h`<li>${i}</li>`)}</ul>` : h`<p class="ic-note">None listed.</p>`}
        </section>
        ${BRACE}
        <section class="ic-right">
          <h2>Method</h2>
          ${steps.length ? h`<ol>${steps.map((s) => h`<li>${s}</li>`)}</ol>` : h`<p class="ic-note">None listed.</p>`}
        </section>
      </div>
      ${source ? h`<p><a href="${source}" target="_blank" rel="noopener noreferrer nofollow">View original</a></p>` : ""}
    </article>`);
}

async function recipeForm(id) {
  await ensureRecipes();
  const existing = id ? recipeById(id) : null;
  if (id && !existing) return notFound();
  const r = existing ?? state.draft ?? {};
  const imported = !existing && state.draft?.ingredients;
  shell("recipes", h`
    <a class="back" href="${existing ? `#/recipes/${existing.id}` : "#/recipes"}">Cancel</a>
    <h1>${existing ? "Edit recipe" : imported ? "Check the import" : "New recipe"}</h1>
    ${imported ? h`<p class="notice">Imported from the web. Look it over, then save.</p>` : ""}
    <form class="recipe-form card" id="recipe-form" data-id="${existing?.id ?? ""}">
      <label>Title <input name="title" required maxlength="200" value="${r.title ?? ""}"></label>
      <div class="pair">
        <label>Serves <input name="servings" type="number" min="1" inputmode="numeric" value="${r.servings ?? ""}"></label>
        <label>Minutes <input name="minutes" type="number" min="0" inputmode="numeric" value="${r.minutes ?? ""}"></label>
      </div>
      <label>Ingredients <span class="hint">one per line, like “2 cups flour”</span>
        <textarea name="ingredients" rows="10">${(r.ingredients ?? []).join("\n")}</textarea>
      </label>
      <label>Method <span class="hint">one step per line</span>
        <textarea name="steps" rows="10">${r.steps ?? ""}</textarea>
      </label>
      <label>Source link <input name="source_url" type="url" value="${r.source_url ?? ""}"></label>
      <button class="primary" type="submit">Save recipe</button>
    </form>`);
}

async function submitRecipe(form) {
  const f = Object.fromEntries(new FormData(form));
  const number = (v) => (v === "" ? null : Number(v));
  const recipe = {
    title: f.title.trim(),
    servings: number(f.servings),
    minutes: number(f.minutes),
    ingredients: f.ingredients.split("\n").map((s) => s.trim()).filter(Boolean),
    steps: f.steps.trim(),
    source_url: safeHttpUrl(f.source_url.trim()),
  };
  if (!recipe.title) return toast("Give the recipe a title.");
  const { id } = form.dataset;
  await busy(form.querySelector("[type=submit]"), async () => {
    let saved;
    if (id) {
      saved = await api.updateRecipe(id, recipe);
      state.recipes = state.recipes.map((r) => (r.id === id ? saved : r));
    } else {
      saved = await api.createRecipe({ ...recipe, image_url: safeHttpUrl(state.draft?.image_url) });
      state.recipes.push(saved);
      state.draft = null;
    }
    resort();
    go(`#/recipes/${saved.id}`);
  });
}

/* ---------- meal plan ---------- */

function mealChip(m) {
  return h`
    <span class="meal" draggable="true" data-meal="${m.id}">
      <span class="meal-text">
        <small>${m.slot}</small>
        <a href="#/recipes/${m.recipe_id}" draggable="false">${recipeById(m.recipe_id)?.title ?? "Recipe"}</a>
      </span>
      <button class="x" data-action="remove-meal" data-id="${m.id}" aria-label="Remove from ${m.slot}">×</button>
    </span>`;
}

function planRecipes(q = "") {
  const needle = q.trim().toLowerCase();
  const found = state.recipes.filter((r) => r.title.toLowerCase().includes(needle));
  if (found.length) {
    return h`${found.map((r) => h`<div class="plan-recipe" draggable="true" data-drag-recipe="${r.id}">${r.title}</div>`)}`;
  }
  return state.recipes.length
    ? h`<p class="muted">No recipes match.</p>`
    : h`<p class="muted"><a href="#/recipes/new">Add your first recipe</a></p>`;
}

async function planView() {
  const token = renderToken;
  const [, meals] = await Promise.all([
    ensureRecipes(),
    api.listMeals(dayKey(state.week), dayKey(addDays(state.week, 6))),
  ]);
  if (token !== renderToken) return;
  const today = dayKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(state.week, i));
  shell("plan", h`
    <div class="page-head">
      <h1>Meal plan</h1>
      <div class="week-nav">
        <button data-action="week" data-step="-7" aria-label="Previous week">‹</button>
        <strong>${weekLabel(state.week)}</strong>
        <button data-action="week" data-step="7" aria-label="Next week">›</button>
        <button data-action="week" data-step="0">This week</button>
        <button class="primary" data-action="build-list">Make grocery list</button>
      </div>
    </div>
    <div class="planner">
      <aside class="plan-recipes card" aria-label="Your recipes">
        <h2>Recipes</h2>
        <p class="hint">Drag one onto a day.</p>
        <input id="plan-search" type="search" placeholder="Search" aria-label="Search recipes">
        <div id="plan-recipes" class="plan-recipe-list">${planRecipes()}</div>
      </aside>
      <div class="days">
        ${days.map((d) => {
          const key = dayKey(d);
          const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
          const todays = meals.filter((m) => m.day === key)
            .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
          return h`
            <section class="day card ${key === today ? "today" : ""}">
              <h2>${d.toLocaleDateString(undefined, { weekday: "short" })} <small>${shortDate(d)}</small></h2>
              <div class="day-meals">
                ${todays.map(mealChip)}
                <button class="add" data-action="pick" data-day="${key}" aria-label="Add a meal on ${weekday}">+ Add</button>
              </div>
              <div class="drop-zones" aria-hidden="true">
                ${SLOTS.map((slot) => h`<div class="drop-zone" data-day="${key}" data-slot="${slot}">${slot}</div>`)}
              </div>
            </section>`;
        })}
      </div>
    </div>
    <dialog id="picker">
      <form method="dialog" class="picker-head">
        <h2 id="picker-title"></h2>
        <button class="x" aria-label="Close">×</button>
      </form>
      <div class="slot-choice" role="radiogroup" aria-label="Which meal">
        ${SLOTS.map((slot) => h`
          <label><input type="radio" name="picker-slot" value="${slot}" ${slot === "dinner" ? "checked" : ""}><span>${slot}</span></label>`)}
      </div>
      <input id="picker-search" type="search" placeholder="Search recipes" aria-label="Search recipes">
      <div id="picker-list" class="picker-list"></div>
    </dialog>`);
}

function pickerList(q = "") {
  const needle = q.trim().toLowerCase();
  const found = state.recipes.filter((r) => r.title.toLowerCase().includes(needle));
  document.getElementById("picker-list").innerHTML = (found.length
    ? h`${found.map((r) => h`<button data-action="choose" data-id="${r.id}">${r.title}</button>`)}`
    : state.recipes.length
      ? h`<p class="muted">No recipes match.</p>`
      : h`<p class="muted">No recipes yet. <a href="#/recipes/new">Add your first one</a>.</p>`).s;
}

function openPicker(day) {
  const dialog = document.getElementById("picker");
  dialog.dataset.day = day;
  const [y, m, d] = day.split("-").map(Number);
  document.getElementById("picker-title").textContent =
    new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  document.getElementById("picker-search").value = "";
  pickerList();
  dialog.showModal();
}

/* ---------- grocery list ---------- */

async function buildList(button) {
  await busy(button, async () => {
    const [meals, existing] = await Promise.all([
      api.listMeals(dayKey(state.week), dayKey(addDays(state.week, 6))),
      api.listGrocery(),
      ensureRecipes(),
    ]);
    const lines = meals.flatMap((m) => recipeById(m.recipe_id)?.ingredients ?? []);
    const built = buildGroceryLines(lines);
    if (!built.length) return toast(`No ingredients to add: ${meals.length ? "those recipes have none listed" : "no meals planned that week"}.`);

    // Keep ticks on anything already in the trolley; manual items stay as they are.
    const ticked = new Set(existing.filter((i) => i.checked).map((i) => ingredientKey(i.name)));
    const manual = new Set(existing.filter((i) => !i.from_plan).map((i) => ingredientKey(i.name)));
    const rows = built.filter((i) => !manual.has(ingredientKey(i.name))).map((i) => ({
      ...i, from_plan: true, checked: ticked.has(ingredientKey(i.name)),
    }));
    // Insert first so a failure leaves the old list intact.
    if (rows.length) await api.addGrocery(rows);
    const stale = existing.filter((i) => i.from_plan).map((i) => i.id);
    if (stale.length) await api.removeGrocery(stale);
    toast(`List built from ${meals.length} planned ${meals.length === 1 ? "meal" : "meals"}.`);
    go("#/grocery");
  });
}

async function groceryView() {
  const token = renderToken;
  const items = await api.listGrocery();
  if (token !== renderToken) return;
  const row = (i) => h`
    <li class="${i.checked ? "done" : ""}">
      <label>
        <input type="checkbox" data-action="tick" data-id="${i.id}" ${i.checked ? "checked" : ""}>
        <span class="item-name">${i.name}</span>
        ${i.amount ? h`<span class="item-amount">${i.amount}</span>` : ""}
      </label>
      <button class="x" data-action="remove-item" data-id="${i.id}" aria-label="Remove ${i.name}">×</button>
    </li>`;
  const todo = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);
  shell("grocery", h`
    <div class="page-head">
      <h1>Grocery list</h1>
      <div class="week-nav">
        ${done.length ? h`<button data-action="clear-checked">Clear ${done.length} checked</button>` : ""}
        <button data-action="week" data-step="-7" aria-label="Previous week">‹</button>
        <strong>${weekLabel(state.week)}</strong>
        <button data-action="week" data-step="7" aria-label="Next week">›</button>
        <button class="primary" data-action="build-list">${items.some((i) => i.from_plan) ? "Rebuild" : "Build"} from this week</button>
      </div>
    </div>
    <form class="inline add-item" id="item-form">
      <input name="name" required maxlength="200" placeholder="Add something else, like paper towels" aria-label="Add an item">
      <button type="submit">Add</button>
    </form>
    ${items.length ? h`
      <ul class="grocery card">${todo.map(row)}</ul>
      ${done.length ? h`<h2 class="done-head">In the trolley</h2><ul class="grocery card">${done.map(row)}</ul>` : ""}` : h`
      <div class="empty">
        <h2>Nothing to buy yet</h2>
        <p>Plan some meals, then build your list from the week.</p>
      </div>`}`);
}

/* ---------- profile ---------- */

function profileView() {
  const { email, new_email: pendingEmail } = state.session.user;
  shell("profile", h`
    <div class="page-head"><h1>Your profile</h1></div>
    <div class="profile">
      <form class="card" id="name-form">
        <h2>Your name</h2>
        <label>Shown in your greeting
          <input name="display_name" required maxlength="50" autocomplete="name" value="${state.profile?.display_name ?? ""}">
        </label>
        <button type="submit">Save name</button>
      </form>

      <form class="card" id="email-form">
        <h2>Email</h2>
        ${pendingEmail ? h`<p class="notice">Waiting for you to confirm ${pendingEmail}.</p>` : ""}
        <label>Email address
          <input name="email" type="email" required autocomplete="email" value="${email}">
        </label>
        <button type="submit">Change email</button>
      </form>

      <form class="card" id="password-form">
        <h2>Password</h2>
        <label>Current password
          <input name="current" type="password" required autocomplete="current-password">
        </label>
        <label>New password
          <input name="next" type="password" required minlength="8" autocomplete="new-password">
        </label>
        <label>New password again
          <input name="again" type="password" required minlength="8" autocomplete="new-password">
        </label>
        <button type="submit">Change password</button>
      </form>

      <section class="card">
        <h2>Your data</h2>
        <p class="muted">Download a copy of all your recipes as a file.</p>
        <button data-action="export-recipes">Download my recipes</button>
      </section>

      <section class="card">
        <h2>Signing out</h2>
        <p class="muted">Lost a device, or used a shared computer? Sign out everywhere to end every session.</p>
        <div class="actions">
          <button data-action="sign-out">Sign out</button>
          <button data-action="sign-out-all">Sign out everywhere</button>
        </div>
      </section>

      <form class="card danger-zone" id="delete-form">
        <h2>Delete account</h2>
        <p class="muted">This permanently deletes your account, recipes, meal plans and grocery list. It can't be undone.</p>
        <label>Password
          <input name="password" type="password" required autocomplete="current-password">
        </label>
        <label>Type DELETE to confirm
          <input name="confirm" required autocomplete="off">
        </label>
        <button class="danger" type="submit">Delete my account</button>
      </form>
    </div>`);
}

async function submitName(form) {
  const name = new FormData(form).get("display_name").trim();
  if (!name) return toast("Enter a name.");
  await busy(form.querySelector("[type=submit]"), async () => {
    state.profile = await api.saveProfile(state.session.user.id, name);
    toast("Name saved.");
    render();
  });
}

async function submitEmail(form) {
  const email = new FormData(form).get("email").trim();
  if (email.toLowerCase() === state.session.user.email.toLowerCase()) return toast("That's already your email.");
  await busy(form.querySelector("[type=submit]"), async () => {
    await api.changeEmail(email);
    toast("Check your email to confirm the change. It may need confirming at both addresses.");
  });
}

async function submitPassword(form) {
  const { current, next, again } = Object.fromEntries(new FormData(form));
  if (next !== again) return toast("The new passwords don't match.");
  if (next === current) return toast("Choose a password you aren't already using.");
  await busy(form.querySelector("[type=submit]"), async () => {
    await api.confirmPassword(state.session.user.email, current);
    await api.setPassword(next);
    form.reset();
    toast("Password changed.");
  });
}

async function submitDelete(form) {
  const { password, confirm: typed } = Object.fromEntries(new FormData(form));
  if (typed.trim() !== "DELETE") return toast("Type DELETE to confirm.");
  await busy(form.querySelector("[type=submit]"), async () => {
    await api.confirmPassword(state.session.user.email, password);
    await api.deleteAccount();
    await api.signOut();
    history.replaceState(null, "", location.pathname);
    toast("Your account has been deleted.");
  });
}

async function exportRecipes() {
  const recipes = await ensureRecipes();
  const file = new Blob([JSON.stringify(recipes, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = `foodme-recipes-${dayKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/* ---------- routing ---------- */

function notFound() {
  shell("recipes", h`<div class="empty"><h2>Recipe not found</h2><p><a href="#/recipes">Back to recipes</a></p></div>`);
}

const render = guarded(async () => {
  const token = ++renderToken;
  if (state.recovering) return authView("newpass");
  if (!state.session) return authView();
  await Promise.all([ensureProfile(), ensureBanner()]);
  const [, section, id, action] = location.hash.split("/");
  if (token !== renderToken) return;
  if (section === "profile") return profileView();
  if (section === "plan") return planView();
  if (section === "grocery") return groceryView();
  if (section === "recipes" && id === "new") return recipeForm();
  if (section === "recipes" && id && action === "edit") return recipeForm(id);
  if (section === "recipes" && id) return recipeDetail(id);
  return recipesView();
});

/* ---------- events ---------- */

const actions = {
  "auth-mode": (el) => authView(el.dataset.mode),
  "sign-out": () => api.signOut(),
  "sign-out-all": () => api.signOut("global"),
  "export-recipes": () => exportRecipes(),
  "toggle-motion": (el) => {
    const pause = !motionPaused();
    try {
      localStorage.setItem("foodme-motion", pause ? "off" : "on");
    } catch {
      return; // no storage, so the choice can't stick
    }
    document.getElementById("kinetic").classList.toggle("still", pause);
    el.textContent = pause ? "Play motion" : "Pause motion";
  },
  "enter-by-hand": (el) => {
    state.draft = { source_url: el.dataset.url };
    go("#/recipes/new");
  },
  "delete-recipe": async (el) => {
    if (!confirm("Delete this recipe? It will also leave your meal plan.")) return;
    await api.deleteRecipe(el.dataset.id);
    state.recipes = state.recipes.filter((r) => r.id !== el.dataset.id);
    go("#/recipes");
  },
  week: (el) => {
    const step = Number(el.dataset.step);
    state.week = step ? addDays(state.week, step) : startOfWeek(new Date());
    render();
  },
  pick: (el) => openPicker(el.dataset.day),
  choose: async (el) => {
    const dialog = document.getElementById("picker");
    const slot = dialog.querySelector("[name=picker-slot]:checked").value;
    await api.addMeal({ day: dialog.dataset.day, slot, recipe_id: el.dataset.id });
    dialog.close();
    render();
  },
  "remove-meal": async (el) => {
    await api.removeMeal(el.dataset.id);
    render();
  },
  "build-list": (el) => buildList(el),
  tick: async (el) => {
    try {
      await api.setChecked(el.dataset.id, el.checked);
    } catch (err) {
      el.checked = !el.checked;
      throw err;
    }
    render();
  },
  "remove-item": async (el) => {
    await api.removeGrocery([el.dataset.id]);
    render();
  },
  "clear-checked": async () => {
    const items = await api.listGrocery();
    await api.removeGrocery(items.filter((i) => i.checked).map((i) => i.id));
    render();
  },
};

const forms = {
  "auth-form": submitAuth,
  "import-form": submitImport,
  "recipe-form": submitRecipe,
  "name-form": submitName,
  "email-form": submitEmail,
  "password-form": submitPassword,
  "delete-form": submitDelete,
  "item-form": async (form) => {
    await api.addGrocery([{ name: form.name.value.trim() }]);
    render();
  },
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (el && el.dataset.action !== "tick") guarded(actions[el.dataset.action])(el);
  // Backdrop click closes the picker.
  if (e.target.id === "picker") e.target.close();
});
document.addEventListener("change", (e) => {
  if (e.target.dataset?.action === "tick") guarded(actions.tick)(e.target);
});
document.addEventListener("submit", (e) => {
  const handler = forms[e.target.id];
  if (!handler) return;
  e.preventDefault();
  guarded(handler)(e.target);
});
document.addEventListener("input", (e) => {
  if (e.target.id === "recipe-search") {
    state.query = e.target.value;
    showRecipeMatches();
  } else if (e.target.id === "picker-search") {
    pickerList(e.target.value);
  } else if (e.target.id === "plan-search") {
    document.getElementById("plan-recipes").innerHTML = planRecipes(e.target.value).s;
  }
});

/* Drag recipes onto the board, or move a meal already on it. Touch screens use the + Add button. */

let dragging = null;

function clearDragState() {
  dragging = null;
  document.querySelector(".planner")?.classList.remove("dragging");
  document.querySelector(".drop-zone.over")?.classList.remove("over");
}

const dropMeal = guarded(async ({ recipeId, mealId }, { day, slot }) => {
  if (mealId) await api.moveMeal(mealId, day, slot);
  else await api.addMeal({ day, slot, recipe_id: recipeId });
  render();
});

document.addEventListener("dragstart", (e) => {
  const el = e.target.closest?.("[data-drag-recipe], [data-meal]");
  if (!el) return;
  dragging = el.dataset.meal ? { mealId: el.dataset.meal } : { recipeId: el.dataset.dragRecipe };
  e.dataTransfer.effectAllowed = "copyMove";
  e.dataTransfer.setData("text/plain", el.textContent.trim());
  // Showing the drop zones during dragstart itself makes Chrome cancel the drag.
  setTimeout(() => document.querySelector(".planner")?.classList.add("dragging"));
});
document.addEventListener("dragover", (e) => {
  const zone = e.target.closest?.(".drop-zone");
  const current = document.querySelector(".drop-zone.over");
  if (current !== zone) current?.classList.remove("over");
  if (!zone || !dragging) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = dragging.mealId ? "move" : "copy";
  zone.classList.add("over");
});
document.addEventListener("drop", (e) => {
  const zone = e.target.closest?.(".drop-zone");
  if (!zone || !dragging) return;
  e.preventDefault();
  const item = dragging;
  clearDragState();
  dropMeal(item, zone.dataset);
});
document.addEventListener("dragend", clearDragState);
window.addEventListener("hashchange", () => {
  // A new blank form shouldn't inherit a leftover import.
  if (!location.hash.startsWith("#/recipes/new")) state.draft = null;
  render();
});

/* ---------- start ---------- */

if (!api.configured) {
  root.innerHTML = h`
    <main class="auth">
      <h1 class="auth-brand">FoodMe</h1>
      <div class="card auth-card">
        <h2>Almost there</h2>
        <p>Add your Supabase project details to <code>config.js</code>. The README walks through it.</p>
      </div>
    </main>`.s;
} else {
  // supabase-js can deadlock if it's called from inside this callback, so defer the work.
  api.sb.auth.onAuthStateChange((event, session) => {
    const wasUser = state.session?.user?.id;
    state.session = session;
    if (event === "PASSWORD_RECOVERY") state.recovering = true;
    if (session?.user?.id !== wasUser) {
      state.recipes = null;
      state.draft = null;
      state.profile = undefined;
    }
    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
    if (event === "SIGNED_IN" && wasUser === session?.user?.id) return; // tab refocus
    setTimeout(render, 0);
  });
}
