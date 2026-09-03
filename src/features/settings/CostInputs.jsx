import { useMemo } from "react";
import { OVERHEAD_FIELDS, annualCapacity, annualLabor, annualVolume, costInputs, defCosts, missingInputs, overheadHint, overheadLabel } from "../../lib/overhead";
import { parseNum } from "../../lib/overhead";
import { deductions, pourFor, servingsOf } from "../../lib/menuPricing";
import PriceInput from "../../components/PriceInput";
import { card, hdr, inp, btn } from "../../styles";

// Settings ▸ Operating Costs: every input behind the overhead and pricing model
// that isn't already an ingredient price or a batch volume.
//
// Two conventions carried over from the rest of the tab:
//
//   * An empty field means "use the brewery default", shown as the placeholder,
//     never zero. The exception is the monthly overhead block, where empty means
//     UNCONFIRMED — there is no sensible default for someone's rent, so those
//     ship blank, are flagged, and are left OUT of any total until entered.
//   * The basis is printed on screen. A derived figure that only exists inside
//     the model is how Settings and the Cost panel came to disagree by a third
//     of the cost per barrel (see lib/overhead.js).

const money = (n) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);
// Whole dollars are right for a year of rent and wrong for what comes off one
// pint, where the whole figure is cents.
const cents = (n) => (n == null ? "—" : `$${n.toFixed(2)}`);
// "a $8.00 pint" is read aloud as "a eight dollar pint". Eight and eleven are
// the two leading digits that take "an".
const article = (n) => (n != null && /^(8|11)/.test(String(n)) ? "an" : "a");

const label = { fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" };
const fieldWrap = { display: "flex", flexDirection: "column", gap: 4 };
const row = { display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 4 };
const note = { margin: "0 0 12px", fontSize: 13, color: "#64748b" };
const basis = { margin: "12px 0 0", fontSize: 12, color: "#94a3b8" };

// One labelled numeric input. `unconfirmed` turns the field amber and drops the
// placeholder, because a placeholder there would read as a default that is
// being used when nothing is being used at all.
function Num({ id, text, hint, value, onChange, placeholder, width = 104, step = "any", prefix, suffix, unconfirmed }) {
  return (
    <div style={fieldWrap}>
      <label style={{ ...label, color: unconfirmed ? "#b45309" : label.color }} htmlFor={id}>{text}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {prefix && <span style={{ fontSize: 13, color: "#94a3b8" }}>{prefix}</span>}
        <input id={id} type="number" step={step} min="0"
          style={{ ...inp, width, ...(unconfirmed ? { borderColor: "#fbbf24", background: "#fffbeb" } : null) }}
          value={value ?? ""} placeholder={unconfirmed ? "not set" : placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value)} />
        {suffix && <span style={{ fontSize: 13, color: "#94a3b8" }}>{suffix}</span>}
      </div>
      {/* Printed, not tucked in a title attribute: the one field whose meaning
          this hint carries was mis-entered precisely because nothing on screen
          said what it excluded. */}
      {hint && <div id={`${id}-hint`} style={{ fontSize: 11, color: "#94a3b8", maxWidth: 200 }}>{hint}</div>}
    </div>
  );
}

