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

/* ---------- shell ---------- */

function shell(active, content) {
  const tab = (href, id, label) =>
    h`<a href="${href}" class="tab" ${id === active ? h`aria-current="page"` : ""}>${label}</a>`;
  root.innerHTML = h`
    <header class="topbar">
      <a class="brand" href="#/recipes">FoodMe</a>
      <nav class="tabs" aria-label="Main">
        ${tab("#/recipes", "recipes", "Recipes")}
        ${tab("#/plan", "plan", "Plan")}
        ${tab("#/grocery", "grocery", "Grocery")}
      </nav>
      <button class="link signout" data-action="sign-out">Sign out</button>
    </header>
    <main class="page">${content}</main>`.s;
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

function recipeCards(recipes) {
  return recipes.map((r) => {
    const meta = [r.minutes ? `${r.minutes} min` : null, r.servings ? `serves ${r.servings}` : null].filter(Boolean).join(" · ");
    const image = safeHttpUrl(r.image_url);
    return h`
      <a class="recipe-card" href="#/recipes/${r.id}">
        ${image ? h`<img src="${image}" alt="" loading="lazy" referrerpolicy="no-referrer">` : h`<span class="recipe-mark" aria-hidden="true">${r.title[0].toUpperCase()}</span>`}
        <span class="recipe-text">
          <strong>${r.title}</strong>
          <small>${meta || `${r.ingredients.length} ingredients`}</small>
        </span>
      </a>`;
  });
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
    <article class="recipe">
      ${image ? h`<img class="hero" src="${image}" alt="" referrerpolicy="no-referrer">` : ""}
      <div class="page-head">
        <h1>${r.title}</h1>
        <div class="actions">
          <a class="button" href="#/recipes/${r.id}/edit">Edit</a>
          <button class="danger" data-action="delete-recipe" data-id="${r.id}">Delete</button>
        </div>
      </div>
      ${meta ? h`<p class="muted">${meta}</p>` : ""}
      ${source ? h`<p><a href="${source}" target="_blank" rel="noopener noreferrer nofollow">View original</a></p>` : ""}
      <div class="recipe-columns">
        <section>
          <h2>Ingredients</h2>
          ${r.ingredients.length ? h`<ul>${r.ingredients.map((i) => h`<li>${i}</li>`)}</ul>` : h`<p class="muted">None listed.</p>`}
        </section>
        <section>
          <h2>Method</h2>
          ${steps.length ? h`<ol>${steps.map((s) => h`<li>${s}</li>`)}</ol>` : h`<p class="muted">None listed.</p>`}
        </section>
      </div>
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
      <button class="primary" data-action="build-list">Make grocery list</button>
    </div>
    <div class="week-nav">
      <button data-action="week" data-step="-7" aria-label="Previous week">‹</button>
      <strong>${weekLabel(state.week)}</strong>
      <button data-action="week" data-step="7" aria-label="Next week">›</button>
      <button class="link" data-action="week" data-step="0">This week</button>
    </div>
    <div class="days">
      ${days.map((d) => {
        const key = dayKey(d);
        return h`
          <section class="day card ${key === today ? "today" : ""}">
            <h2>${d.toLocaleDateString(undefined, { weekday: "long" })} <small>${shortDate(d)}</small></h2>
            ${SLOTS.map((slot) => h`
              <div class="slot">
                <span class="slot-name">${slot}</span>
                <div class="slot-meals">
                  ${meals.filter((m) => m.day === key && m.slot === slot).map((m) => h`
                    <span class="meal">
                      <a href="#/recipes/${m.recipe_id}">${recipeById(m.recipe_id)?.title ?? "Recipe"}</a>
                      <button class="x" data-action="remove-meal" data-id="${m.id}" aria-label="Remove from ${slot}">×</button>
                    </span>`)}
                  <button class="add" data-action="pick" data-day="${key}" data-slot="${slot}"
                    aria-label="Add ${slot} on ${d.toLocaleDateString(undefined, { weekday: "long" })}">+</button>
                </div>
              </div>`)}
          </section>`;
      })}
    </div>
    <dialog id="picker">
      <form method="dialog" class="picker-head">
        <h2 id="picker-title"></h2>
        <button class="x" aria-label="Close">×</button>
      </form>
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

function openPicker(day, slot) {
  const dialog = document.getElementById("picker");
  dialog.dataset.day = day;
  dialog.dataset.slot = slot;
  const [y, m, d] = day.split("-").map(Number);
  const when = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long" });
  document.getElementById("picker-title").textContent = `${when} ${slot}`;
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
      ${done.length ? h`<button data-action="clear-checked">Clear ${done.length} checked</button>` : ""}
    </div>
    <div class="week-nav">
      <button data-action="week" data-step="-7" aria-label="Previous week">‹</button>
      <strong>${weekLabel(state.week)}</strong>
      <button data-action="week" data-step="7" aria-label="Next week">›</button>
      <button class="primary" data-action="build-list">${items.some((i) => i.from_plan) ? "Rebuild" : "Build"} from this week</button>
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

/* ---------- routing ---------- */

function notFound() {
  shell("recipes", h`<div class="empty"><h2>Recipe not found</h2><p><a href="#/recipes">Back to recipes</a></p></div>`);
}

const render = guarded(async () => {
  const token = ++renderToken;
  if (state.recovering) return authView("newpass");
  if (!state.session) return authView();
  const [, section, id, action] = location.hash.split("/");
  if (token !== renderToken) return;
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
  pick: (el) => openPicker(el.dataset.day, el.dataset.slot),
  choose: async (el) => {
    const dialog = document.getElementById("picker");
    await api.addMeal({ day: dialog.dataset.day, slot: dialog.dataset.slot, recipe_id: el.dataset.id });
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
  }
});
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
    }
    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
    if (event === "SIGNED_IN" && wasUser === session?.user?.id) return; // tab refocus
    setTimeout(render, 0);
  });
}
