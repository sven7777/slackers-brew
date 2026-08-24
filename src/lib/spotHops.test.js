import { describe, it, expect } from 'vitest';
import { parseSpotHops, parseSpotHopPages, parseSpotHopDate, matchSpotHopPrices, groupWordsIntoRows, normalizeVariety, ourHops } from './spotHops';

// ⚠️ Fabricated prices — the real list is confidential (see parsePriceList.test.js).
// The LAYOUT is real: a year header row, then variety rows whose prices sit under
// the column for their crop year.
const w = (text, x0, y0, { confidence = 95, width = text.length * 10, height = 14 } = {}) =>
  ({ text, x0, y0, x1: x0 + width, y1: y0 + height, confidence });

// Column centres: 2022 ≈ 640, 2023 ≈ 870, 2024 ≈ 1100.
const header = [w('HOP', 100, 100), w('VARIETY', 140, 100), w('ORIGIN', 420, 100),
  w('2022', 620, 100, { width: 40 }), w('2023', 850, 100, { width: 40 }), w('2024', 1080, 100, { width: 40 })];

const row = (label, y, prices) => [
  ...label.split(' ').map((t, i) => w(t, 100 + i * 60, y)),
  w('American', 420, y),
  ...prices.map(([x, p]) => w(p, x, y, { width: 60 })),
];

const words = [
  ...header,
  ...row('Cascade Pellet - 11lb', 130, [[615, '$1.00/lb'], [1075, '$3.00/lb']]),
  ...row('Cryo Cascade Hops - 11 lb', 160, [[1075, '$9.00/lb']]),
  ...row('Citra Pellet - 11lb', 190, [[1075, '$4.00/lb']]),
  ...row('Citra Cryo Pellet - 11lb', 220, [[1075, '$9.50/lb']]),
  ...row('Centennial Pellet - 44lb', 250, [[1075, '$8.00/lb']]),
  ...row('Centennial Pellet - 11lb', 280, [[1075, '$5.00/lb']]),
];

describe('groupWordsIntoRows', () => {
  it('groups words by vertical overlap and orders them left to right', () => {
    const rows = groupWordsIntoRows([w('b', 200, 100), w('a', 100, 102), w('next', 100, 200)]);
    expect(rows).toHaveLength(2);
    expect(rows[0].words.map((x) => x.text)).toEqual(['a', 'b']);
  });

  it('ignores blank OCR fragments and no input', () => {
    expect(groupWordsIntoRows([w('  ', 10, 10)])).toEqual([]);
    expect(groupWordsIntoRows(undefined)).toEqual([]);
  });
});

describe('normalizeVariety', () => {
  it('strips trademark marks and folds dashes and spacing', () => {
    expect(normalizeVariety('Citra®  Pellet – 11lb')).toBe('citra pellet - 11lb');
    expect(normalizeVariety('Idaho 7™ Pellet')).toBe('idaho 7 pellet');
  });
});

