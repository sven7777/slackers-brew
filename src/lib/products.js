// Branded product catalog — the purchasable thing behind each generic ingredient
// name.
//
// Recipes and inventory speak brewer shorthand ("2-Row", "Caramunich I"); vendors
// sell branded SKUs in vendor pack sizes. This file is the bridge: one row per
// product Slackers actually buys, and a default mapping from each generic name to
// one of them. It is deliberately NOT the vendor's full ~800-line list — only what
// the recipes call for.
//
// NOTE — this file carries NO prices, on purpose.
//
// BSG stamps its price lists "TRADE SECRET CONFIDENTIAL" and this repo is public,
// so vendor prices must never be committed here (nor as test fixtures — use
// fabricated numbers in tests). Prices live only in the private Supabase database,
// loaded once from a gitignored seed and edited thereafter in the Cost view. The
// same boundary is what the future price-list uploader needs anyway: parse in the
// browser, write to the private DB, never to git.
//
// So `products` describes *what* we buy — SKU, vendor, product name, pack size,
// crop year — all of which is public vendor catalog information. What it costs is
// joined on at runtime from `inventory.cost_per_unit`.
//
// Pack sizes reflect how Slackers actually orders: hops in 11 lb boxes only, and
// no quantity-break tiers anywhere (they never order more than 20 of anything, so
// the vendor's 40+/200+/480+ prices never apply).

