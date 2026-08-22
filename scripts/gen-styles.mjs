// Regenerate src/lib/beerStyles.js from a BeerSmith style export.
//
//   BeerSmith ▸ File ▸ Export ▸ Styles  ->  styles/styles.bsmx  (gitignored)
//   node scripts/gen-styles.mjs
//
// The export is hundreds of KB and carries BJCP's copyrighted style
// descriptions, so it stays out of the repo; only the generated name/category
// module is committed. See parseBeerSmithStyles() for what is and isn't taken.
import { readFileSync, writeFileSync } from "node:fs";
import { parseBeerSmithStyles } from "../src/lib/beersmith.js";

const SRC = "styles/styles.bsmx";
const OUT = "src/lib/beerStyles.js";

const styles = parseBeerSmithStyles(readFileSync(SRC, "utf8"))
  .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

const guides = [...new Set(styles.map((s) => s.guide))].join(", ");
const body = styles.map((s) => `  [${JSON.stringify(s.name)}, ${JSON.stringify(s.category)}],`).join("\n");

writeFileSync(OUT, `// GENERATED FILE — do not edit by hand.
// Run \`node scripts/gen-styles.mjs\` after re-exporting styles from BeerSmith.
//
// ${styles.length} styles (${guides}) as [name, category] pairs, sorted by
// category then name. Names and categories only: the export's F_S_DESCRIPTION
// is verbatim BJCP guideline prose and this repo is public.
//
// A recipe's style is still a free string — this is the picker's catalog, not a
// constraint. Imported or legacy names that aren't here (Slackers' own "NEIPA",
// say) stay exactly as they are; the Edit view offers them alongside the list.

const STYLE_PAIRS = [
${body}
];

// Flat name list, for membership checks.
export const styleNames = STYLE_PAIRS.map(([name]) => name);

// [{ category, names[] }] in catalog order — the shape an <optgroup> list wants.
export const stylesByCategory = STYLE_PAIRS.reduce((groups, [name, category]) => {
  const last = groups[groups.length - 1];
  if (last && last.category === category) last.names.push(name);
  else groups.push({ category, names: [name] });
  return groups;
}, []);
`);

console.log(`${OUT}: ${styles.length} styles in ${new Set(styles.map((s) => s.category)).size} categories`);
