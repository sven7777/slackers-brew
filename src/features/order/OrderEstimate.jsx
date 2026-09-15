import { useEffect, useMemo, useState } from "react";
import { load as loadKey } from "../../lib/repo";
import { buildOrderEstimate, orderEmailText, orderFeeLabel } from "../../lib/orderCost";
import { card, hdr, th, cell, num, btn, badge } from "../../styles";

// What the order costs, and the list to paste into the email.
//
// The tables above this say how much of each ingredient is needed. This says
// what buying it comes to — and it is a different arithmetic, because you buy
// whole sacks and the vendor merges the two names that are one sack. All of
// that lives in lib/orderCost.js; this renders it.
//
// The catalog is loaded HERE, not from App state, for the same reason
// CatalogBrowser loads it: hundreds of rows that only a few panels need. It is
// what prices an ADOPTED ingredient — products.js has never heard of one.
export default function OrderEstimate({ order, malts, hops, yeast, adj, settings }) {
  const [catalog, setCatalog] = useState({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.resolve(loadKey("catalog", []))
      .then((v) => {
        if (!alive) return;
        const rows = Array.isArray(v) ? v : [];
        setCatalog(Object.fromEntries(rows.map((e) => [e.sku, e])));
      })
      .catch(() => { if (alive) setCatalog({}); });
    return () => { alive = false; };
  }, []);

  const est = useMemo(
    () => buildOrderEstimate({ order, inventory: { malts, hops, yeast, adj }, catalog, settings }),
    [order, malts, hops, yeast, adj, catalog, settings],
  );

  const email = useMemo(() => orderEmailText(est), [est]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!est.sections.length) return null;

  // An order runs to four figures where a recipe's COGS runs to three, so the
  // separator earns its place here: $1434.17 and $14341.70 differ by one glyph.
  const money = (n) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ ...card, marginBottom: 12 }}>
      <div style={{ ...hdr, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>💵 Estimated Cost</span>
        {est.floor && <span style={{ ...badge, background: "#fef2f2", color: "#dc2626" }}>Incomplete</span>}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
          <thead>
            <tr>
              <th style={th}>Ingredient</th>
              <th style={{ ...th, textAlign: "right" }}>Order</th>
              <th style={{ ...th, textAlign: "right" }}>Packs</th>
              <th style={{ ...th, textAlign: "right" }}>$/pack</th>
              <th style={{ ...th, textAlign: "right" }}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {est.sections.map((s) => (
              <Section key={s.key} section={s} money={money} />
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #e2e8f0", fontWeight: 700 }}>
              <td style={cell} colSpan={4}>Ingredients subtotal</td>
              <td style={num}>{money(est.subtotal)}{est.floor ? "+" : ""}</td>
            </tr>
            {/* The invoice's own shape, line for line: goods, then what the
                vendor adds under them, then the total. Reading the estimate
                against a real BSG invoice is the point. */}
            {est.fees.lines.map((f) => (
              <tr key={f.key}>
                <td style={{ ...cell, color: "#64748b" }} colSpan={4}>{f.label}</td>
                <td style={{ ...num, color: f.amount == null ? "#b45309" : "#64748b" }}>
                  {f.amount == null ? "not set" : money(f.amount)}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: "1px solid #e2e8f0", fontWeight: 700 }}>
              <td style={cell} colSpan={4}>Estimated total</td>
              <td style={num}>{money(est.total)}{est.totalFloor ? "+" : ""}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ padding: "8px 10px", borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b" }}>
        {/* The app's own rule: a total built on a missing input is a FLOOR and
            says so, rather than reading as the whole number. */}
        {est.unpriced.length > 0 && (
          <p style={{ margin: "0 0 4px" }}>
            <strong>{est.unpriced.length} unpriced</strong> — {est.unpriced.join(", ")}. Left out of the
            subtotal rather than costed at $0; price them in Settings ▸ Ingredient Prices or a recipe's Cost view.
          </p>
        )}
        {est.nopack.length > 0 && (
          <p style={{ margin: "0 0 4px" }}>
            <strong>{est.nopack.length} with no vendor product</strong> — {est.nopack.join(", ")}.
            Link the row to a product on the Inventory tab to count and cost it.
          </p>
        )}
        <p style={{ margin: "0 0 4px" }}>
          Whole packs: 40 lbs of a malt is one 55 lb sack and costs a whole sack. Two ingredient names
          that are one vendor product are merged into one line.
        </p>
        {est.fees.missing.length > 0 && (
          <p style={{ margin: "0 0 4px" }}>
            <strong>{est.fees.missing.length} order fee{est.fees.missing.length > 1 ? "s" : ""} not
            entered</strong> — {est.fees.missing.map(orderFeeLabel).join(", ")}. On a real BSG
            invoice these run to about 15% of a $1,200 order, so the total is a floor until they're
            filled in under <strong>Settings ▸ Order Fees</strong> (enter <strong>0</strong> for
            anything you're never charged).
          </p>
        )}
        <p style={{ margin: 0 }}>
          Pack prices are derived from the stored per-unit price, which is rounded to the cent, so a
          sack can be off by a quarter. Freight is billed per shipment, not per pound — one large
          order pays it once where two small ones pay it twice. No sales tax line: ingredients
          bought for resale are mostly exempt, so an invoice's tax is usually a few dollars on
          something incidental.
        </p>
      </div>

      <div style={{ padding: 10, borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
        <button style={btn} onClick={copy}>{copied ? "Copied ✓" : "Copy for email"}</button>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>Plain text: pack count, ingredient, pack size.</span>
      </div>
      {/* Shown, not hidden behind the button: the brewer is pasting this into a
          mail to a vendor, and "what exactly did it copy" is worth one glance. */}
      <pre style={{
        margin: "0 10px 10px", padding: 10, fontSize: 12, color: "#475569",
        background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6,
        maxHeight: 260, overflowY: "auto",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", whiteSpace: "pre-wrap",
      }}>{email}</pre>
    </div>
  );
}

// One category's rows, under a label. A section header inside the table body
// keeps the five columns aligned across all four categories — four tables
// side by side would each size their own columns.
function Section({ section, money }) {
  return (
    <>
      <tr>
        <td style={{ ...cell, fontWeight: 700, background: "#f8fafc" }} colSpan={5}>{section.label}</td>
      </tr>
      {section.lines.map((l) => (
        <tr key={l.sku ?? l.name}>
          <td style={cell}>
            {l.name}
            {l.names.length > 1 && (
              <span style={{ color: "#94a3b8", fontSize: 11, display: "block" }}>one product, two names</span>
            )}
          </td>
          <td style={num}>{l.qty} {l.unit}</td>
          <td style={num}>{l.packs != null ? `${l.packs} × ${l.packLabel}` : "—"}</td>
          <td style={num}>{l.packPrice != null ? money(l.packPrice) : "—"}</td>
          <td style={{ ...num, fontWeight: 600 }}>
            {l.cost != null ? money(l.cost) : <span style={{ color: "#dc2626", fontWeight: 400 }}>{l.reason}</span>}
          </td>
        </tr>
      ))}
    </>
  );
}