describe('parseSpotHops', () => {
  it('assigns each price to the crop-year column it sits under', () => {
    const { rows } = parseSpotHops(words);
    const cascade = rows.find((r) => r.variety.startsWith('cascade'));
    expect(cascade.prices).toEqual([
      { price: 1, year: 2022, confidence: 95 },
      { price: 3, year: 2024, confidence: 95 },
    ]);
  });

  it('reads a price whether or not OCR kept the dollar sign, and tolerates "Ib" for "lb"', () => {
    const { rows } = parseSpotHops([...header, ...row('Saaz Pellet - 11lb', 130, [[1075, '7.25/Ib']])]);
    expect(rows[0].prices).toEqual([{ price: 7.25, year: 2024, confidence: 95 }]);
  });

  it('takes the crop year from the row itself when there are no year columns', () => {
    // The FEATURED block prints Year and Price as their own columns.
    const featured = [
      w('Loral', 100, 100), w('Cryo', 160, 100), w('Pellet', 220, 100),
      w('2023', 900, 100, { width: 40 }), w('$5.00/lb', 1075, 100, { width: 60 }),
    ];
    const { rows } = parseSpotHops(featured);
    expect(rows[0].prices).toEqual([{ price: 5, year: 2023, confidence: 95 }]);
  });

  it('drops a row with no prices, and one whose price is under no column', () => {
    const { rows } = parseSpotHops([...header, ...row('Krush Pellet - 11lb', 130, [])]);
    expect(rows).toEqual([]);
  });

  it('ignores the footnote word "origin" when finding the column boundary', () => {
    // The list's own note — "*Amarillo crop origin may fluctuate between US and
    // Germany" — sits above the rows. Read as the ORIGIN header it truncated
    // every label below it and dropped most of the page.
    const footnote = [w('*Amarillo', 60, 118), w('crop', 160, 118), w('origin', 210, 118),
      w('may', 270, 118), w('fluctuate', 310, 118)];
    const { rows } = parseSpotHops([...header, ...footnote, ...row('Cascade Pellet - 11lb', 130, [[615, '$1.00/lb']])]);
    expect(rows[0].label).toBe('Cascade Pellet - 11lb');
  });

  it('reads a row whose OCR turned "lb" into "1b"', () => {
    const { rows } = parseSpotHops([...header, ...row('Saaz Pellet - 111b', 130, [[615, '$1.00/1b']])]);
    expect(rows[0].prices).toEqual([{ price: 1, year: 2022, confidence: 95 }]);
  });

  it('keeps a label OCR ran into one wide token that overhangs the column', () => {
    // The variety cell came back as a single word whose box reaches past the
    // ORIGIN column; the row must still be read, not dropped.
    const wide = [w('Mandarina-Bavaria-Pellet-11lb', 100, 130, { width: 340 }),
      w('German', 420, 130), w('$2.00/lb', 615, 130, { width: 60 })];
    const { rows } = parseSpotHops([...header, ...wide]);
    expect(rows[0]).toMatchObject({ label: 'Mandarina-Bavaria-Pellet-11lb' });
  });

  it('reads a price whose unit OCR mangled to "/b"', () => {
    const { rows } = parseSpotHops([...header, ...row('Huell Pellet - 11lb', 130, [[615, '$7.30/b']])]);
    expect(rows[0].prices).toEqual([{ price: 7.3, year: 2022, confidence: 95 }]);
  });

  it('never reads the header phone number as a price', () => {
    // "U.S. customers: 1.800.374.2739" sits above the table; a looser pattern
    // read it as $1.80.
    const { rows } = parseSpotHops([...header,
      ...row('U.S. customers:', 130, [[615, '1.800.374.2739']])]);
    expect(rows).toEqual([]);
  });

  // ⚠️ Regression: this is a spreadsheet print-out, and Excel puts the repeated
  // header wherever the page break leaves it. On the April 2026 list page 2 opens
  // straight into rows and doesn't print the year header until two thirds down.
  // Trusting a header only AFTER passing it dropped every row above it — Mosaic
  // among them — because their prices landed in no crop-year column at all.
  it('applies a mid-page year header to the rows printed above it', () => {
    const rows = parseSpotHops([
      ...row('Mosaic Pellet - 11lb', 40, [[615, '$1.00/lb'], [1075, '$3.00/lb']]),
      ...header,
      ...row('Simcoe Pellet - 11lb', 130, [[615, '$2.00/lb']]),
    ]).rows;
    expect(rows.map((r) => r.label)).toEqual(['Mosaic Pellet - 11lb', 'Simcoe Pellet - 11lb']);
    expect(rows[0].prices).toEqual([
      expect.objectContaining({ year: 2022, price: 1 }),
      expect.objectContaining({ year: 2024, price: 3 }),
    ]);
  });

  it('uses the ORIGIN column boundary for rows above the header too', () => {
    const rows = parseSpotHops([
      ...row('Mosaic Pellet - 11lb', 40, [[1075, '$3.00/lb']]),
      ...header,
    ]).rows;
    expect(rows[0].label).toBe('Mosaic Pellet - 11lb');
  });

  // A row still takes the NEAREST header at or above it, so a page that really
  // does change layout partway down is read correctly rather than being flattened
  // onto whichever header happened to come first.
  it('prefers the nearest header above a row when a page has several', () => {
    const shifted = [w('2030', 620, 400, { width: 40 }), w('2031', 850, 400, { width: 40 })];
    const rows = parseSpotHops([
      ...header,
      ...row('Cascade Pellet - 11lb', 130, [[615, '$1.00/lb']]),
      ...shifted,
      ...row('Citra Pellet - 11lb', 430, [[615, '$2.00/lb']]),
    ]).rows;
    expect(rows[0].prices[0].year).toBe(2022);
    expect(rows[1].prices[0].year).toBe(2030);
  });

  it('survives no words at all', () => {
    expect(parseSpotHops([]).rows).toEqual([]);
    expect(parseSpotHops(undefined).rows).toEqual([]);
  });
});

