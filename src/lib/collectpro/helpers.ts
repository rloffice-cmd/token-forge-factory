/**
 * CollectPro — shared helper functions used across multiple components.
 */

import type { CollectionItem, PricePoint } from "./types";

export function franchiseCfg(franchise?: string): { neon: string; accent: string; label: string } {
  const f = (franchise ?? "").toLowerCase();
  if (f.includes("pokemon") || f.includes("pokémon")) {
    return { neon: "neon-pokemon", accent: "#facc15", label: "Pokemon" };
  }
  if (f.includes("one piece") || f.includes("onepiece")) {
    return { neon: "neon-onepiece", accent: "#f97316", label: "One Piece" };
  }
  return { neon: "neon-other", accent: "#818cf8", label: franchise || "Other" };
}

export function itemCost(item: CollectionItem): number {
  return +item.buy_price + +(item.grading_cost ?? 0);
}

export function itemProfit(item: CollectionItem): number | null {
  const cost = itemCost(item);
  if (item.status === "sold" && item.sell_price != null) {
    return +item.sell_price - cost;
  }
  if (item.market_price != null) {
    return +item.market_price - cost;
  }
  return null;
}

export function genPriceHistory(item: CollectionItem): PricePoint[] {
  const start = new Date(item.buy_date).getTime();
  const end = Date.now();
  const points = Math.floor(Math.random() * 7) + 6; // 6-12
  const endPrice = item.market_price ?? +item.buy_price;
  const startPrice = +item.buy_price;
  const result: PricePoint[] = [];
  for (let i = 0; i < points; i++) {
    const t = start + (end - start) * (i / (points - 1));
    const d = new Date(t);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const ratio = i / (points - 1);
    const base = startPrice + (endPrice - startPrice) * ratio;
    const jitter = base * 0.08 * (Math.random() - 0.5);
    result.push({ month: label, value: Math.max(0, Math.round((base + jitter) * 100) / 100) });
  }
  return result;
}

/** Extract the first USD price from AI result text, e.g. "$1,234.56" → 1234.56 */
export function extractFirstPrice(text: string): number | null {
  const m = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : null;
}

/** Items whose name appears (partially) in the query string.
 *  Only matches on words ≥ 5 chars to avoid false positives like "char" → "Charizard" */
export function findMatchingItems(query: string, items: CollectionItem[]): CollectionItem[] {
  const q = query.toLowerCase();
  return items.filter((item) => {
    const name = item.name.toLowerCase();
    if (name.length >= 3 && q.includes(name)) return true;
    const words = name.split(/\s+/).filter((w) => w.length >= 5);
    return words.length > 0 && words.every((w) => q.includes(w));
  });
}

export const PAGE = 25;
