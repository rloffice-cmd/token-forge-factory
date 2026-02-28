import React, { useState, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { CollectionItem, Partner, PricePoint } from "@/lib/collectpro/types";
import { franchiseCfg, itemCost, itemProfit, genPriceHistory } from "@/lib/collectpro/helpers";
import { fmt$, fmtPct } from "@/lib/collectpro/stats";
import { callAI, buildMarketPricePrompt, parseAIPrice, saveMarketPrice } from "@/lib/collectpro/ai";
import { Button } from "@/components/ui/button";
import { StatusBadge, FranchiseIcon } from "./StatusBadge";

export default function CardDetailModal({
  item,
  partner,
  onClose,
  onArena,
}: {
  item: CollectionItem;
  partner?: Partner;
  onClose: () => void;
  onArena?: (id: string) => void;
}) {
  const cost = itemCost(item);
  const profit = itemProfit(item);
  const roiPct = profit != null && cost > 0 ? (profit / cost) * 100 : null;
  const cfg = franchiseCfg(item.franchise);

  // Fetch real price history; fall back to synthetic data
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [historyReal, setHistoryReal] = useState(false);

  const loadPriceHistory = useCallback(() => {
    supabase
      .from("cp_price_history")
      .select("price, recorded_at")
      .eq("item_id", item.id)
      .order("recorded_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length >= 2) {
          setPriceHistory(
            data.map((r: { price: number; recorded_at: string }) => ({
              month: new Date(r.recorded_at).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
              value: +r.price,
            }))
          );
          setHistoryReal(true);
        } else {
          setPriceHistory(genPriceHistory(item));
          setHistoryReal(false);
        }
      })
      .catch(() => {
        setPriceHistory(genPriceHistory(item));
        setHistoryReal(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => { loadPriceHistory(); }, [loadPriceHistory]);

  // ── AI market price refresh ─────────────────────────────────────────────
  const [refreshing,     setRefreshing]     = useState(false);
  const [refreshResult,  setRefreshResult]  = useState("");
  const [refreshedPrice, setRefreshedPrice] = useState<number | null>(null);
  const refreshingRef = useRef(false);

  const refreshMarketPrice = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setRefreshResult("");

    try {
      const reply = await callAI(
        [{ role: "user", content: buildMarketPricePrompt(item, { verbose: true }) }],
        "market",
        { cacheKey: `price-refresh-${item.id}-${Date.now()}` }
      );

      const price = parseAIPrice(reply);
      if (price !== null) {
        setRefreshedPrice(price);
        await saveMarketPrice(item.id, price, `AI market scan — $${price}`);
        loadPriceHistory();
      }

      setRefreshResult(reply);
    } catch (err) {
      setRefreshResult(`Error: ${(err as Error).message}`);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [item, loadPriceHistory]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`glass ${cfg.neon} relative w-full max-w-lg rounded-2xl overflow-auto max-h-[90vh] p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-3 left-3 text-gray-400 hover:text-white text-xl"
          onClick={onClose}
        >✕</button>

        <div className="flex gap-4 mb-4">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              loading="lazy"
              className="w-28 h-36 object-cover rounded-xl flex-shrink-0"
            />
          ) : (
            <div className="w-28 h-36 bg-gray-800/60 rounded-xl flex items-center justify-center flex-shrink-0">
              <FranchiseIcon franchise={item.franchise} size={56} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-extrabold text-lg text-white leading-tight">{item.name}</h2>
            {item.card_set && <div className="text-xs text-gray-400 mt-0.5">{item.card_set}</div>}
            {item.franchise && <div className="text-xs mt-1" style={{ color: cfg.accent }}>{item.franchise}</div>}
            <div className="flex flex-wrap gap-1 mt-2">
              <StatusBadge status={item.status} />
              {item.psa_grade && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900 text-yellow-300 font-bold">
                  PSA {item.psa_grade}
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{item.condition}</span>
            </div>
            {partner && (
              <div className="text-xs text-gray-500 mt-2">Partner: {partner.name}</div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
          {[
            { label: "Buy Price", value: fmt$(item.buy_price), cls: "text-white" },
            { label: "Grading Cost", value: fmt$(item.grading_cost ?? 0), cls: "text-amber-400" },
            { label: "Total Cost", value: fmt$(cost), cls: "text-amber-300 font-bold" },
            {
              label: "Market Estimate",
              value: item.market_price != null ? fmt$(item.market_price) : "N/A",
              cls: "text-blue-400",
            },
            {
              label: item.status === "sold" ? "Sale Price" : "Est. Profit",
              value: profit != null ? `${profit >= 0 ? "+" : ""}${fmt$(profit)}` : "—",
              cls: profit != null ? (profit >= 0 ? "text-emerald-400" : "text-red-400") : "text-gray-500",
            },
            {
              label: "ROI",
              value: roiPct != null ? fmtPct(roiPct) : "—",
              cls: roiPct != null ? (roiPct >= 0 ? "text-emerald-400" : "text-red-400") : "text-gray-500",
            },
          ].map((st) => (
            <div key={st.label} className="bg-gray-800/60 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-0.5">{st.label}</div>
              <div className={`font-bold ${st.cls}`}>{st.value}</div>
            </div>
          ))}
        </div>

        {item.market_price == null && (
          <div className="text-xs text-amber-600 bg-amber-900/30 border border-amber-900/50 rounded-lg px-3 py-2 mb-4">
            THEORETICAL — no confirmed price point. Market estimate is not available.
          </div>
        )}

        {/* AI market price refresh */}
        {item.status !== "sold" && (
          <div className="mb-4 space-y-2">
            <button
              onClick={refreshMarketPrice}
              disabled={refreshing}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                refreshing
                  ? "bg-blue-900/40 border border-blue-800/50 text-blue-400 cursor-wait"
                  : "bg-blue-900/60 border border-blue-800/50 text-blue-300 hover:bg-blue-800/60 active:scale-98"
              }`}
            >
              {refreshing ? "🔍 Searching eBay + TCGPlayer…" : "🔍 Refresh market price (AI web search)"}
            </button>

            {refreshedPrice != null && !refreshing && (
              <div className="flex items-center justify-between text-xs px-3 py-1.5 bg-emerald-900/30 border border-emerald-800/40 rounded-lg">
                <span className="text-emerald-400 font-semibold">Updated → {fmt$(refreshedPrice)}</span>
                <span className="text-gray-500">price history updated ✓</span>
              </div>
            )}

            {refreshResult && !refreshing && (
              <div className="text-xs text-gray-400 bg-gray-800/60 rounded-xl p-3 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {refreshResult}
              </div>
            )}
          </div>
        )}

        {/* Price evolution chart */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-semibold">Price Evolution</span>
            {historyReal
              ? <span className="text-xs text-green-500 font-mono">● LIVE DATA</span>
              : <span className="text-xs text-yellow-600 font-mono">⚠ SYNTHETIC</span>
            }
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={priceHistory} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={cfg.accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={cfg.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} width={40} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [fmt$(v), "Price"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={cfg.accent}
                fill={`url(#grad-${item.id})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {onArena && (
          <Button
            className="w-full"
            onClick={() => { onArena(item.id); onClose(); }}
            variant="outline"
          >
            Send to Arena ⚔
          </Button>
        )}
      </div>
    </div>
  );
}
