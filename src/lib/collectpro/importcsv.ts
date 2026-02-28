// ─────────────────────────────────────────────────────────────────────────────
// CollectPro — CSV Import utility
// Parses files exported by exportCSV() back into structured rows.
// ─────────────────────────────────────────────────────────────────────────────

import type { ItemStatus, Partner } from "./types";

// ── Minimal RFC-4180-compliant single-line CSV parser ─────────────────────

function parseRow(line: string): string[] {
  const cells: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      // Quoted field
      i++;
      let cell = "";
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          cell += '"'; i += 2;
        } else if (line[i] === '"') {
          i++; break;
        } else {
          cell += line[i++];
        }
      }
      cells.push(cell);
      if (line[i] === ",") i++;
    } else {
      // Unquoted field
      const end = line.indexOf(",", i);
      if (end === -1) { cells.push(line.slice(i)); break; }
      cells.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return cells;
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface ParsedImportRow {
  name:         string;
  card_set:     string;
  franchise:    string;
  condition:    string;
  status:       ItemStatus;
  partner_name: string;
  buy_date:     string;
  buy_price:    number;
  grading_cost: number;
  market_price: number | null;
  sell_price:   number | null;
  sold_at:      string | null;
  psa_grade:    number | null;
  notes:        string;
  error?:       string;
}

export interface ItemInsertRow {
  id:           string;
  name:         string;
  card_set:     string | null;
  franchise:    string | null;
  condition:    string;
  status:       ItemStatus;
  partner_id:   string;
  buy_date:     string;
  buy_price:    number;
  grading_cost: number;
  market_price: number | null;
  sell_price:   number | null;
  sold_at:      string | null;
  psa_grade:    number | null;
  notes:        string | null;
  image_url:    null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_CONDITIONS = new Set(["M", "NM", "LP", "MP", "HP", "D", "PSA"]);
const VALID_STATUSES   = new Set<string>(["active", "grading", "sold"]);

function toNum(s: string): number | null {
  if (!s?.trim()) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function toDate(s: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(s?.trim() ?? "") ? s.trim() : null;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── parseImportCSV ────────────────────────────────────────────────────────────
/**
 * Parse a CSV string (BOM-safe) exported by exportCSV().
 *
 * Column order (matches STD_HEADERS in export.ts):
 * 0: שם (name)          1: סט (card_set)       2: פרנצ'ייז (franchise)
 * 3: מצב (condition)    4: סטטוס (status)      5: שותף (partner_name)
 * 6: תאריך קנייה (buy_date)
 * 7: קנייה ($)          8: גריידינג ($)        9: הערכת שוק ($)
 * 10: מחיר מכירה ($)   11: תאריך מכירה        12: ציון PSA
 * 13: הערות (notes)
 */
export function parseImportCSV(rawText: string): ParsedImportRow[] {
  // Strip BOM
  const text = rawText.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  return lines.slice(1).map(line => {
    const cols = parseRow(line);
    while (cols.length < 14) cols.push("");

    const [
      name, card_set, franchise, condition, status, partner_name,
      buy_date_s, buy_price_s, grading_cost_s,
      market_price_s, sell_price_s, sold_at_s,
      psa_grade_s, notes_raw,
    ] = cols;

    const errors: string[] = [];
    if (!name?.trim()) errors.push("Name required");

    const cond:    string     = VALID_CONDITIONS.has(condition?.trim()) ? condition.trim() : "NM";
    const stat:    ItemStatus = VALID_STATUSES.has(status?.trim())
      ? (status.trim() as ItemStatus) : "active";

    const buy_price    = toNum(buy_price_s)    ?? 0;
    const grading_cost = toNum(grading_cost_s) ?? 0;
    const market_price = toNum(market_price_s);
    const sell_price   = toNum(sell_price_s);
    const psa_grade    = toNum(psa_grade_s);
    const buy_date     = toDate(buy_date_s)  ?? todayStr();
    const sold_at      = toDate(sold_at_s);

    return {
      name:         name?.trim()         ?? "",
      card_set:     card_set?.trim()     ?? "",
      franchise:    franchise?.trim()    ?? "",
      condition:    cond,
      status:       stat,
      partner_name: partner_name?.trim() ?? "",
      buy_date,
      buy_price,
      grading_cost,
      market_price,
      sell_price,
      sold_at,
      psa_grade,
      notes:  notes_raw?.replace(/;/g, ",").trim() ?? "",
      error:  errors.length > 0 ? errors.join("; ") : undefined,
    };
  }).filter(r => r.name || r.error); // drop fully empty rows
}

// ── toInsertRows ─────────────────────────────────────────────────────────────
/**
 * Convert valid ParsedImportRows to Supabase insert payloads,
 * resolving partner names to IDs (case-insensitive).
 * Falls back to defaultPartnerId for unknown partner names.
 */
export function toInsertRows(
  rows: ParsedImportRow[],
  partners: Partner[],
  defaultPartnerId: string,
): ItemInsertRow[] {
  return rows
    .filter(r => !r.error && r.name)
    .map(r => {
      const partner = partners.find(
        p => p.name.toLowerCase() === r.partner_name.toLowerCase()
      );
      return {
        id:           crypto.randomUUID(),
        name:         r.name,
        card_set:     r.card_set   || null,
        franchise:    r.franchise  || null,
        condition:    r.condition,
        status:       r.status,
        partner_id:   partner?.id ?? defaultPartnerId,
        buy_date:     r.buy_date,
        buy_price:    r.buy_price,
        grading_cost: r.grading_cost,
        market_price: r.market_price,
        sell_price:   r.sell_price,
        sold_at:      r.sold_at,
        psa_grade:    r.psa_grade,
        notes:        r.notes || null,
        image_url:    null,
      };
    });
}