describe('parseSpotHopPages', () => {
  it('parses each page on its own, so page 2 rows do not merge into page 1 rows', () => {
    // Both pages use the same y coordinates — pooling the words first would put
    // these two varieties on one row and cross their prices.
    const page1 = [...header, ...row('Saaz Pellet - 11lb', 130, [[615, '$1.00/lb']])];
    const page2 = [...header, ...row('Simcoe Pellet - 11lb', 130, [[1075, '$2.00/lb']])];
    const { rows } = parseSpotHopPages([page1, page2]);
    expect(rows.map((r) => [r.label, r.prices])).toEqual([
      ['Saaz Pellet - 11lb', [{ price: 1, year: 2022, confidence: 95 }]],
      ['Simcoe Pellet - 11lb', [{ price: 2, year: 2024, confidence: 95 }]],
    ]);
  });

  it('handles no pages', () => {
    expect(parseSpotHopPages([]).rows).toEqual([]);
    expect(parseSpotHopPages(undefined).rows).toEqual([]);
  });
});

describe('parseSpotHopDate', () => {
  it('reads the list date out of the page header', () => {
    const page = [w('Updated', 80, 40), w('on:', 150, 40), w('July', 80, 60), w('1,', 130, 60), w('2025', 160, 60)];
    expect(parseSpotHopDate([page])).toBe('2025-07-01');
  });

  it('is null when no date was read', () => {
    expect(parseSpotHopDate([[w('no date', 10, 10)]])).toBeNull();
    expect(parseSpotHopDate(undefined)).toBeNull();
  });
});

