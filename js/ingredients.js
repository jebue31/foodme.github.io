// Turns free-text ingredient lines into a combined grocery list.

const FRACTIONS = { "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5", "⅙": "1/6", "⅚": "5/6", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8" };

// canonical unit -> spellings
const UNIT_NAMES = {
  tsp: ["tsp", "tsps", "teaspoon", "teaspoons"],
  tbsp: ["tbsp", "tbsps", "tbs", "tablespoon", "tablespoons"],
  cup: ["cup", "cups", "c"],
  pint: ["pint", "pints", "pt"],
  quart: ["quart", "quarts", "qt", "qts"],
  gallon: ["gallon", "gallons", "gal"],
  ml: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"],
  l: ["l", "liter", "liters", "litre", "litres"],
  oz: ["oz", "ounce", "ounces"],
  lb: ["lb", "lbs", "pound", "pounds"],
  g: ["g", "gram", "grams"],
  kg: ["kg", "kilogram", "kilograms"],
  clove: ["clove", "cloves"],
  can: ["can", "cans", "tin", "tins"],
  jar: ["jar", "jars"],
  package: ["package", "packages", "pkg", "pkgs", "packet", "packets"],
  stick: ["stick", "sticks"],
  bunch: ["bunch", "bunches"],
  head: ["head", "heads"],
  slice: ["slice", "slices"],
  sprig: ["sprig", "sprigs"],
  stalk: ["stalk", "stalks"],
  pinch: ["pinch", "pinches"],
  dash: ["dash", "dashes"],
};
const UNITS = new Map(Object.entries(UNIT_NAMES).flatMap(([unit, names]) => names.map((n) => [n, unit])));

// Convertible units, measured in a common base (tsp, or oz).
const VOLUME = { tsp: 1, tbsp: 3, cup: 48, pint: 96, quart: 192, gallon: 768, ml: 0.20288, l: 202.88 };
const WEIGHT = { oz: 1, lb: 16, g: 0.035274, kg: 35.274 };
const METRIC = new Set(["ml", "l", "g", "kg"]);

// Preparation words, dropped so "minced garlic" and "garlic" land on one line.
// Purchase descriptors ("boneless", "crushed tomatoes") are kept on purpose.
const PREP = /\b(finely|coarsely|roughly|thinly|freshly|chopped|diced|minced|sliced|peeled|large|medium|small)\b/gi;
const TRAILING = /\b(to taste|to serve|as needed|optional|for (garnish|serving|greasing|frying|the pan|dusting)|plus|or (more|to taste)|divided)\b.*$/i;

const NUM = String.raw`\d+(?:\.\d+)?(?:\s+\d+\/\d+|\/\d+)?`;
const QTY = new RegExp(String.raw`^(?:about\s+|approx\.?\s+)?(${NUM})(?:\s*(?:-|–|—|to)\s*(${NUM}))?\s*`, "i");

function toNumber(s) {
  return s.trim().split(/\s+/).reduce((sum, part) => {
    const [a, b] = part.split("/");
    return sum + (b ? Number(a) / Number(b) : Number(a));
  }, 0);
}

function singular(word) {
  if (/(ss|us|is)$/i.test(word) || word.length < 4) return word;
  if (/ies$/i.test(word)) return word.slice(0, -3) + "y";
  if (/leaves$/i.test(word)) return word.slice(0, -3) + "f";
  if (/(oes|ches|shes|xes)$/i.test(word)) return word.slice(0, -2);
  return word.replace(/s$/i, "");
}

export function ingredientKey(name) {
  const words = name.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().split(/\s+/);
  words[words.length - 1] = singular(words[words.length - 1]);
  return words.join(" ");
}

// "1 1/2 cups flour, sifted" -> { qty: 1.5, unit: "cup", name: "flour" }
export function parseIngredient(line) {
  let s = line.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (c) => ` ${FRACTIONS[c]} `)
    .replace(/^[\s\-–—*•·]+/, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s.endsWith(":")) return null;

  let qty = null;
  const q = QTY.exec(s);
  if (q) {
    qty = toNumber(q[2] ?? q[1]); // for a range, buy enough for the top end
    s = s.slice(q[0].length);
  }

  let unit = null;
  const word = /^([a-z]+)\.?(?:\s+|$)/i.exec(s);
  if (word) {
    // T / t are tablespoon / teaspoon in older recipes; case matters only here.
    const found = word[1] === "T" ? "tbsp" : word[1] === "t" ? "tsp" : UNITS.get(word[1].toLowerCase());
    // A unit needs something after it ("cloves" alone is the spice), and a
    // one-letter unit needs a number before it.
    if (found && s.length > word[0].length && (qty !== null || word[1].length > 1)) {
      unit = found;
      s = s.slice(word[0].length);
    }
  }

  const name = s.replace(/^of\s+/i, "")
    .replace(/[*†‡]/g, "")
    .replace(/\b(boneless|skinless|skin-on|bone-in),\s*/gi, "$1 ") // "boneless, skinless chicken" is one thing
    .split(",")[0]
    .replace(TRAILING, "")
    .replace(PREP, " ")
    .replace(/\s+/g, " ")
    .replace(/^(and|or|of)\s+|\s+(and|or)$/gi, "")
    .trim();
  return name ? { qty, unit, name } : null;
}

