// Parse BeerSmith 3 (.bsmx) recipe XML into the app's recipe model.
//
// Used by (1) the offline migration/seed generator and (2) the in-app import
// feature (a tab that uploads a .bsmx to create or update a recipe). Pure and
// DOM-free (regex-based) so it runs identically in the browser, in Node, and
// under Vitest.
//
// BeerSmith quirks this handles:
//  - Each ingredient is wrapped in a PLURAL tag (<Hops>, <Grain>, <Misc>,
//    <Yeast>, <MashStep>) repeated once per item — there is no inner <Hop>.
//  - Grain amounts are in OUNCES; the app stores malts in pounds (÷16).
//  - Fermentable "sugars" (Candi, Lactose, Honey) sit in the grain section but
//    are adjuncts in the app (distinguished by F_G_TYPE != 0).
//  - Hop stage is F_H_USE (0 boil, 1 dry hop, 2 mash, 3 first wort,
//    4 whirlpool); boil/whirlpool minutes are in F_H_BOIL_TIME.
//  - Misc F_M_TYPE 5 = water agent (salt); other types are flavor/spice/fining.
//  - Names are verbose ("Pale Malt (2 Row) US"); we normalize to the app
//    catalog via the ALIAS maps below and report anything still unmapped so the
//    import UI can ask the user to map it.

import { maltNames, hopNames, yeastNames, adjNames, adjUnits, saltNames } from "./defaults";

// --- name normalization (BeerSmith -> app catalog) -------------------------
// Only non-identity mappings are listed; a raw name that already equals an app
// catalog entry passes through unchanged. Keys are trimmed before lookup.

const ALIAS_MALT = {
  "Aromatic Malt": "Aromatic",
  "Black (Patent) Malt": "Black Patent",
  "Cara-Pils/Dextrine": "Carafoam",
  "Carafa III": "Carafe III",
  "Caramunich Type 1": "Caramunich I",
  "Chocolate Malt": "Chocolate",
  "Corn, Flaked": "Flaked Corn",
  "Munich Malt": "Munich",
  "Oats, Flaked": "Flaked Oat",
  "Pale Malt (2 Row) UK": "2-Row",
  "Pale Malt (2 Row) US": "2-Row",
  "Pale Malt, Maris Otter": "Maris Otter",
  "Pilsner (2 Row) Bel": "Pils",
  "Pilsner (2 Row) Ger": "Pils",
  "Vienna Malt": "Vienna",
  "Wheat Malt, Bel": "White Wheat",
  "Wheat, Flaked": "Flaked Wheat",
  "White Wheat Malt": "White Wheat",
};

// Fermentables that are adjuncts in the app: raw name -> [appName, unit].
const ALIAS_FERMENTABLE_ADJ = {
  "Candi Sugar, Clear": ["Candi Syrup", "lbs"],
  Honey: ["Honey", "lbs"],
  "Milk Sugar (Lactose)": ["Lactose", "lbs"],
};

const ALIAS_HOP = {
  "Columbus/Tomahawk/Zeus (CTZ)": "CTZ",
  "Columbus (Tomahawk)": "CTZ",
  "Mosaic (HBC 369)": "Mosaic",
  Aramis: "Willamette", // app catalog has no Aramis; substitute per decision
};

const ALIAS_YEAST = {
  "SafAle German Ale": "K97",
  "Belgian Ale Yeast": "BE-134",
  "SafAle English Ale": "S-04",
  "Safale American": "US-05",
  "Safbrew Wheat": "WB-06",
  "Safebrew Abbey Ale": "BE-256",
};

// Misc flavor/spice/fining: raw name -> [appName, unit].
const ALIAS_MISC_ADJ = {
  Coffee: ["Coffee", "lbs"],
  "Coriander Seed": ["Coriander", "oz"],
  "Ghost Pepper": ["Ghost Peppers", "each"],
  "Lemon Peel": ["Lemon", "oz"],
  "Mango Puree": ["Mango Puree", "lbs"],
  "Orange Peel, Bitter": ["Orange Peel", "oz"],
  "Strawberry Extract": ["Straw/Rhubarb", "oz"],
  "Whirlfloc Tablet": ["Whirlfloc", "each"],
};

const ALIAS_SALT = {
  "Calcium Chloride": "CaCl2",
  "Gypsum (Calcium Sulfate)": "CaSo4",
  "Epsom Salt (MgSO4)": "Epsom",
};

// BeerSmith enum codes -> our stage vocabulary.
const HOP_USE = { 0: "boil", 1: "dryhop", 2: "mash", 3: "firstwort", 4: "whirlpool" };
const MISC_USE = { 0: "boil", 1: "mash", 2: "primary", 3: "secondary", 4: "bottling", 5: "sparge" };

// --- low-level XML helpers (no DOM; this format is flat per ingredient) -----

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
function unescapeXml(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&ouml;/g, "ö").replace(/&uuml;/g, "ü").replace(/&auml;/g, "ä")
    .replace(/&Ouml;/g, "Ö").replace(/&Uuml;/g, "Ü").replace(/&Auml;/g, "Ä")
    .replace(/&amp;|&lt;|&gt;|&quot;|&apos;/g, (m) => ENTITIES[m]);
}
const field = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? unescapeXml(m[1]) : "";
};
const blocks = (text, tag) =>
  text.match(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "g")) || [];
