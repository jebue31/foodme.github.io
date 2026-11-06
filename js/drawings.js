/* Line drawings for recipes with no photo. All are drawn on a 64 by 64 grid.
   The first matching row wins, so dishes come before main ingredients:
   "Chicken soup" is soup and "Fish tacos" are tacos. Cake sits below seafood and rice so
   crab cakes and rice cakes stay savoury. */

const BOWL = `<path d="M8 36H56C56 47 47 54 41 54H23C17 54 8 47 8 36Z"/><path d="M24 59H40"/>`;

const PLATE = `<circle cx="32" cy="32" r="17"/><circle cx="32" cy="32" r="10"/><path d="M6 12V52M3 12V21C3 25 9 25 9 21V12"/><path d="M58 52V12C53 16 53 28 58 31"/>`;

const DRAWINGS = [
  [/\b(pancake|waffle|crepe|french toast)/i, `<path d="M10 28H54C58 28 58 36 54 36H10C6 36 6 28 10 28Z"/><path d="M10 36C6 36 6 44 10 44H54C58 44 58 36 54 36"/><path d="M10 44C6 44 6 52 10 52H54C58 52 58 44 54 44"/><path d="M25 28V21H39V28"/><path d="M4 58H60"/>`],
  [/\b(muffin|cupcake)/i, `<path d="M16 36 21 57H43L48 36"/><path d="M26 37l2 20M32 37v20M38 37l-2 20"/><path d="M12 36c-5 0-7-7-3-10-1-7 6-11 12-10 3-7 19-7 22 0 6-1 13 3 12 10 4 3 2 10-3 10Z"/><circle cx="24" cy="26" r="2"/><circle cx="36" cy="22" r="2"/><circle cx="44" cy="29" r="2"/>`],
  [/\b(cookie|biscuit|brownie|shortbread)/i, `<circle cx="32" cy="32" r="25"/><circle cx="23" cy="24" r="2.5"/><circle cx="39" cy="20" r="2"/><circle cx="45" cy="36" r="2.5"/><circle cx="28" cy="43" r="2.5"/><circle cx="34" cy="31" r="1.5"/>`],
  [/\b(ice cream|gelato|sundae|sorbet)/i, `<path d="M20 28 32 60 44 28Z"/><path d="M16 28C12 6 52 6 48 28Z"/>`],
  [/\b(pies?|tarts?|quiches?|crumbles?|cobblers?)\b/i, `<path d="M6 34H58L52 52H12Z"/><path d="M10 34C14 18 50 18 54 34"/><path d="M25 26l4 3M35 29l4-3"/>`],
  [/\b(pizza|flatbread)/i, `<path d="M10 12C24 6 40 6 54 12L32 58Z"/><path d="M14 20C26 15 38 15 50 20"/><circle cx="26" cy="27" r="3.5"/><circle cx="38" cy="29" r="3"/><circle cx="32" cy="41" r="3"/>`],
  [/burgers?\b|\bsliders?\b/i, `<path d="M8 28C8 12 56 12 56 28Z"/><path d="M24 20h3M34 18h3M42 22h3"/><path d="M6 35c6 5 10-3 16 1s10-3 16 1 10-3 20-1"/><path d="M8 42H56"/><path d="M10 48H54V50C54 54 50 56 46 56H18C14 56 10 54 10 50Z"/>`],
  [/\b(tacos?|burritos?|quesadillas?|enchiladas?|fajitas?)\b/i, `<path d="M6 48C6 30 18 20 32 20S58 30 58 48Z"/><path d="M13 48C13 36 22 28 32 28"/><path d="M12 25c3-7 9-7 12-10 4-4 12-4 16 0 3 3 9 3 12 10"/>`],
  [/\b(spaghetti|pasta|lasagn|macaroni|mac and cheese|fettuccine|penne|linguine|carbonara|tortellini|ravioli|gnocchi)/i, `${BOWL}<path d="M14 36C13 22 24 17 32 17S51 22 50 36"/><path d="M20 36C20 27 29 25 32 30S42 33 44 36"/><path d="M23 23C29 28 35 19 42 25"/><circle cx="32" cy="12" r="5"/><path d="M58 5 44 24"/>`],
  [/\b(soups?|stews?|chowders?|broths?|bisques?)\b|\bchil+i( con carne)?$/i, `${BOWL}<path d="M22 28c-4-4 4-7 0-12M32 28c-4-4 4-7 0-12M42 28c-4-4 4-7 0-12"/>`],
  [/\bsalads?\b|slaw\b/i, `${BOWL}<path d="M16 36C12 26 18 20 24 20 26 26 24 32 20 36"/><path d="M28 36C26 22 34 14 40 14 44 22 40 32 36 36"/><path d="M44 36C44 28 50 24 56 24 56 30 52 34 48 36"/>`],
  [/\b(rice|curry|curries|stir.?fr(y|ies|ied)|risottos?|noodles?|ramen|pho|poke|bowls?)\b/i, `${BOWL}<path d="M12 36C14 22 50 22 52 36"/><path d="M42 5 30 26M52 7 36 26"/>`],
  [/\b(sandwich(es)?|wraps?|subs?|toast|breads?|buns?|loaf|loaves|bagels?|rolls?)\b/i, `<path d="M12 24C4 24 4 10 16 10H48C60 10 60 24 52 24V54H12Z"/><path d="M22 34H42M22 43H42"/>`],
  [/\b(eggs?|omelet(te)?s?|frittatas?)\b/i, `<path d="M32 6C44 6 52 28 52 40 52 52 42 58 32 58S12 52 12 40C12 28 20 6 32 6Z"/><path d="M21 42C21 47 25 50 29 50"/>`],
  [/\b(fish|fishcakes?|salmon|tuna|cod|trout|halibut|shrimps?|prawns?|seafood|crabs?|lobsters?|scallops?)\b/i, `<path d="M6 32C16 18 36 16 48 32 36 48 16 46 6 32Z"/><path d="M48 32 60 20V44Z"/><circle cx="17" cy="29" r="2"/><path d="M26 24c4 5 4 11 0 16"/>`],
  [/\b(potato|corn) cakes?\b/i, PLATE],
  [/\b(cheesecakes?|cakes?|tortes?)\b/i, `<path d="M6 56H58"/><path d="M13 56V33H51V56"/><path d="M13 40q4.75 6 9.5 0t9.5 0 9.5 0 9.5 0"/><path d="M23 33V23M32 33V23M41 33V23"/><path d="M23 18c-2-3 0-5 0-7 0 2 2 4 0 7ZM32 18c-2-3 0-5 0-7 0 2 2 4 0 7ZM41 18c-2-3 0-5 0-7 0 2 2 4 0 7Z"/>`],
  [/\b(chicken|turkey|wings?|drumsticks?)\b/i, `<path d="M26 30C22 18 30 8 42 8 52 8 58 18 56 28 54 38 44 42 34 38Z"/><path d="M30 34 18 46"/><path d="M18 46C16 41 8 43 9 48 9 50 11 51 13 51 12 54 14 56 17 56 22 56 23 50 20 48"/>`],
  [/\b(steaks?|beef|pork|ribs?|pot roast|lamb|ham|bacon|brisket|meatloaf|meatballs?)\b/i, `<path d="M14 20C24 6 52 8 56 26 60 44 40 56 24 54 8 52 4 34 14 20Z"/><path d="M22 26C30 16 46 20 46 30S32 46 24 42 16 34 22 26Z"/><circle cx="33" cy="31" r="4"/>`],
  [/\b(smoothies?|shakes?|milkshakes?|juices?|lemonades?|cocktails?|drinks?|punch|tea|coffee)\b/i, `<path d="M16 12H48L43 58H21Z"/><path d="M18 26H46"/><path d="M36 12 42 2"/>`],
];

export const drawingFor = (title) =>
  DRAWINGS.find(([words]) => words.test(title))?.[1] ?? PLATE;
