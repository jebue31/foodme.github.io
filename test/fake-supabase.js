// In-browser stand-in for supabase-js, for UI testing only. Data lives in localStorage.
(() => {
  const load = () => JSON.parse(localStorage.getItem("fake") ?? '{"users":{},"recipes":[],"meal_plan":[],"grocery_items":[]}');
  const save = (db) => localStorage.setItem("fake", JSON.stringify(db));
  const uid = () => crypto.randomUUID();
  const listeners = [];

  // First visit in a browser: create a made-up demo user with sample recipes and sign in.
  // After signing out, use the email and password below. They only exist in this fake backend.
  if (!localStorage.getItem("fake-demo")) {
    const email = "demo@foodme.test";
    const user_id = uid();
    const db = load();
    const recipe = (title, minutes, servings, ingredients, steps) => ({
      id: uid(), user_id, title, minutes, servings, ingredients, steps: steps.join("\n"),
      image_url: null, source_url: "https://example.com/recipe", created_at: new Date().toISOString(),
    });
    const recipes = [
      recipe("Tomato soup", 35, 4,
        ["2 tbsp olive oil", "1 onion, diced", "2 cloves garlic", "800 g tinned tomatoes", "500 ml stock", "1 tsp sugar", "Salt and pepper", "Basil to serve"],
        ["Soften the onion in the oil over a low heat for ten minutes.", "Add the garlic and cook for a minute.", "Add the tomatoes, stock and sugar, and simmer for twenty minutes.", "Blend until smooth and season to taste.", "Serve topped with torn basil."]),
      recipe("Green salad", 15, 2,
        ["1 head lettuce", "1 cucumber", "2 tbsp vinaigrette"],
        ["Wash and tear the lettuce.", "Slice the cucumber.", "Toss with the vinaigrette."]),
      recipe("Sheet pan pizza with roasted peppers", 50, 6,
        ["500 g pizza dough", "1 cup tomato sauce", "200 g mozzarella", "2 red peppers", "1 red onion, sliced"],
        ["Stretch the dough onto an oiled tray.", "Top with the sauce, cheese and vegetables.", "Bake at 230 C for twenty minutes."]),
      recipe("Lentil curry", 40, 4,
        ["1 cup red lentils", "1 onion, diced", "2 tbsp curry paste", "400 ml coconut milk", "2 cups stock", "1 lime", "Rice to serve"],
        ["Fry the onion and curry paste for five minutes.", "Add the lentils, coconut milk and stock.", "Simmer for twenty-five minutes, stirring now and then.", "Finish with lime juice and serve over rice."]),
      recipe("Blueberry pancakes", 20, 3,
        ["1.5 cups flour", "1 tbsp baking powder", "1 egg", "1.25 cups milk", "1 cup blueberries"],
        ["Whisk everything except the blueberries into a smooth batter.", "Fold in the blueberries.", "Fry small ladlefuls until golden on both sides."]),
    ];
    const when = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const meal = (offset, slot, r) => ({ id: uid(), user_id, day: when(offset), slot, recipe_id: r.id, created_at: new Date().toISOString() });
    db.users[email] = { id: user_id, password: "demo-password" };
    db.recipes.push(...recipes);
    db.meal_plan.push(meal(0, "dinner", recipes[0]), meal(1, "dinner", recipes[3]), meal(1, "breakfast", recipes[4]));
    save(db);
    localStorage.setItem("fake-session", JSON.stringify({ user: { id: user_id, email } }));
    localStorage.setItem("fake-demo", "1");
  }
  const getSession = () => JSON.parse(localStorage.getItem("fake-session") ?? "null");
  const emit = (event, session) => listeners.forEach((f) => f(event, session));
  const setSession = (event, s) => {
    localStorage.setItem("fake-session", JSON.stringify(s));
    emit(event, s);
  };

  class Query {
    constructor(table) { Object.assign(this, { table, op: "select", filters: [], payload: null, one: false, sort: null }); }
    select() { return this; }
    insert(p) { this.op = "insert"; this.payload = [p].flat(); return this; }
    update(p) { this.op = "update"; this.payload = { ...p, updated_at: new Date().toISOString() }; return this; }
    delete() { this.op = "delete"; return this; }
    eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
    gte(k, v) { this.filters.push((r) => r[k] >= v); return this; }
    lte(k, v) { this.filters.push((r) => r[k] <= v); return this; }
    in(k, v) { this.filters.push((r) => v.includes(r[k])); return this; }
    order(k) { this.sort = k; return this; }
    single() { this.one = true; return this; }
    maybeSingle() { this.one = true; return this; }
    upsert(p) { this.op = "upsert"; this.payload = p; return this; }
    then(ok, fail) { return Promise.resolve().then(() => this.run()).then(ok, fail); }
    run() {
      const session = getSession();
      if (window.fakeFail) return { data: null, error: { message: window.fakeFail } };
      if (!session) return { data: null, error: { message: "not signed in" } };
      const user_id = session.user.id;
      const db = load();
      db[this.table] ??= [];
      if (window.fakeMissing === this.table) return { data: null, error: { message: "table missing" } };
      const mine = (r) => (r.user_id ?? r.id) === user_id && this.filters.every((f) => f(r));
      let rows;
      if (this.op === "upsert") {
        db[this.table] = db[this.table].filter((r) => r.id !== this.payload.id);
        db[this.table].push(this.payload);
        rows = [this.payload];
      } else if (this.op === "insert") {
        const defaults = this.table === "grocery_items" ? { checked: false, from_plan: false, amount: "" } : {};
        rows = this.payload.map((p) => ({ id: uid(), user_id, created_at: new Date().toISOString(), ...defaults, ...p }));
        db[this.table].push(...rows);
      } else if (this.op === "update") {
        rows = db[this.table].filter(mine);
        rows.forEach((r) => Object.assign(r, this.payload));
      } else if (this.op === "delete") {
        const gone = new Set(db[this.table].filter(mine).map((r) => r.id));
        db[this.table] = db[this.table].filter((r) => !gone.has(r.id));
        if (this.table === "recipes") db.meal_plan = db.meal_plan.filter((m) => !gone.has(m.recipe_id));
        rows = [];
      } else {
        rows = db[this.table].filter(mine);
        if (this.sort) rows.sort((a, b) => String(a[this.sort]).localeCompare(String(b[this.sort])));
      }
      save(db);
      return { data: this.one ? rows[0] ?? null : rows, error: null };
    }
  }

  window.supabase = {
    createClient: () => ({
      auth: {
        onAuthStateChange(fn) {
          listeners.push(fn);
          setTimeout(() => fn("INITIAL_SESSION", getSession()), 0);
          return { data: { subscription: { unsubscribe() {} } } };
        },
        async signInWithPassword({ email, password }) {
          const db = load();
          if (db.users[email]?.password !== password) return { data: {}, error: { message: "Invalid login credentials" } };
          const session = { user: { id: db.users[email].id, email } };
          setSession("SIGNED_IN", session);
          return { data: { session }, error: null };
        },
        async signUp({ email, password }) {
          const db = load();
          db.users[email] = { id: uid(), password };
          save(db);
          const session = { user: { id: db.users[email].id, email } };
          setSession("SIGNED_IN", session);
          return { data: { session }, error: null };
        },
        async resetPasswordForEmail() { return { data: {}, error: null }; },
        async updateUser(attrs) {
          const db = load();
          const session = getSession();
          if (attrs.password) db.users[session.user.email].password = attrs.password;
          if (attrs.email) session.user.new_email = attrs.email;
          save(db);
          localStorage.setItem("fake-session", JSON.stringify(session));
          window.fakeUpdates = [...(window.fakeUpdates ?? []), attrs];
          emit("USER_UPDATED", session);
          return { data: { user: session.user }, error: null };
        },
        async signOut(opts) {
          window.fakeSignOutScope = opts?.scope;
          setSession("SIGNED_OUT", null);
          return { error: null };
        },
      },
      async rpc(name) {
        const db = load();
        const { id, email } = getSession().user;
        if (name === "delete_my_account") {
          delete db.users[email];
          for (const t of ["recipes", "meal_plan", "grocery_items"]) db[t] = db[t].filter((r) => r.user_id !== id);
          db.profiles = (db.profiles ?? []).filter((r) => r.id !== id);
          save(db);
        }
        return { data: null, error: null };
      },
      from: (t) => new Query(t),
      functions: {
        async invoke(name, { body }) {
          if (/fail/.test(body.url)) {
            const context = new Response(JSON.stringify({ error: "That site blocks automatic imports." }));
            return { data: null, error: { context } };
          }
          return { data: {
            title: "Imported <b>Soup</b>", blurb: "A quick lentil soup.", servings: 4, minutes: 35,
            ingredients: ["2 carrots", "1 cup lentils"], steps: "Chop.\nSimmer.",
            image_url: null, source_url: body.url,
          }, error: null };
        },
      },
    }),
  };
})();
