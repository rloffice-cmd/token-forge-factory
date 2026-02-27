// ─────────────────────────────────────────────────────────────────────────────
// CollectPro — Pure portfolio statistics (no side-effects, fully testable)
// ─────────────────────────────────────────────────────────────────────────────

import type { CollectionItem, PortfolioStats } from "./types";

export function computeStats(items: CollectionItem[]): PortfolioStats {
  const active  = items.filter((i) => i.status === "active");
  const grading = items.filter((i) => i.status === "grading");
  const sold    = items.filter((i) => i.status === "sold");

  const cost = (i: CollectionItem) => +i.buy_price + +(i.grading_cost ?? 0);

  const totalCost = items.reduce((s, i) => s + cost(i), 0);

  // Market estimate: only for active items, falls back to buy_price if no estimate entered
  const estimatedValue = active.reduce(
    (s, i) => s + +(i.market_price ?? i.buy_price),
    0
  );
  const activeCost    = active.reduce((s, i) => s + cost(i), 0);
  const unrealisedPnL = estimatedValue - activeCost;

  const realisedRevenue = sold.reduce((s, i) => s + +(i.sell_price ?? 0), 0);
  const soldCost        = sold.reduce((s, i) => s + cost(i), 0);
  const realisedProfit  = realisedRevenue - soldCost;
  const roiPct          = soldCost > 0 ? (realisedProfit / soldCost) * 100 : 0;

  return {
    totalCost,
    estimatedValue,
    unrealisedPnL,
    realisedRevenue,
    realisedProfit,
    roiPct,
    activeCount:  active.length,
    gradingCount: grading.length,
    soldCount:    sold.length,
  };
}

export const fmt$ = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
