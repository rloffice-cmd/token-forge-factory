// ─────────────────────────────────────────────────────────────────────────────
// CollectPro — CSV export
// ─────────────────────────────────────────────────────────────────────────────

import type { CollectionItem, Partner } from "./types";

const HEADERS = [
  "שם", "סט", "פרנצ'ייז", "מצב", "סטטוס", "שותף",
  "תאריך קנייה", "קנייה ($)", "גריידינג ($)",
  "הערכת שוק ($)", "מחיר מכירה ($)", "תאריך מכירה",
  "ציון PSA", "הערות",
];

function row(i: CollectionItem, partnerName: string): string[] {
  return [
    i.name,
    i.card_set  ?? "",
    i.franchise ?? "",
    i.condition,
    i.status,
    partnerName,
    i.buy_date,
    String(i.buy_price),
    String(i.grading_cost ?? 0),
    i.market_price != null ? String(i.market_price) : "",
    i.sell_price   != null ? String(i.sell_price)   : "",
    i.sold_at ? i.sold_at.slice(0, 10) : "",
    i.psa_grade != null ? String(i.psa_grade) : "",
    (i.notes ?? "").replace(/,/g, ";"),
  ];
}

function escape(cell: string): string {
  return cell.includes(",") || cell.includes('"') || cell.includes("\n")
    ? `"${cell.replace(/"/g, '""')}"`
    : cell;
}

export function exportCSV(items: CollectionItem[], partners: Partner[], filename?: string) {
  const nameOf = (id: string) => partners.find((p) => p.id === id)?.name ?? id;
  const lines  = [
    HEADERS.join(","),
    ...items.map((i) => row(i, nameOf(i.partner_id)).map(escape).join(",")),
  ];
  const csv  = "\uFEFF" + lines.join("\r\n"); // BOM for Excel Hebrew support
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename ?? `collectpro-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
