// Supabase Edge Function: fetches a recipe page and returns its schema.org Recipe data.
// Browsers can't read other sites directly (CORS), so this runs server-side.
// Written as plain JS so test/tests.html can load the parser in a browser.

const MAX_BYTES = 4_000_000;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

class UserError extends Error {}

/* ---------- parsing ---------- */

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  frac12: "½", frac14: "¼", frac34: "¾", deg: "°", eacute: "é", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", hellip: "…",
};

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (whole, code) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
    const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  });
}

export function clean(v) {
  if (v == null) return "";
  // Decode first: some sites double-escape tags inside JSON-LD. Output is always
  // escaped again when the app renders it, so this is tidying, not sanitising.
  return decodeEntities(decodeEntities(String(v)))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasRecipeType(node) {
  const t = node?.["@type"];
  return (Array.isArray(t) ? t : [t]).some((x) => typeof x === "string" && /(^|[/:])recipe$/i.test(x));
}

function findRecipe(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 8) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findRecipe(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (hasRecipeType(node)) return node;
  return findRecipe(node["@graph"], depth + 1) ?? findRecipe(node.mainEntity, depth + 1) ??
    findRecipe(node.mainEntityOfPage, depth + 1);
}

function parseSteps(v) {
  if (!v) return [];
  if (typeof v === "string") {
    return decodeEntities(v).split(/<\/(?:p|li)>|<br\s*\/?>|\r?\n+/i).map(clean).filter(Boolean);
  }
  if (Array.isArray(v)) return v.flatMap(parseSteps);
  if (typeof v === "object") {
    if (v.itemListElement) return parseSteps(v.itemListElement);
    return parseSteps(v.text ?? v.name);
  }
  return [];
}

export function isoMinutes(v) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/i.exec(String(v ?? ""));
  if (!m || !(m[1] || m[2] || m[3])) return null;
  return Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function parseImage(v) {
  const first = Array.isArray(v) ? v[0] : v;
  const url = typeof first === "string" ? first : first?.url;
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
}

function parseServings(v) {
  const first = Array.isArray(v) ? v[0] : v;
  const m = /\d+/.exec(String(first ?? ""));
  const n = m ? Number(m[0]) : 0;
  return n > 0 ? n : null;
}

// The recipe card has room for 100 characters: the first sentence if it fits, otherwise a trimmed start.
export function shortBlurb(v) {
  const text = clean(v);
  if (text.length <= 100) return text;
  const sentence = /^.+?[.!?](?=\s)/.exec(text)?.[0];
  if (sentence && sentence.length <= 100) return sentence;
  return `${text.slice(0, 99).replace(/\s+\S*$/, "")}…`;
}

export function extractRecipe(html) {
  const scripts = html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of scripts) {
    let data;
    try {
      data = JSON.parse(body.trim().replace(/^<!\[CDATA\[|\]\]>$/g, ""));
    } catch {
      continue;
    }
    const r = findRecipe(data);
    if (!r) continue;
    const ingredients = [r.recipeIngredient ?? r.ingredients ?? []].flat().map(clean).filter(Boolean);
    const title = clean(r.name ?? r.headline);
    if (!title) continue;
    return {
      title,
      blurb: shortBlurb(r.description),
      servings: parseServings(r.recipeYield),
      minutes: isoMinutes(r.totalTime) ??
        (((isoMinutes(r.prepTime) ?? 0) + (isoMinutes(r.cookTime) ?? 0)) || null),
      ingredients,
      steps: parseSteps(r.recipeInstructions).join("\n"),
      image_url: parseImage(r.image),
    };
  }
  return null;
}

/* ---------- fetching ---------- */

// Stops the function being used to probe private networks. Hostnames that resolve
// to private addresses aren't caught here; the function has nothing internal to reach.
export function safeUrl(input, base) {
  let url;
  try {
    url = new URL(input, base);
  } catch {
    throw new UserError("That doesn't look like a web address.");
  }
  const host = url.hostname.toLowerCase().replace(/\.+$/, ""); // "localhost." is still localhost
  const blocked = !/^https?:$/.test(url.protocol) || url.username || url.password ||
    (url.port && !["80", "443"].includes(url.port)) ||
    host.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(host) || !host.includes(".") ||
    /\.(local|localhost|internal|intranet|lan|home|corp)$/.test(host);
  if (blocked) throw new UserError("That address can't be imported.");
  return url;
}

// Uses the charset the site declares, in its header or its page head. Most pages are UTF-8.
export function decodePage(bytes, contentType = "") {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const declared = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(declared).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes); // a label the decoder doesn't know
  }
}

async function readLimited(res) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new UserError("That page is too large to import.");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  return decodePage(all, res.headers.get("content-type") ?? "");
}

async function fetchPage(input) {
  let url = safeUrl(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FoodMeRecipeImporter/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel();
      url = safeUrl(res.headers.get("location"), url);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new UserError(
        res.status === 401 || res.status === 403
          ? "That site blocks automatic imports."
          : `That site answered with an error (${res.status}).`,
      );
    }
    return { html: await readLimited(res), finalUrl: url.href };
  }
  throw new UserError("That page redirects too many times.");
}

// The public anon key also passes the platform's JWT check, so confirm a real user.
async function isSignedIn(req) {
  const auth = req.headers.get("authorization");
  const apikey = Deno.env.get("SUPABASE_ANON_KEY") ?? req.headers.get("apikey");
  if (!auth || !apikey) return false;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { Authorization: auth, apikey },
  });
  await res.body?.cancel();
  return res.ok;
}

async function handle(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    if (!(await isSignedIn(req))) return json({ error: "Please sign in again." }, 401);
    const { url } = await req.json().catch(() => ({}));
    if (typeof url !== "string" || !url.trim()) throw new UserError("Enter a web address.");
    const { html, finalUrl } = await fetchPage(url.trim());
    const recipe = extractRecipe(html);
    if (!recipe) throw new UserError("Couldn't find a recipe on that page.");
    return json({ ...recipe, source_url: finalUrl });
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, 422);
    if (err?.name === "TimeoutError") return json({ error: "That site took too long to respond." }, 422);
    console.error(err);
    return json({ error: "Couldn't load that page." }, 422);
  }
}

if (globalThis.Deno) Deno.serve(handle);