describe('matchSpotHopPrices', () => {
  const { rows } = parseSpotHops(words);
  const find = (name) => matchSpotHopPrices(rows, [{ name, sku: 'HOP-X' }])[0];

  // Slackers buys the most recent crop, so the year comes off the LIST rather
  // than out of the catalog. Cascade is priced here for 2022 and 2024.
  it('takes the newest crop year the list carries', () => {
    expect(find('Cascade')).toMatchObject({ price: 3, year: 2024, matchedLabel: 'Cascade Pellet - 11lb' });
  });

  it('still offers the older crops as a one-click choice', () => {
    expect(find('Cascade').available.map((p) => p.year)).toEqual([2022, 2024]);
  });

  it('never takes the Cryo variant for a plain pellet', () => {
    // "Cryo Cascade" doesn't start with the variety; "Citra Cryo" does, and is
    // excluded outright — at 2x the price it would quietly wreck a batch cost.
    expect(find('Citra')).toMatchObject({ price: 4, matchedLabel: 'Citra Pellet - 11lb' });
  });

  it('never takes a 44 lb pack for an 11 lb box', () => {
    expect(find('Centennial')).toMatchObject({ price: 5, matchedLabel: 'Centennial Pellet - 11lb' });
  });

  // ⚠️ The real list carries TWO Amarillo pellet rows: a starred American/German
  // one priced across three crops, and a German one priced for the oldest crop
  // only, at a third of the money. Picking one row by shortest label landed on
  // the German one and read a two-crop-stale price as current.
  it('pools every matching row, so the newest crop wins across rows', () => {
    const two = parseSpotHops([
      ...header,
      ...row('Amarillo Pellet - 11lb', 130, [[615, '$3.99/lb']]),
      ...row('Amarillo Pellet - 11lb*', 160, [[615, '$8.99/lb'], [1075, '$11.99/lb']]),
    ]).rows;
    const [hop] = matchSpotHopPrices(two, [{ name: 'Amarillo', sku: 'HOP-AMA' }]);
    expect(hop).toMatchObject({ price: 11.99, year: 2024, matchedLabel: 'Amarillo Pellet - 11lb*' });
    // Both 2022 quotes stay visible — they disagree, and that's the brewer's call.
    expect(hop.available.filter((p) => p.year === 2022).map((p) => p.price)).toEqual([3.99, 8.99]);
  });

  it('prefills nothing when two rows disagree on the newest crop', () => {
    const clash = parseSpotHops([
      ...header,
      ...row('Simcoe Pellet - 11lb', 130, [[1075, '$10.00/lb']]),
      ...row('Simcoe Pellet - 11 lb', 160, [[1075, '$14.00/lb']]),
    ]).rows;
    const [hop] = matchSpotHopPrices(clash, [{ name: 'Simcoe', sku: 'HOP-SIM' }]);
    expect(hop).toMatchObject({ conflict: true, price: null });
    expect(hop.available.map((p) => p.price)).toEqual([10, 14]);
  });

  it('treats the same price quoted twice as agreement, not a conflict', () => {
    const dupe = parseSpotHops([
      ...header,
      ...row('Simcoe Pellet - 11lb', 130, [[1075, '$10.00/lb']]),
      ...row('Simcoe Pellet - 11 lb', 160, [[1075, '$10.00/lb']]),
    ]).rows;
    const [hop] = matchSpotHopPrices(dupe, [{ name: 'Simcoe', sku: 'HOP-SIM' }]);
    expect(hop).toMatchObject({ conflict: false, price: 10, year: 2024 });
  });

  it('sees past a stray separator-bar token glued to the front of a label', () => {
    const noisy = parseSpotHops([...header, ...row('EE Simcoe Pellet - 11lb', 130, [[1075, '$6.00/lb']])]).rows;
    expect(matchSpotHopPrices(noisy, [{ name: 'Simcoe', sku: 'HOP-SIM' }])[0])
      .toMatchObject({ price: 6 });
  });

  it('still refuses a Cryo row that reaches it through that leading token', () => {
    const noisy = parseSpotHops([...header, ...row('EE Simcoe Cryo Pellet - 11lb', 130, [[1075, '$20.00/lb']])]).rows;
    expect(matchSpotHopPrices(noisy, [{ name: 'Simcoe', sku: 'HOP-SIM' }])[0].price).toBeNull();
  });

  it('excludes a 44 lb pack even when OCR reads it as "441b"', () => {
    const rows44 = parseSpotHops([...header, ...row('Willamette Pellet - 441b', 130, [[1075, '$7.00/lb']])]).rows;
    expect(matchSpotHopPrices(rows44, [{ name: 'Willamette', sku: 'HOP-WIL' }])[0].price).toBeNull();
  });

  it('matches a variety whose capital I came back as a lowercase l', () => {
    const ocr = parseSpotHops([...header, ...row('ldaho 7 Pellet - 11lb', 130, [[615, '$5.99/lb']])]).rows;
    expect(matchSpotHopPrices(ocr, [{ name: 'Idaho 7', sku: 'HOP-IDA7' }])[0])
      .toMatchObject({ price: 5.99, year: 2022 });
  });

  it('flags a row whose prices landed in the same column, and prefills nothing', () => {
    // A misread year header shifts the boundaries and two prices fall under one
    // year. Offering either as "the 2023 price" would be a confident lie.
    const bad = [...header, ...row('Simcoe Pellet - 11lb', 130, [[860, '$12.60/lb'], [880, '$13.99/lb']])];
    const rows2 = parseSpotHops(bad).rows;
    expect(rows2[0].ambiguous).toBe(true);
    const hop = matchSpotHopPrices(rows2, [{ name: 'Simcoe', sku: 'HOP-SIM' }])[0];
    expect(hop).toMatchObject({ ambiguous: true, price: null });
  });

  // The list carries a CO2 extract block priced per CAN. Shortest-label-wins
  // already prefers the pellet row while both are printed; this is the month
  // where only the extract is, and a $44 can must not become a $44/lb hop.
  it('never takes a CO2 extract row for a pellet', () => {
    const extractOnly = parseSpotHops([
      ...header,
      ...row('Simcoe - CO2 Hop Extract (150 GMA)', 130, [[1075, '$44.00/lb']]),
    ]).rows;
    const [hop] = matchSpotHopPrices(extractOnly, [{ name: 'Simcoe', sku: 'HOP-SIM' }]);
    expect(hop.matchedLabel).toBeNull();
    expect(hop.price).toBeNull();
  });

  it('reports an unmatched hop rather than dropping it', () => {
    expect(find('Mosaic')).toMatchObject({ name: 'Mosaic', matchedLabel: null, price: null, available: [] });
  });

  it('defaults to the hops in the product catalog', () => {
    const names = ourHops().map((h) => h.name);
    expect(names).toContain('Cascade');
    expect(ourHops().find((h) => h.name === 'Cascade').sku).toBe('HOP-CAS');
  });
});
