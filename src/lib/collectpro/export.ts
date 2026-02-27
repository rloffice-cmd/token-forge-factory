// ─────────────────────────────────────────────────────────────────────────────
// CollectPro — Export utilities
// ─────────────────────────────────────────────────────────────────────────────

import type { CollectionItem, Partner } from "./types";

// ── Shared helpers ─────────────────────────────────────────────────────────

function esc(cell: string): string {
  const s = String(cell ?? "").replace(/\n/g, " ");
  return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel Hebrew
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Standard CSV export (full portfolio) ───────────────────────────────────

const STD_HEADERS = [
  "שם","סט","פרנצ'ייז","מצב","סטטוס","שותף",
  "תאריך קנייה","קנייה ($)","גריידינג ($)",
  "הערכת שוק ($)","מחיר מכירה ($)","תאריך מכירה",
  "ציון PSA","הערות",
];

function stdRow(i: CollectionItem, partnerName: string): string[] {
  return [
    i.name, i.card_set ?? "", i.franchise ?? "", i.condition, i.status,
    partnerName, i.buy_date,
    String(i.buy_price), String(i.grading_cost ?? 0),
    i.market_price != null ? String(i.market_price) : "",
    i.sell_price   != null ? String(i.sell_price)   : "",
    i.sold_at ? i.sold_at.slice(0, 10) : "",
    i.psa_grade != null ? String(i.psa_grade) : "",
    (i.notes ?? "").replace(/,/g, ";"),
  ];
}

export function exportCSV(items: CollectionItem[], partners: Partner[], filename?: string) {
  const name = (id: string) => partners.find((p) => p.id === id)?.name ?? id;
  const rows  = [STD_HEADERS, ...items.map((i) => stdRow(i, name(i.partner_id)))];
  download(rows.map((r) => r.map(esc).join(",")).join("\r\n"), filename ?? `collectpro-${today()}.csv`);
}

// ── eBay Bulk Upload CSV ─────────────────────────────────────────────────────
// Format compatible with eBay File Exchange / Bulk Upload tool.
// https://pages.ebay.com/sell/bulkmanagement/

const EBAY_HEADERS = [
  "*Action","*Category","*Title","*ConditionID",
  "*Quantity","StartPrice","*Currency","*Duration",
  "*Location","BuyItNowPrice","Description","PicURL",
];

// eBay condition IDs: 1000=New, 2500=Like New, 3000=Very Good, 4000=Good, 5000=Acceptable
const COND_ID: Record<string, string> = {
  M: "1000", NM: "2500", LP: "3000", MP: "4000", HP: "5000", D: "5000", PSA: "2750",
};

// TCG category IDs on eBay:
const CATEGORY: Record<string, string> = {
  pokemon:  "183454", // Pokémon Individual Cards
  onepiece: "261068", // Trading Card Games → One Piece
  default:  "2536",   // Trading Card Games (generic)
};

function ebayCategory(franchise?: string): string {
  const f = (franchise ?? "").toLowerCase();
  if (f.includes("pokemon") || f.includes("pokémon")) return CATEGORY.pokemon;
  if (f.includes("one piece") || f.includes("onepiece")) return CATEGORY.onepiece;
  return CATEGORY.default;
}

function ebayTitle(i: CollectionItem): string {
  const parts = [i.name];
  if (i.card_set)  parts.push(i.card_set);
  if (i.psa_grade) parts.push(`PSA ${i.psa_grade}`);
  else             parts.push(i.condition);
  parts.push("TCG Card");
  return parts.join(" - ").slice(0, 80); // eBay title max 80 chars
}

function ebayDesc(i: CollectionItem): string {
  const lines = [
    `Card: ${i.name}`,
    i.card_set    ? `Set: ${i.card_set}`       : "",
    i.franchise   ? `Game: ${i.franchise}`      : "",
    `Condition: ${i.condition}`,
    i.psa_grade   ? `PSA Grade: ${i.psa_grade}` : "",
    i.notes       ? `Notes: ${i.notes}`         : "",
    "---",
    "Fast shipping · Tracked · Secure packaging",
  ].filter(Boolean);
  return lines.join(" | ");
}

function ebayRow(i: CollectionItem): string[] {
  // Suggested sale price = market_price if available, else buy_price × 1.3
  const price = i.market_price ?? Math.round(+i.buy_price * 1.3 * 100) / 100;
  return [
    "Add",
    ebayCategory(i.franchise),
    ebayTitle(i),
    COND_ID[i.condition] ?? "3000",
    "1",
    String(price),
    "USD",
    "GTC",          // Good Till Cancelled
    "IL",           // Location (change to your country if needed)
    String(price),  // BuyItNow = StartPrice (fixed price listing)
    ebayDesc(i),
    i.image_url?.startsWith("http") ? i.image_url : "", // only external URLs
  ];
}

export function exportEbayCSV(items: CollectionItem[], filename?: string) {
  const active = items.filter((i) => i.status !== "sold");
  const rows   = [EBAY_HEADERS, ...active.map(ebayRow)];
  download(rows.map((r) => r.map(esc).join(",")).join("\r\n"), filename ?? `ebay-bulk-${today()}.csv`);
}

// ── Cardmarket / MCM CSV ─────────────────────────────────────────────────────
// Simple format for manual upload to Cardmarket seller interface

const CM_HEADERS = ["Name","Expansion","Condition","Quantity","Price","Language","Comment"];

const CM_COND: Record<string, string> = {
  M: "M", NM: "NM", LP: "EX", MP: "GD", HP: "PL", D: "PO", PSA: "NM",
};

export function exportCardmarketCSV(items: CollectionItem[], filename?: string) {
  const active = items.filter((i) => i.status !== "sold");
  const rows   = [
    CM_HEADERS,
    ...active.map((i) => [
      i.name, i.card_set ?? "", CM_COND[i.condition] ?? "NM",
      "1",
      String(i.market_price ?? Math.round(+i.buy_price * 1.25 * 100) / 100),
      "English",
      (i.notes ?? "").replace(/,/g, ";").slice(0, 100),
    ]),
  ];
  download(rows.map((r) => r.map(esc).join(",")).join("\r\n"), filename ?? `cardmarket-${today()}.csv`);
}

function today() { return new Date().toISOString().slice(0, 10); }
