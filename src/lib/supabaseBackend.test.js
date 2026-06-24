import { describe, it, expect, beforeEach } from "vitest";
import { createSupabaseBackend } from "./supabaseBackend";

// --- in-memory fake of the supabase-js query builder -----------------------
// Just enough of the chainable API the backend uses: from().select().eq()
// .neq().order().maybeSingle(), .insert().select(), .upsert(), .delete().
class Query {
  constructor(store, table) {
    this.store = store;
    this.table = table;
    this.op = "select";
    this.cols = "*";
    this.filters = [];
    this.orderCol = null;
    this.payload = null;
    this.single = false;
    this.returnRows = false;
  }
  select(cols) {
    if (this.op === "insert") this.returnRows = true;
    else this.op = "select";
    this.cols = cols;
    return this;
  }
  eq(c, v) { this.filters.push(["eq", c, v]); return this; }
  neq(c, v) { this.filters.push(["neq", c, v]); return this; }
  order(c) { this.orderCol = c; return this; }
  insert(rows) { this.op = "insert"; this.payload = rows; return this; }
  upsert(row) { this.op = "upsert"; this.payload = row; return this; }
  delete() { this.op = "delete"; return this; }
  maybeSingle() { this.single = true; return this; }
  then(resolve, reject) { return this.#run().then(resolve, reject); }

  #match(r) {
    return this.filters.every(([kind, c, v]) =>
      kind === "eq" ? r[c] === v : r[c] !== v
    );
  }
  #project(r) {
    if (this.cols === "*") return { ...r };
    const out = {};
    for (const c of this.cols.split(",")) out[c.trim()] = r[c.trim()];
    return out;
  }
  async #run() {
    if (this.store._failNext) {
      this.store._failNext = false;
      return { data: null, error: { message: "boom" } };
    }
    const t = this.store[this.table];
    if (this.op === "select") {
      let rows = t.filter((r) => this.#match(r));
      if (this.orderCol) rows = [...rows].sort((a, b) => a[this.orderCol] - b[this.orderCol]);
      rows = rows.map((r) => this.#project(r));
      return this.single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null };
    }
    if (this.op === "delete") {
      const removed = t.filter((r) => this.#match(r));
      this.store[this.table] = t.filter((r) => !this.#match(r));
      if (this.table === "recipes") {
        const ids = new Set(removed.map((r) => r.id));
        this.store.recipe_ingredients = this.store.recipe_ingredients.filter(
          (ri) => !ids.has(ri.recipe_id)
        );
        this.store.recipe_schedule = this.store.recipe_schedule.filter(
          (s) => !ids.has(s.recipe_id)
        );
      }
      return { error: null };
    }
    if (this.op === "insert") {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(
        (r) => ({ ...r, id: r.id ?? `id-${++this.store._seq}` })
      );
      t.push(...rows);
      return this.returnRows
        ? { data: rows.map((r) => this.#project(r)), error: null }
        : { error: null };
    }
    if (this.op === "upsert") {
      const row = this.payload;
      const idx = t.findIndex((r) => r.id === row.id);
      if (idx >= 0) t[idx] = { ...t[idx], ...row };
      else t.push({ ...row });
      return { error: null };
    }
    return { data: null, error: { message: "unsupported op" } };
  }
}

function fakeClient() {
  const store = {
    inventory: [],
    recipes: [],
    recipe_ingredients: [],
    recipe_schedule: [],
    settings: [],
    _seq: 0,
    _failNext: false,
  };
  return { store, from: (table) => new Query(store, table) };
}

let client, backend;
beforeEach(() => {
  client = fakeClient();
  backend = createSupabaseBackend(client);
});

describe("inventory keys", () => {
  it("round-trips malts as malt-category rows", async () => {
    const malts = [{ n: "Pils", q: 5 }, { n: "2-Row", q: 10 }];
    await backend.save("malts", malts);

    expect(client.store.inventory).toHaveLength(2);
    expect(client.store.inventory[0]).toMatchObject({ category: "malt", name: "Pils", qty: 5, ord: 0 });
    expect(await backend.load("malts", null)).toEqual(malts);
  });

  it("preserves curated order via the ord column even if rows come back shuffled", async () => {
    await backend.save("hops", [{ n: "Saaz", q: 1 }, { n: "Citra", q: 2 }, { n: "Mosaic", q: 3 }]);
    client.store.inventory.reverse(); // simulate unordered return
    expect(await backend.load("hops", null)).toEqual([
      { n: "Saaz", q: 1 }, { n: "Citra", q: 2 }, { n: "Mosaic", q: 3 },
    ]);
  });

  it("carries the unit for adjuncts", async () => {
    const adj = [{ n: "Honey", q: 18, u: "lbs" }, { n: "Coffee", q: 5, u: "lbs" }];
    await backend.save("adj", adj);
    expect(client.store.inventory[0]).toMatchObject({ category: "adj", unit: "lbs", ord: 0 });
    expect(await backend.load("adj", null)).toEqual(adj);
  });

  it("returns the fallback when no rows exist", async () => {
    const fb = [{ n: "default", q: 0 }];
    expect(await backend.load("malts", fb)).toBe(fb);
  });

  it("save replaces the whole category (delete-then-insert)", async () => {
    await backend.save("yeast", [{ n: "K97", q: 1 }, { n: "S-04", q: 2 }]);
    await backend.save("yeast", [{ n: "US-05", q: 3 }]);
    expect(client.store.inventory).toHaveLength(1);
    expect(await backend.load("yeast", null)).toEqual([{ n: "US-05", q: 3 }]);
  });

  it("saving an empty array clears the category", async () => {
    await backend.save("malts", [{ n: "Pils", q: 5 }]);
    await backend.save("malts", []);
    expect(client.store.inventory).toHaveLength(0);
  });
});

describe("settings", () => {
  it("upserts a single row and reads it back", async () => {
    const s = { name: "Slackers", tagline: "beer", emoji: "🍺", logo: null };
    await backend.save("settings", s);
    expect(client.store.settings).toHaveLength(1);
    expect(client.store.settings[0]).toMatchObject({ id: 1, name: "Slackers" });
    expect(await backend.load("settings", null)).toEqual(s);

    await backend.save("settings", { ...s, name: "Renamed" });
    expect(client.store.settings).toHaveLength(1); // upsert, not a second row
    expect((await backend.load("settings", null)).name).toBe("Renamed");
  });

  it("returns the fallback when unset", async () => {
    const fb = { name: "def" };
    expect(await backend.load("settings", fb)).toBe(fb);
  });
});

describe("recipes", () => {
  const recipes = [
    { n: "All Y'alls", s: "NEIPA", og: 1.05, fg: 1.01, abv: 5.2, mt: 155, ft: 68,
      m: [["2-Row", 185], ["White Wheat", 55]],
      h: [["Cascade", 12, "boil", 10], ["Cascade", 48, "dryhop", 0]],
      y: [["K97", 1]], a: [], sa: [["CaCl2", 100, "mash"], ["CaSo4", 40, "sparge"]],
      sc: [[0, "Brew Date"], [12, "Dry Hop"], [20, "Keg"]] },
    { n: "Beachcomber", s: "Belgian Blond", og: null, fg: null, abv: null, mt: 152, ft: null,
      m: [["Pils", 110]], h: [],
      y: [["BE-134", 1]], a: [["Candi Syrup", 5, "lbs", "boil", 15]], sa: [], sc: [] },
  ];

  it("round-trips recipes into header + ingredient rows and back", async () => {
    await backend.save("recipes", recipes);
    expect(client.store.recipes).toHaveLength(2);
    expect(await backend.load("recipes", null)).toEqual(recipes);
  });

  it("keeps recipe and ingredient order, and adjunct units", async () => {
    await backend.save("recipes", recipes);
    client.store.recipes.reverse();
    client.store.recipe_ingredients.reverse();
    const loaded = await backend.load("recipes", null);
    expect(loaded.map((r) => r.n)).toEqual(["All Y'alls", "Beachcomber"]);
    expect(loaded[0].m).toEqual([["2-Row", 185], ["White Wheat", 55]]);
    expect(loaded[0].h).toEqual([["Cascade", 12, "boil", 10], ["Cascade", 48, "dryhop", 0]]);
    expect(loaded[0].sa).toEqual([["CaCl2", 100, "mash"], ["CaSo4", 40, "sparge"]]);
    expect(loaded[1].a).toEqual([["Candi Syrup", 5, "lbs", "boil", 15]]);
  });

  it("save clears prior recipes and their ingredients (cascade)", async () => {
    await backend.save("recipes", recipes);
    const solo = { n: "Solo", s: "Lager", og: null, fg: null, abv: null, mt: null, ft: null, m: [["Pils", 100]], h: [], y: [], a: [], sa: [], sc: [] };
    await backend.save("recipes", [solo]);
    expect(client.store.recipes).toHaveLength(1);
    expect(client.store.recipe_ingredients.every((ri) => ri.name === "Pils")).toBe(true);
    expect(await backend.load("recipes", null)).toEqual([solo]);
  });

  it("returns the fallback when there are no recipes", async () => {
    const fb = [{ n: "x" }];
    expect(await backend.load("recipes", fb)).toBe(fb);
  });
});

describe("UI-only keys", () => {
  it("delegate to the local backend; Supabase tables stay empty", async () => {
    const local = new Map();
    const b = createSupabaseBackend(client, {
      load: (k, fb) => (local.has(k) ? local.get(k) : fb),
      save: (k, v) => local.set(k, v),
    });
    await b.save("tab", 2);
    await b.save("orders", [{ sel: true, dbl: false }]);
    expect(await b.load("tab", 0)).toBe(2);
    expect(await b.load("selR", 9)).toBe(9); // fallback, never set
    expect(client.store.inventory).toHaveLength(0);
    expect(client.store.recipes).toHaveLength(0);
  });
});

describe("errors", () => {
  it("load throws on a backend error instead of returning the fallback", async () => {
    client.store._failNext = true;
    await expect(backend.load("malts", [])).rejects.toBeTruthy();
  });

  it("save throws on a backend error", async () => {
    client.store._failNext = true;
    await expect(backend.save("settings", { name: "x" })).rejects.toBeTruthy();
  });
});