// packQty/packUnit describe the vendor pack that a price applies to. Malts and
// hops are quoted per pound, so their pack is 1 lb even though they ship as 55 lb
// sacks and 11 lb boxes — that real purchasable unit is `orderPack`, which the
// future order copy-mode needs.
export const products = [
  // ---- Malts (quoted $/lb, ship in 55 lb sacks) -----------------------------
  { sku: "MRAH1102", vendor: "Rahr",      name: "Rahr Standard 2-Row",                        packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MWEY1003", vendor: "Weyermann", name: "Weyermann® Pilsner Malt",                    packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MCRI1001", vendor: "Crisp",     name: "Crisp Finest Maris Otter®",                  packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MWEY1031", vendor: "Weyermann", name: "Weyermann® CARAMUNICH® Type 1",              packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MWEY1056", vendor: "Weyermann", name: "Weyermann® CARAFOAM®",                       packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MDIN1004", vendor: "Dingemans", name: "Dingemans Chocolate",                        packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MSIM1052", vendor: "Simpsons",  name: "Simpsons Black Malt",                        packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MSIM1053", vendor: "Simpsons",  name: "Simpsons Roasted Barley",                    packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MRAH1108", vendor: "Rahr",      name: "Rahr White Wheat",                           packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MDIN1001", vendor: "Dingemans", name: "Dingemans Aromatic Malt",                    packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MWEY1016", vendor: "Weyermann", name: "Weyermann® Vienna Malt",                     packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MWEY1017", vendor: "Weyermann", name: "Weyermann® Munich Malt Type 1",              packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MWEY1053", vendor: "Weyermann", name: "Weyermann® CARAFA® Type 3",                  packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MWEY1067", vendor: "Weyermann", name: "Weyermann® CARAFA® Special Type 3 (Dehusked)", packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MDIN1003", vendor: "Dingemans", name: "Dingemans Biscuit®",                         packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "MSIM1040", vendor: "Simpsons",  name: "Simpsons Crystal Dark Medium",               packQty: 1, packUnit: "lb", orderPack: "55 lb" },

  // ---- Flaked / unmalted grains (quoted $/lb) -------------------------------
  { sku: "AZZZ1304", vendor: "OiO", name: "OiO Flaked Wheat - 55 lb",      packQty: 1, packUnit: "lb", orderPack: "55 lb" },
  { sku: "AZZZ1302", vendor: "OiO", name: "OiO Flaked Corn - 50 lb",       packQty: 1, packUnit: "lb", orderPack: "50 lb" },
  { sku: "AZZZ1303", vendor: "OiO", name: "OiO Rolled Oat Flakes - 55 lb", packQty: 1, packUnit: "lb", orderPack: "55 lb" },

  // ---- Hops (quoted $/lb, 11 lb boxes; cropYear is what that price is for) --
  { sku: "HOP-IDA7",  vendor: "BSG", name: "Idaho 7™ Pellet - 11 lb",    cropYear: 2022, packQty: 1, packUnit: "lb", orderPack: "11 lb" },
  { sku: "HOP-CTZ",   vendor: "BSG", name: "CTZ Pellet - 11 lb",         cropYear: 2024, packQty: 1, packUnit: "lb", orderPack: "11 lb" },
  { sku: "HOP-CAS",   vendor: "BSG", name: "Cascade Pellet - 11 lb",     cropYear: 2023, packQty: 1, packUnit: "lb", orderPack: "11 lb" },
  { sku: "HOP-CHI",   vendor: "BSG", name: "Chinook Pellet - 11 lb",     cropYear: 2024, packQty: 1, packUnit: "lb", orderPack: "11 lb" },
  { sku: "HOP-CEN",   vendor: "BSG", name: "Centennial Pellet - 11 lb",  cropYear: 2024, packQty: 1, packUnit: "lb", orderPack: "11 lb" },
  { sku: "HOP-CRY",   vendor: "BSG", name: "Crystal Pellet - 11 lb",     cropYear: 2024, packQty: 1, packUnit: "lb", orderPack: "11 lb" },
  { sku: "HOP-AMA",   vendor: "BSG", name: "Amarillo® Pellet - 11 lb",  cropYear: 2024, packQty: 1, packUnit: "lb", orderPack: "11 lb" },
  { sku: "HOP-SAA",   vendor: "BSG", name: "Saaz Pellet - 11 lb",       cropYear: 2024, packQty: 1, packUnit: "lb", orderPack: "11 lb" },
  { sku: "HOP-WIL",   vendor: "BSG", name: "Willamette Pellet - 11 lb", cropYear: 2024, packQty: 1, packUnit: "lb", orderPack: "11 lb" },
  { sku: "HOP-CIT",   vendor: "BSG", name: "Citra® Pellet - 11 lb",     cropYear: 2024, packQty: 1, packUnit: "lb", orderPack: "11 lb" },
  { sku: "HOP-MOS",   vendor: "BSG", name: "Mosaic® Pellet - 11 lb",    cropYear: 2024, packQty: 1, packUnit: "lb", orderPack: "11 lb" },
  { sku: "HOP-SIM",   vendor: "BSG", name: "Simcoe® Pellet - 11 lb",    cropYear: 2024, packQty: 1, packUnit: "lb", orderPack: "11 lb" },
  // Not on the spot list — Derek's last paid price, quoted per 11 lb box.
  { sku: "HOP-PB25",  vendor: "BSG", name: "Pink Boots Blend 2025 - 11 lb", packQty: 11, packUnit: "lb", orderPack: "11 lb" },
  { sku: "HOP-LEM",   vendor: "BSG", name: "Lemondrop™ Pellet - 11 lb",     packQty: 11, packUnit: "lb", orderPack: "11 lb" },

  // ---- Yeast (1 pack = one 500 g brick = one pitch) -------------------------
  { sku: "BZZZ1971", vendor: "Fermentis", name: "Fermentis SafAle™ K-97 - 500 g",   packQty: 500, packUnit: "g", orderPack: "500 g" },
  { sku: "BZZZ1972", vendor: "Fermentis", name: "Fermentis SafAle™ S-04 - 500 g",   packQty: 500, packUnit: "g", orderPack: "500 g" },
  { sku: "BZZZ1973", vendor: "Fermentis", name: "Fermentis SafAle™ US-05 - 500 g",  packQty: 500, packUnit: "g", orderPack: "500 g" },
  { sku: "BZZZ1984", vendor: "Fermentis", name: "Fermentis SafAle™ BE-134 - 500 g", packQty: 500, packUnit: "g", orderPack: "500 g" },
  { sku: "BZZZ1977", vendor: "Fermentis", name: "Fermentis SafAle™ BE-256 - 500 g", packQty: 500, packUnit: "g", orderPack: "500 g" },
  { sku: "BZZZ1976", vendor: "Fermentis", name: "Fermentis SafAle™ WB-06 - 500 g",  packQty: 500, packUnit: "g", orderPack: "500 g" },
  { sku: "BZZZ3643", vendor: "Fermentis", name: "Fermentis SafBrew™ DA-16 - 500 g", packQty: 500, packUnit: "g", orderPack: "500 g" },
  { sku: "YST-VOSS", vendor: "Other",     name: "Kveik Voss - 500 g",               packQty: 500, packUnit: "g", orderPack: "500 g" },

  // ---- Adjuncts ------------------------------------------------------------
  { sku: "BZZZ1203", vendor: "BSG",    name: "Lactose - 55 lb",                 packQty: 55,   packUnit: "lb", orderPack: "55 lb" },
  { sku: "AZZZ1772", vendor: "Candico", name: "Candi Syrup Amber - 25 kg",     packQty: 25,   packUnit: "kg", orderPack: "25 kg" },
  { sku: "AZZZ2901", vendor: "BSG",    name: "Mango Puree - 44.1 lb",          packQty: 44.1, packUnit: "lb", orderPack: "44.1 lb" },
  { sku: "AZZZ1808", vendor: "BSG",    name: "Coriander Powder - 2 lb",         packQty: 2,    packUnit: "lb", orderPack: "2 lb" },
  { sku: "AZZZ1801", vendor: "BSG",    name: "Orange Peel Sweet VP - 2 lb",     packQty: 2,    packUnit: "lb", orderPack: "2 lb" },
  { sku: "AZZZ1811", vendor: "BSG",    name: "Lemon Peel - 2 lb",               packQty: 2,    packUnit: "lb", orderPack: "2 lb" },
  // Sold by volume, used by weight: 1 gal of honey ≈ 12 lb, so 5 gal ≈ 60 lb.
  // That density assumption is the only unit conversion here that isn't exact.
  { sku: "AZZZ4101", vendor: "BSG",    name: "Honey - Clover (USA) - 5 gal",   packQty: 60,   packUnit: "lb", orderPack: "5 gal" },
  // Whirlfloc T is the tablet form (G is granular). unitMass is what makes a
  // 5 lb tub divisible into the "each" the recipes count in.
  { sku: "BZZZ1672", vendor: "BSG", name: "Whirlfloc® T - 5 lb", packQty: 5, packUnit: "lb", orderPack: "5 lb", unitMass: { qty: 2.5, unit: "g" } },
  { sku: "CLF-1L",   vendor: "White Labs", name: "White Labs Clarity Ferm - 1 L", packQty: 1, packUnit: "L", orderPack: "1 L" },

];

