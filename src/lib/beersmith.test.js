import { describe, it, expect } from "vitest";
import { parseBeerSmith } from "./beersmith";

// A compact .bsmx exercising the parser's tricky paths: oz→lb grain, a
// fermentable sugar that's an app adjunct, verbose names needing aliasing,
// every hop stage, a water-salt vs a flavor misc, and two unmapped items.
const XML = `
<Recipe>
<F_R_NAME>Test Ale</F_R_NAME>
<F_R_STYLE>American IPA</F_R_STYLE>
<Grain><F_G_NAME>Pale Malt (2 Row) US</F_G_NAME><F_G_TYPE>0</F_G_TYPE><F_G_AMOUNT>1600.0</F_G_AMOUNT></Grain>
<Grain><F_G_NAME>Mystery Malt</F_G_NAME><F_G_TYPE>0</F_G_TYPE><F_G_AMOUNT>160.0</F_G_AMOUNT></Grain>
<Grain><F_G_NAME>Milk Sugar (Lactose)</F_G_NAME><F_G_TYPE>2</F_G_TYPE><F_G_AMOUNT>160.0</F_G_AMOUNT><F_G_BOIL_TIME>5.0</F_G_BOIL_TIME></Grain>
<Hops><F_H_NAME>Columbus/Tomahawk/Zeus (CTZ)</F_H_NAME><F_H_USE>0</F_H_USE><F_H_AMOUNT>20.0</F_H_AMOUNT><F_H_BOIL_TIME>60.0</F_H_BOIL_TIME></Hops>
<Hops><F_H_NAME>Mosaic (HBC 369)</F_H_NAME><F_H_USE>4</F_H_USE><F_H_AMOUNT>12.0</F_H_AMOUNT><F_H_BOIL_TIME>15.0</F_H_BOIL_TIME></Hops>
<Hops><F_H_NAME>Aramis</F_H_NAME><F_H_USE>1</F_H_USE><F_H_AMOUNT>48.0</F_H_AMOUNT><F_H_BOIL_TIME>60.0</F_H_BOIL_TIME></Hops>
<Yeast><F_Y_NAME>SafAle German Ale</F_Y_NAME><F_Y_AMOUNT>1.0</F_Y_AMOUNT></Yeast>
<Misc><F_M_NAME>Gypsum (Calcium Sulfate)</F_M_NAME><F_M_TYPE>5</F_M_TYPE><F_M_USE>1</F_M_USE><F_M_AMOUNT>40.0</F_M_AMOUNT><F_M_TIME>60.0</F_M_TIME></Misc>
<Misc><F_M_NAME>Coriander Seed</F_M_NAME><F_M_TYPE>0</F_M_TYPE><F_M_USE>0</F_M_USE><F_M_AMOUNT>1.0</F_M_AMOUNT><F_M_TIME>5.0</F_M_TIME></Misc>
<Misc><F_M_NAME>Pixie Dust</F_M_NAME><F_M_TYPE>3</F_M_TYPE><F_M_USE>3</F_M_USE><F_M_AMOUNT>2.0</F_M_AMOUNT><F_M_TIME>0.0</F_M_TIME></Misc>
<MashStep><F_MS_NAME>Mash In</F_MS_NAME><F_MS_STEP_TEMP>152.0</F_MS_STEP_TEMP></MashStep>
</Recipe>`;

describe("parseBeerSmith", () => {
  const { recipes, unmapped } = parseBeerSmith(XML);
  const r = recipes[0];

  it("parses header, mash temp, and leaves targets blank", () => {
    expect(recipes).toHaveLength(1);
    expect(r.n).toBe("Test Ale");
    expect(r.mt).toBe(152);
    // OG/FG/ABV aren't persisted by BeerSmith, so the parser leaves them null.
    expect([r.og, r.fg, r.abv]).toEqual([null, null, null]);
  });

  it("converts grain ounces to pounds and routes sugars to adjuncts", () => {
    expect(r.m).toContainEqual(["2-Row", 100]); // 1600 oz / 16
    expect(r.a).toContainEqual(["Lactose", 10, "lbs", "boil", 5]); // 160 oz / 16
  });

  it("normalizes hop names and captures stage + time", () => {
    expect(r.h).toEqual([
      ["CTZ", 20, "boil", 60],
      ["Mosaic", 12, "whirlpool", 15],
      ["Willamette", 48, "dryhop", 0], // Aramis→Willamette; dry hop time zeroed
    ]);
  });

  it("normalizes yeast and water salts", () => {
    expect(r.y).toEqual([["K97", 1]]);
    expect(r.sa).toEqual([["CaSo4", 40, "mash"]]);
  });

  it("keeps flavor misc as adjuncts with stage + time", () => {
    expect(r.a).toContainEqual(["Coriander", 1, "oz", "boil", 5]);
  });

  it("flags ingredients with no catalog match for user mapping", () => {
    expect(unmapped).toContainEqual({ category: "malt", raw: "Mystery Malt" });
    expect(unmapped).toContainEqual({ category: "adj", raw: "Pixie Dust" });
    expect(unmapped).toHaveLength(2);
  });
});
