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
  onUpdateNotes,
}: {
  item: CollectionItem;
  partner?: Partner;
  onClose: () => void;
  onArena?: (id: string) => void;
  onUpdateNotes?: (id: string, notes: string) => Promise<void>;
}) {
  const cost = itemCost(item);
  const profit = itemProfit(item);
  const roiPct = profit != null && cost > 0 ? (profit / cost) * 100 : null;
  const cfg = franchiseCfg(item.franchise);

  // Fetch real היסטוריית מחיר; fall back to synthetic data
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

  // ── Inline notes edit ───────────────────────────────────────────────────
  const [editingNotes,  setEditingNotes]  = useState(false);
  const [notesVal,      setNotesVal]      = useState(item.notes ?? "");
  const [savingNotes,   setSavingNotes]   = useState(false);

  const saveNotes = useCallback(async () => {
    if (!onUpdateNotes) return;
    setSavingNotes(true);
    try {
      await onUpdateNotes(item.id, notesVal);
      setEditingNotes(false);
    } finally {
      setSavingNotes(false);
    }
  }, [onUpdateNotes, item.id, notesVal]);

  // ── Manual price record ──────────────────────────────────────────────────
  const [manualPrice,    setManualPrice]    = useState("");
  const [recordingManual, setRecordingManual] = useState(false);

  const recordManualPrice = useCallback(async () => {
    const p = parseFloat(manualPrice);
    if (isNaN(p) || p <= 0) { return; }
    setRecordingManual(true);
    try {
      await saveMarketPrice(item.id, p, "Manual price point");
      setManualPrice("");
      loadPriceHistory();
    } finally {
      setRecordingManual(false);
    }
  }, [manualPrice, item.id, loadPriceHistory]);

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
              <div className="text-xs text-gray-500 mt-2">שותף: {partner.name}</div>
            )}
          </div>
        </div>

        {/* Sold banner */}
        {item.status === "sold" && item.sell_price != null && (
          <div className={`flex items-center justify-between px-4 py-3 rounded-xl mb-4 ${profit != null && profit >= 0 ? "bg-emerald-950/60 border border-emerald-800/50" : "bg-red-950/60 border border-red-800/50"}`}>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Sold {item.sold_at ? new Date(item.sold_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</div>
              <div className={`text-xl font-extrabold ${profit != null && profit >= 0 ? "text-emerald-300" : "text-red-300"}`}>{fmt$(item.sell_price)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 mb-0.5">רווח נקי</div>
              <div className={`text-lg font-bold ${profit != null && profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {profit != null ? `${profit >= 0 ? "+" : ""}${fmt$(profit)}` : "—"}
              </div>
              {roiPct != null && <div className={`text-xs font-semibold ${roiPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmtPct(roiPct)} ROI</div>}
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
          {[
            { label: "מחיר קנייה",     value: fmt$(item.buy_price),          cls: "text-white" },
            { label: "תאריך קנייה",      value: item.buy_date,                  cls: "text-gray-300" },
            { label: "עלות דירוג",  value: fmt$(item.grading_cost ?? 0),   cls: "text-amber-400" },
            { label: "עלות כוללת",    value: fmt$(cost),                     cls: "text-amber-300 font-bold" },
            ...(item.status !== "sold" ? [
              {
                label: "הערכת שוק",
                value: item.market_price != null ? fmt$(item.market_price) : "N/A",
                cls: "text-blue-400",
              },
              {
                label: "רווח משוער",
                value: profit != null ? `${profit >= 0 ? "+" : ""}${fmt$(profit)}` : "—",
                cls: profit != null ? (profit >= 0 ? "text-emerald-400" : "text-red-400") : "text-gray-500",
              },
              {
                label: "ROI",
                value: roiPct != null ? fmtPct(roiPct) : "—",
                cls: roiPct != null ? (roiPct >= 0 ? "text-emerald-400" : "text-red-400") : "text-gray-500",
              },
            ] : []),
          ].map((st) => (
            <div key={st.label} className="bg-gray-800/60 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-0.5">{st.label}</div>
              <div className={`font-bold ${st.cls}`}>{st.value}</div>
            </div>
          ))}
        </div>

        {/* Notes — with inline editing if onUpdateNotes provided */}
        <div className="mb-4">
          {editingNotes ? (
            <div className="bg-gray-800/40 border border-gray-600 rounded-lg p-2">
              <textarea
                autoFocus
                rows={3}
                value={notesVal}
                onChange={e => setNotesVal(e.target.value)}
                className="w-full bg-transparent text-xs text-gray-300 resize-none focus:outline-none"
                placeholder="הוסף הערות…"
              />
              <div className="flex gap-2 mt-1.5 justify-end">
                <button
                  onClick={saveNotes}
                  disabled={savingNotes}
                  className="text-xs px-2.5 py-1 rounded bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {savingNotes ? "שומר…" : "שמור"}
                </button>
                <button
                  onClick={() => { setEditingNotes(false); setNotesVal(item.notes ?? ""); }}
                  className="text-xs px-2.5 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`text-xs text-gray-400 bg-gray-800/40 border border-gray-700/50 rounded-lg px-3 py-2 whitespace-pre-wrap ${onUpdateNotes ? "cursor-pointer hover:border-gray-600 transition-colors" : ""}`}
              onClick={() => onUpdateNotes && setEditingNotes(true)}
              title={onUpdateNotes ? "לחץ לעריכת הערות" : undefined}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-gray-500 font-semibold">הערות</span>
                {onUpdateNotes && <span className="text-gray-700 text-xs">✏ edit</span>}
              </div>
              {item.notes ? item.notes : <span className="text-gray-700 italic">אין הערות — לחץ להוספה</span>}
            </div>
          )}
        </div>

        {item.market_price == null && (
          <div className="text-xs text-amber-600 bg-amber-900/30 border border-amber-900/50 rounded-lg px-3 py-2 mb-4">
            אין מחיר שוק מאושר. נתוני רווח / ROI הם אומדנים בלבד.
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
              {refreshing ? "🔍 מחפש ב-eBay + TCGPlayer…" : "🔍 רענן מחיר שוק (חיפוש AI)"}
            </button>

            {refreshedPrice != null && !refreshing && (
              <div className="flex items-center justify-between text-xs px-3 py-1.5 bg-emerald-900/30 border border-emerald-800/40 rounded-lg">
                <span className="text-emerald-400 font-semibold">Updated → {fmt$(refreshedPrice)}</span>
                <span className="text-gray-500">היסטוריית מחיר updated ✓</span>
              </div>
            )}

            {refreshResult && !refreshing && (
              <div className="text-xs text-gray-400 bg-gray-800/60 rounded-xl p-3 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {refreshResult}
              </div>
            )}

            {/* Manual price record */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="📝 הזן מחיר ידני ($)"
                className="flex-1 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && recordManualPrice()}
              />
              <button
                onClick={recordManualPrice}
                disabled={!manualPrice || recordingManual}
                className="px-3 py-1.5 rounded-lg text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {recordingManual ? "…" : "שמור מחיר"}
              </button>
            </div>
          </div>
        )}

        {/* Price evolution chart */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-semibold">היסטוריית מחירים</span>
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
              <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} width={40} tickFormatter={fmt$} />
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
            שלח לזירה ⚔
          </Button>
        )}
      </div>
    </div>
  );
}