export const productsBySku = Object.fromEntries(products.map(p => [p.sku, p]));

// Ingredients with no vendor product at all — BSG carries none of these; they
// come from a roaster, a produce supplier, and a lab. They map to null rather
// than to a priceless placeholder, so the Cost view reports them as unpriced
// instead of costing them at $0. Three of the four are used in live recipes.
export const UNPRICEABLE = [
  "adj/Brewzyme D",
  "adj/Coffee",
  "adj/Ghost Peppers",
  "adj/Straw/Rhubarb",
];

// Default generic name → product SKU, per category. This is the editable
// judgment layer: "our 2-Row is Rahr Standard 2-Row". Two names may point at one
// product (Midnight Wheat and Carafa Special III are the same sack) — they stay
// distinct in inventory and merge only when computing an order.
export const defaultProductMap = {
  malt: {
    "Pils": "MWEY1003",
    "2-Row": "MRAH1102",
    "Maris Otter": "MCRI1001",
    "Caramunich I": "MWEY1031",
    "Carafoam": "MWEY1056",
    "Chocolate": "MDIN1004",
    "Black Patent": "MSIM1052",
    "Roasted Barley": "MSIM1053",
    "White Wheat": "MRAH1108",
    "Aromatic": "MDIN1001",
    "Flaked Wheat": "AZZZ1304",
    "Flaked Corn": "AZZZ1302",
    "Vienna": "MWEY1016",
    "Munich": "MWEY1017",
    "Carafa III": "MWEY1053",
    "Carafa Special III": "MWEY1067",
    "Biscuit Malt": "MDIN1003",
    "Crystal 80": "MSIM1040",
    "Flaked Oat": "AZZZ1303",
    "Midnight Wheat": "MWEY1067",
  },
  hop: {
    "Pink Boots 2025": "HOP-PB25",
    "Saaz": "HOP-SAA",
    "CTZ": "HOP-CTZ",
    "Willamette": "HOP-WIL",
    "Amarillo": "HOP-AMA",
    "Simcoe": "HOP-SIM",
    "Crystal": "HOP-CRY",
    "Chinook": "HOP-CHI",
    "Cascade": "HOP-CAS",
    "Mosaic": "HOP-MOS",
    "Centennial": "HOP-CEN",
    "Citra": "HOP-CIT",
    "Idaho 7": "HOP-IDA7",
    "Lemondrop": "HOP-LEM",
  },
  yeast: {
    "K97": "BZZZ1971",
    "BE-134": "BZZZ1984",
    "S-04": "BZZZ1972",
    "US-05": "BZZZ1973",
    "WB-06": "BZZZ1976",
    "BE-256": "BZZZ1977",
    "KVEIK VOSS": "YST-VOSS",
    "DA-16": "BZZZ3643",
  },
  adj: {
    "Candi Syrup": "AZZZ1772",
    "Lactose": "BZZZ1203",
    "Ghost Peppers": null,
    "Straw/Rhubarb": null,
    "Orange Peel": "AZZZ1801",
    "Coffee": null,
    "Honey": "AZZZ4101",
    "Lemon": "AZZZ1811",
    "Coriander": "AZZZ1808",
    "Mango Puree": "AZZZ2901",
    "Clarity Ferm": "CLF-1L",
    "Brewzyme D": null,
    "Whirlfloc": "BZZZ1672",
  },
};

// The unit each category's recipe quantities are measured in. Adjuncts carry
// their own per-item unit (adjUnits in defaults.js), so they're absent here.
export const categoryUnit = { malt: "lb", hop: "oz", yeast: "pack" };