const num = (s) => {
  const f = parseFloat(s);
  if (!isFinite(f)) return 0;
  return Math.round(f * 100) / 100;
};

// Resolve a raw name to an app catalog name. Returns {name, mapped}: mapped is
// false when the name is neither aliased nor already in the catalog.
function resolve(raw, alias, catalog) {
  const key = raw.trim();
  if (alias[key]) return { name: alias[key], mapped: true };
  if (catalog.includes(key)) return { name: key, mapped: true };
  return { name: key, mapped: false };
}

// Adjuncts come from two sources (fermentable sugars + flavor misc) and two
// alias tables. Returns [appName, unit] or null when nothing matches.
function resolveAdj(raw) {
  const key = raw.trim();
  const a = ALIAS_FERMENTABLE_ADJ[key] || ALIAS_MISC_ADJ[key];
  if (a) return a;
  if (adjNames.includes(key)) return [key, adjUnits[key] || "each"];
  return null;
}

// --- public API ------------------------------------------------------------

// Parse .bsmx text into { recipes, unmapped }.
//   recipes  — [{ n, s, mt, og, fg, abv, m, h, y, a, sa }]
//   unmapped — [{ category, raw }] names that need user mapping (deduped)
// Tuple shapes match the app model: m=[name,qty]; h=[name,qty,stage,time];
// y=[name,qty]; a=[name,qty,unit,stage,time]; sa=[name,qty,stage].
export function parseBeerSmith(xml) {
  const recipes = [];
  const unmapped = new Map(); // `${cat}:${raw}` -> {category, raw}
  const flag = (category, raw) => unmapped.set(`${category}:${raw}`, { category, raw });

  for (const rb of blocks(xml, "Recipe")) {
    const m = [];
    const a = [];
    const sa = [];
    const h = [];
    const y = [];

    // Fermentables: grain (type 0) -> malt; sugars/extracts/honey -> adjunct.
    for (const g of blocks(rb, "Grain")) {
      const raw = field(g, "F_G_NAME");
      const qty = num(field(g, "F_G_AMOUNT")) / 16; // oz -> lbs
      if (field(g, "F_G_TYPE") === "0") {
        const r = resolve(raw, ALIAS_MALT, maltNames);
        if (!r.mapped) flag("malt", raw.trim());
        m.push([r.name, Math.round(qty * 100) / 100]);
      } else {
        const rounded = Math.round(qty * 100) / 100;
        const adj = resolveAdj(raw);
        if (adj) a.push([adj[0], rounded, adj[1], "boil", num(field(g, "F_G_BOIL_TIME"))]);
        else { flag("adj", raw.trim()); a.push([raw.trim(), rounded, "each", "boil", num(field(g, "F_G_BOIL_TIME"))]); }
      }
    }

    // Hops: per-addition with stage + time.
    for (const hp of blocks(rb, "Hops")) {
      const raw = field(hp, "F_H_NAME");
      const r = resolve(raw, ALIAS_HOP, hopNames);
      if (!r.mapped) flag("hop", raw.trim());
      const stage = HOP_USE[field(hp, "F_H_USE")] || "boil";
      const time = stage === "dryhop" || stage === "mash" ? 0 : num(field(hp, "F_H_BOIL_TIME"));
      h.push([r.name, num(field(hp, "F_H_AMOUNT")), stage, time]);
    }

    // Yeast.
    for (const yb of blocks(rb, "Yeast")) {
      const raw = field(yb, "F_Y_NAME");
      const r = resolve(raw, ALIAS_YEAST, yeastNames);
      if (!r.mapped) flag("yeast", raw.trim());
      y.push([r.name, num(field(yb, "F_Y_AMOUNT")) || 1]);
    }

    // Misc: water agents (type 5) -> salts; everything else -> adjuncts.
    for (const mb of blocks(rb, "Misc")) {
      const raw = field(mb, "F_M_NAME");
      const stage = MISC_USE[field(mb, "F_M_USE")] || "boil";
      if (field(mb, "F_M_TYPE") === "5") {
        const r = resolve(raw, ALIAS_SALT, saltNames);
        if (!r.mapped) flag("salt", raw.trim());
        sa.push([r.name, num(field(mb, "F_M_AMOUNT")), stage]);
      } else {
        const amt = num(field(mb, "F_M_AMOUNT"));
        const t = num(field(mb, "F_M_TIME"));
        const adj = resolveAdj(raw);
        if (adj) a.push([adj[0], amt, adj[1], stage, t]);
        else { flag("adj", raw.trim()); a.push([raw.trim(), amt, "each", stage, t]); }
      }
    }

    const steps = blocks(rb, "MashStep");
    const mt = steps.length ? num(field(steps[0], "F_MS_STEP_TEMP")) : null;

    recipes.push({
      n: field(rb, "F_R_NAME"),
      s: field(rb, "F_R_STYLE"),
      mt,
      og: null, fg: null, abv: null, // BeerSmith targets here are unset defaults
      m, h, y, a, sa,
    });
  }

  return { recipes, unmapped: [...unmapped.values()] };
}