export function formatQty(n) {
  const whole = Math.floor(n + 0.02);
  const rest = n - whole;
  if (rest < 0.02) return String(whole);
  const frac = [[1 / 8, "1/8"], [1 / 4, "1/4"], [1 / 3, "1/3"], [3 / 8, "3/8"], [1 / 2, "1/2"], [5 / 8, "5/8"], [2 / 3, "2/3"], [3 / 4, "3/4"], [7 / 8, "7/8"]]
    .find(([v]) => Math.abs(rest - v) < 0.03);
  if (frac) return whole ? `${whole} ${frac[1]}` : frac[1];
  return String(Math.round(n * 100) / 100);
}

function formatVolume(tsp, metric) {
  if (metric) {
    const ml = tsp / VOLUME.ml;
    return ml >= 1000 ? `${formatQty(ml / 1000)} l` : `${Math.round(ml)} ml`;
  }
  if (tsp < 3) return `${formatQty(tsp)} tsp`;
  if (tsp < 12) return `${formatQty(tsp / 3)} tbsp`;
  const cups = tsp / 48;
  return `${formatQty(cups)} ${cups > 1 ? "cups" : "cup"}`;
}

function formatWeight(oz, metric) {
  if (metric) {
    const g = oz / WEIGHT.g;
    return g >= 1000 ? `${formatQty(g / 1000)} kg` : `${Math.round(g)} g`;
  }
  return oz >= 16 ? `${formatQty(oz / 16)} lb` : `${formatQty(oz)} oz`;
}

function formatOther(qty, unit) {
  const label = qty > 1 ? UNIT_NAMES[unit][1] : UNIT_NAMES[unit][0];
  return `${formatQty(qty)} ${label}`;
}

// Takes ingredient lines from every planned meal; returns [{ name, amount }] sorted by name.
export function buildGroceryLines(lines) {
  const items = new Map();
  for (const line of lines) {
    const parsed = parseIngredient(line);
    if (!parsed) continue;
    const key = ingredientKey(parsed.name);
    const item = items.get(key) ?? { name: parsed.name, volume: 0, weight: 0, metricV: true, metricW: true, counts: new Map() };
    if (parsed.name.length > item.name.length) item.name = parsed.name; // prefer "eggs" over "egg"
    items.set(key, item);

    if (parsed.qty === null) continue;
    const { qty, unit } = parsed;
    if (unit in VOLUME) {
      item.volume += qty * VOLUME[unit];
      item.metricV &&= METRIC.has(unit);
    } else if (unit in WEIGHT) {
      item.weight += qty * WEIGHT[unit];
      item.metricW &&= METRIC.has(unit);
    } else {
      item.counts.set(unit, (item.counts.get(unit) ?? 0) + qty);
    }
  }

  return [...items.values()].map((item) => {
    const parts = [];
    for (const [unit, qty] of item.counts) parts.push(unit ? formatOther(qty, unit) : formatQty(qty));
    if (item.weight) parts.push(formatWeight(item.weight, item.metricW));
    if (item.volume) parts.push(formatVolume(item.volume, item.metricV));
    return { name: item.name[0].toUpperCase() + item.name.slice(1), amount: parts.join(" + ") };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