export default function CostInputs({ settings, setSettings }) {
  const stored = settings?.costs || {};
  const c = costInputs(settings);
  const missing = missingInputs(settings);

  const setCost = (key, value) =>
    setSettings((p) => ({ ...p, costs: { ...(p.costs || {}), [key]: value } }));

  const setFermenter = (i, patch) =>
    setSettings((p) => {
      const list = (p.costs?.fermenters || defCosts.fermenters).map((f, idx) => (idx === i ? { ...f, ...patch } : f));
      return { ...p, costs: { ...(p.costs || {}), fermenters: list } };
    });

  const addFermenter = () =>
    setSettings((p) => {
      const list = [...(p.costs?.fermenters || defCosts.fermenters), { label: "New tank", gal: 125 }];
      return { ...p, costs: { ...(p.costs || {}), fermenters: list } };
    });

  const rmFermenter = (i) =>
    setSettings((p) => {
      const list = (p.costs?.fermenters || defCosts.fermenters).filter((_, idx) => idx !== i);
      return { ...p, costs: { ...(p.costs || {}), fermenters: list } };
    });

  const setServing = (i, patch) =>
    setSettings((p) => {
      // Resolved through costInputs() rather than read raw, so the first edit to
      // a board still on the shipped defaults writes the whole list rather than
      // one orphaned row.
      const list = costInputs(p).servings.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
      return { ...p, costs: { ...(p.costs || {}), servings: list } };
    });

  const addServing = () =>
    setSettings((p) => {
      const list = costInputs(p).servings;
      // A key that can't collide with an existing one, since `defaultServing`
      // and every per-beer pour are matched on it.
      const key = `size${Date.now().toString(36)}`;
      return { ...p, costs: { ...(p.costs || {}), servings: [...list, { key, label: "New size", oz: 16, price: null }] } };
    });

  const rmServing = (i) =>
    setSettings((p) => {
      const list = costInputs(p).servings.filter((_, idx) => idx !== i);
      return { ...p, costs: { ...(p.costs || {}), servings: list } };
    });

  const v = useMemo(() => annualVolume({ settings }), [settings]);
  const cap = useMemo(() => annualCapacity({ settings }), [settings]);
  const labor = useMemo(() => annualLabor({ settings }), [settings]);

  // The house pour, priced. Shown instead of a hardcoded $8.00 pint so the
  // preview describes the brewery's actual board rather than an example of one.
  const housePour = useMemo(() => pourFor(null, settings), [settings]);
  const preview = useMemo(() => {
    const size = servingsOf(settings).find((s) => s.oz === housePour.oz);
    return deductions({ settings, price: size?.price ?? null, oz: housePour.oz });
  }, [settings, housePour]);

  const num = (key, extra = {}) => ({
    id: `cost-${key}`,
    value: stored[key],
    onChange: (val) => setCost(key, val),
    placeholder: String(defCosts[key]),
    ...extra,
  });

  return (
    <>
      {missing.length > 0 && (
        <div style={{ ...card, borderColor: "#fbbf24", background: "#fffbeb" }}>
          <div style={{ padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
            <strong>{missing.length} operating cost{missing.length > 1 ? "s" : ""} not entered yet</strong> —{" "}
            {missing.map(overheadLabel).join(", ")}.
            They're left out of the cost per pint rather than counted as zero, so the real cost
            is higher than anything shown until they're filled in.
          </div>
        </div>
      )}

      <div style={card}>
        <div style={hdr}>🏗️ Production & Capacity</div>
        <div style={{ padding: 16 }}>
          <p style={note}>
            How much beer a year, and how much the tanks could carry. ⚠️ Tank volumes are{" "}
            <strong>actual working gallons</strong>, not the nameplate rating — your vessels are
            sold as 3.5 and 7 BBL but are filled past that, and deriving anything from "3.5"
            would understate the brewery by a third.
          </p>
          <div style={row}>
            <Num {...num("batchesPerYear")} text="Batches per year" width={90} step="1" />
            <Num {...num("intoFermenterGal")} text="Into fermenter" width={90} suffix="gal" />
            <Num {...num("turnWeeks")} text="Avg fermenter turn" width={80} step="0.5" suffix="wks" />
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ ...label, marginBottom: 6 }}>Fermenters (working volume)</div>
            {c.fermenters.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input style={{ ...inp, width: 150, textAlign: "left" }} value={f.label ?? ""}
                  aria-label={`Fermenter ${i + 1} name`}
                  onChange={(e) => setFermenter(i, { label: e.target.value })} />
                <input style={{ ...inp, width: 80 }} type="number" min="0" value={f.gal ?? ""}
                  aria-label={`Fermenter ${i + 1} gallons`}
                  onChange={(e) => setFermenter(i, { gal: e.target.value })} />
                <span style={{ fontSize: 12, color: "#94a3b8" }}>gal</span>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16 }}
                  aria-label={`Remove fermenter ${i + 1}`} onClick={() => rmFermenter(i)}>×</button>
              </div>
            ))}
            <button style={btn} onClick={addFermenter}>+ Add fermenter</button>
          </div>

          <p style={basis}>
            {v.batches} batches × {v.packagedGalPerBatch.toFixed(1)} gal packaged ={" "}
            <strong>{v.packagedBbl.toFixed(0)} bbl</strong> a year. Tanks hold {cap.tankGal} gal at
            once and turn every {c.turnWeeks} weeks ≈ <strong>{cap.capacityBbl.toFixed(0)} bbl</strong>{" "}
            of capacity, so you're running at{" "}
            <strong>{cap.utilizationPct == null ? "—" : `${cap.utilizationPct.toFixed(0)}%`}</strong> of it.
          </p>
          <p style={{ ...basis, marginTop: 4 }}>
            Losses: {v.kettleLossPct?.toFixed(1)}% in the kettle, then {v.cellarLossPct?.toFixed(1)}%
            in the cellar.
          </p>
        </div>
      </div>

      <div style={card}>
        <div style={hdr}>🍺 Taproom Losses</div>
        <div style={{ padding: 16 }}>
          <p style={note}>
            Beer you packaged but never sold. This is what makes the denominator{" "}
            <strong>pints sold</strong> rather than pints brewed — dividing a cost by beer that
            went down the drain is the classic way to understate it.
          </p>
          <div style={row}>
            <Num {...num("linePct")} text="Draft line & foam" width={70} suffix="%" />
            <Num {...num("compsPct")} text="Comps & staff pours" width={70} suffix="%" />
          </div>
          <p style={basis}>
            {Math.round(v.pintsPackaged).toLocaleString()} pints packaged less{" "}
            {v.lossToPourPct.toFixed(1)}% ={" "}
            <strong>{Math.round(v.pintsSold).toLocaleString()} pints sold</strong> a year (≈{" "}
            {Math.round(v.pintsSold / 12).toLocaleString()} a month).
          </p>
        </div>
      </div>

      <div style={card}>
        <div style={hdr}>👷 Production Labor</div>
        <div style={{ padding: 16 }}>
          <p style={note}>
            Brewery hours, which stay roughly the same whether a week holds one brew or two —
            that's why brewing more spreads this cost rather than adding to it.{" "}
            <strong>Tips are not an employer cost</strong> and are not in COGS; the only thing
            charged here is the employer's {7.65}% FICA on the tip share.
          </p>
          <div style={row}>
            <Num {...num("brewerRate")} text="Brewer rate" width={80} prefix="$" suffix="/hr" />
            <Num {...num("brewerHrsWeek")} text="Brewer hours" width={70} suffix="/wk" />
            <Num {...num("cellarRate")} text="Cellar rate" width={80} prefix="$" suffix="/hr" />
            <Num {...num("cellarHrsWeek")} text="Cellar hours" width={70} suffix="/wk" />
          </div>
          <div style={{ ...row, marginTop: 10 }}>
            <Num {...num("burdenPct")} text="Payroll burden" width={70} suffix="%" />
            <Num {...num("tipShareRate")} text="Tip share earned" width={80} prefix="$" suffix="/hr" />
          </div>
          <p style={basis}>
            {money(labor.base)} base + {money(labor.burden)} burden + {money(labor.tipFica)} FICA on
            tips = <strong>{money(labor.total)}</strong> a year.
          </p>
        </div>
      </div>

      <div style={card}>
        <div style={hdr}>🏠 Monthly Overhead</div>
        <div style={{ padding: 16 }}>
          <p style={note}>
            The cost of being open, which doesn't care how much beer got brewed. Anything left
            blank is treated as <strong>unknown, not free</strong> — it's named above and left out
            of the totals, because a cost per pint computed with no rent in it is worse than an
            obviously incomplete one.
          </p>
          <div style={{ ...row, alignItems: "flex-start" }}>
            {OVERHEAD_FIELDS.map(([key, text]) => (
              <Num key={key} {...num(key)} text={text} hint={overheadHint(key)} width={100} prefix="$"
                unconfirmed={missing.includes(key)} />
            ))}
          </div>
          {/* The double-count made visible rather than guessed at. No heuristic
              can tell from the number alone whether brewer hours are inside the
              FOH figure, but a total payroll that looks wrong on this line is
              something the brewery can recognize on sight. */}
          <p style={basis}>
            {c.fohPayroll == null
              ? <>Production labor is already {money(labor.total)} a year on its own. When you fill
                in FOH payroll, make sure it <strong>excludes</strong> the brewer and cellar hours —
                they're counted above and would otherwise be charged twice.</>
              : <>Payroll altogether: {money(c.fohPayroll * 12)} front of house +{" "}
                {money(labor.total)} production ={" "}
                <strong>{money(c.fohPayroll * 12 + labor.total)}</strong> a year. If that reads
                high, check that the FOH figure isn't already carrying the brewer and cellar
                hours.</>}
          </p>
        </div>
      </div>

      <div style={card}>
        <div style={hdr}>🍻 The Board</div>
        <div style={{ padding: 16 }}>
          <p style={note}>
            What a beer is sold as, and for how much. Sizes are brewery-wide;{" "}
            <strong>which size a given beer pours at is a property of that beer</strong> and is set
            on its row in <strong>Analytics ▸ Pricing</strong> — a 9% tripel poured at 8 oz is a
            fact about the tripel, not an exception in the pricing code. A blank price is a size
            you don't sell yet, not a free one.
          </p>
          {c.servings.map((s, i) => (
            <div key={s.key ?? i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input style={{ ...inp, width: 150, textAlign: "left" }} value={s.label ?? ""}
                aria-label={`Serving ${i + 1} name`}
                onChange={(e) => setServing(i, { label: e.target.value })} />
              <input style={{ ...inp, width: 62 }} type="number" min="0" step="0.5" value={s.oz ?? ""}
                aria-label={`Serving ${i + 1} ounces`}
                onChange={(e) => setServing(i, { oz: e.target.value })} />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>oz</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>$</span>
              {/* The same field the Cost views use, for the same reason: a price
                  displayed as toFixed(2) cannot be a plain controlled input.
                  ⚠️ Parsed, not tested for finiteness: `c.servings` is the array
                  branch of costInputs(), which hands back what is STORED, and a
                  price this field just wrote is the string "9.00". A bare
                  Number.isFinite() reads that as unset, so the row went blank on
                  blur while holding a perfectly good price. */}
              <PriceInput value={parseNum(s.price)} style={{ width: 68 }}
                aria-label={`Serving ${i + 1} price`}
                onCommit={(v) => setServing(i, { price: v === "" ? null : v })} />
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16 }}
                aria-label={`Remove serving ${i + 1}`} onClick={() => rmServing(i)}>×</button>
            </div>
          ))}
          <button style={btn} onClick={addServing}>+ Add size</button>

          <div style={{ ...row, marginTop: 14 }}>
            <div style={fieldWrap}>
              <label style={label} htmlFor="cost-defaultServing">House pour</label>
              <select id="cost-defaultServing" style={{ ...inp, width: 170, textAlign: "left" }}
                value={c.defaultServing}
                onChange={(e) => setCost("defaultServing", e.target.value)}>
                {c.servings.map((s, i) => (
                  <option key={s.key ?? i} value={s.key}>{s.label} — {s.oz} oz</option>
                ))}
              </select>
            </div>
            <Num {...num("targetMarginPct")} text="Target margin" width={70} suffix="%" />
          </div>
          <p style={basis}>
            The size every beer pours at unless its own recipe says otherwise, and the margin{" "}
            <strong>Analytics ▸ Pricing</strong> solves its recommended prices for. Margin is on{" "}
            <strong>net</strong> revenue — after tax, card fees and excise — not on the menu price.
          </p>
        </div>
      </div>

      <div style={card}>
        <div style={hdr}>🧾 Price Deductions</div>
        <div style={{ padding: 16 }}>
          <p style={note}>
            What comes off a retail price before any cost is paid. Your permit type is the big
            one: a mixed beverage permit owes 6.7% gross receipts on top of everything else,
            which on an $8 pint is more than most of your beers cost in ingredients. Excise
            rates are inputs rather than built in — confirm them with your accountant.
          </p>
          <div style={row}>
            <div style={fieldWrap}>
              <label style={label} htmlFor="cost-permitType">Permit type</label>
              <select id="cost-permitType" style={{ ...inp, width: 210, textAlign: "left" }}
                value={c.permitType}
                onChange={(e) => setCost("permitType", e.target.value)}>
                <option value="bg">Wine &amp; Beer / On-Premise — sales tax only</option>
                <option value="mb">Mixed Beverage — plus 6.7% gross receipts</option>
              </select>
            </div>
            {/* ⚠️ Worth $0.61 on an $8.00 pint at 8.25%, which is most of a
                pint's entire contribution. It was implicit in the old preview
                string, which quietly assumed tax was added on top. */}
            <div style={fieldWrap}>
              <label style={label} htmlFor="cost-taxBasis">Board prices</label>
              <select id="cost-taxBasis" style={{ ...inp, width: 210, textAlign: "left" }}
                value={c.taxBasis}
                onChange={(e) => setCost("taxBasis", e.target.value)}>
                <option value="included">Include sales tax — $8.00 is what they pay</option>
                <option value="added">Exclude it — tax is added at the register</option>
              </select>
            </div>
            <Num {...num("cardPct")} text="Card processing" width={70} suffix="%" />
          </div>
          <div style={{ ...row, marginTop: 10 }}>
            <Num {...num("exciseStateBbl")} text="TX excise" width={80} prefix="$" suffix="/bbl" />
            <Num {...num("exciseFedBbl")} text="Federal excise" width={80} prefix="$" suffix="/bbl" />
            <Num {...num("mbGrtPct")} text="Mixed bev. receipts" width={70} suffix="%" />
            <Num {...num("salesTaxPct")} text="Sales tax" width={70} suffix="%" />
          </div>
          {/* ⚠️ This line used to do the tax arithmetic by hand, and it was the
              only consumer these inputs had. It now calls the same
              `deductions()` the Pricing view prices every beer with, so the
              preview here and the board there cannot disagree — the drift this
              repo keeps designing out (OVERHEAD_FIELDS, batchVolume, costInputs). */}
          <p style={basis}>
            {preview.price == null
              ? <>Set a price on the {housePour.label} in <strong>The Board</strong> above to see
                what comes off it.</>
              : <>On {article(preview.price)} {cents(preview.price)} {housePour.label}:{" "}
                {cents(preview.salesTax)} sales
                tax{c.permitType === "mb" && <> + {cents(preview.grt)} gross receipts</>}{" "}
                + {cents(preview.card)} card + {cents(preview.excise)} excise ={" "}
                <strong>{cents(preview.net)}</strong> reaching the brewery.
                {c.permitType !== "mb" && " No gross receipts tax on this permit."}</>}
          </p>
        </div>
      </div>
    </>
  );
}
