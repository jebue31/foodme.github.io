// All Supabase access lives here.

const cfg = window.FOODME_CONFIG ?? {};
export const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
export const sb = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

const appUrl = () => location.origin + location.pathname;

export const signIn = async (email, password) =>
  unwrap(await sb.auth.signInWithPassword({ email, password }));
export const signUp = async (email, password) =>
  unwrap(await sb.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } }));
export const sendReset = async (email) =>
  unwrap(await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() }));
export const setPassword = async (password) => unwrap(await sb.auth.updateUser({ password }));
export const signOut = async (scope = "local") => unwrap(await sb.auth.signOut({ scope }));

// Supabase has no "check password" call, so confirm it by signing in again.
export async function confirmPassword(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error("That password isn't correct.");
}
export const changeEmail = async (email) =>
  unwrap(await sb.auth.updateUser({ email }, { emailRedirectTo: appUrl() }));
export const deleteAccount = async () => unwrap(await sb.rpc("delete_my_account"));

export const getProfile = async () =>
  unwrap(await sb.from("profiles").select("*").maybeSingle());
export const saveProfile = async (id, display_name) =>
  unwrap(await sb.from("profiles").upsert({ id, display_name }).select().single());

export const listRecipes = async () =>
  unwrap(await sb.from("recipes").select("*").order("title"));
export const createRecipe = async (recipe) =>
  unwrap(await sb.from("recipes").insert(recipe).select().single());
export const updateRecipe = async (id, recipe) =>
  unwrap(await sb.from("recipes").update(recipe).eq("id", id).select().single());
export const deleteRecipe = async (id) =>
  unwrap(await sb.from("recipes").delete().eq("id", id));

export const listMeals = async (from, to) =>
  unwrap(await sb.from("meal_plan").select("*").gte("day", from).lte("day", to).order("created_at"));
export const addMeal = async (meal) =>
  unwrap(await sb.from("meal_plan").insert(meal).select().single());
export const moveMeal = async (id, day, slot) =>
  unwrap(await sb.from("meal_plan").update({ day, slot }).eq("id", id));
export const removeMeal = async (id) =>
  unwrap(await sb.from("meal_plan").delete().eq("id", id));

export const listGrocery = async () =>
  unwrap(await sb.from("grocery_items").select("*").order("name"));
export const addGrocery = async (items) =>
  unwrap(await sb.from("grocery_items").insert(items).select());
export const setChecked = async (id, checked) =>
  unwrap(await sb.from("grocery_items").update({ checked }).eq("id", id));
export const removeGrocery = async (ids) =>
  unwrap(await sb.from("grocery_items").delete().in("id", ids));

export async function importRecipe(url) {
  const { data, error } = await sb.functions.invoke("import-recipe", { body: { url } });
  if (!error) return data;
  // The function reports problems as JSON; surface its message when there is one.
  const body = await error.context?.json?.().catch(() => null);
  throw new Error(body?.error ?? "The import service isn't reachable. Is the function deployed?");
}
