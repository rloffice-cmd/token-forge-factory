import React, { useState, useCallback, useRef, useMemo } from "react";
import type { CollectionItem, Partner } from "@/lib/collectpro/types";
import type { Action } from "@/lib/collectpro/state";
import { itemCost, itemProfit } from "@/lib/collectpro/helpers";
import { fmt$, fmtPct } from "@/lib/collectpro/stats";
import { callAI } from "@/lib/collectpro/ai";
import { Button } from "@/components/ui/button";
import CollectibleCard from "./CollectibleCard";

// ─────────────────────────────────────────────────────────────────────────────
// ArenaAICompare
// ─────────────────────────────────────────────────────────────────────────────

function ArenaAICompare({ itemA, itemB }: { itemA: CollectionItem; itemB: CollectionItem }) {
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runCompare = useCallback(async () => {
    if (busy) { abortRef.current?.abort(); setBusy(false); return; }

    const prompt = [
      `Compare these two TCG cards for investment decisions. Search current market prices on eBay sold listings and TCGPlayer.`,
      ``,
      `CARD A: ${itemA.name}`,
      `  Set: ${itemA.card_set ?? "Unknown"} | Franchise: ${itemA.franchise ?? "Unknown"}`,
      `  Condition: ${itemA.condition} | PSA Grade: ${itemA.psa_grade ?? "Not graded"}`,
      `  My buy price: $${itemA.buy_price} (grading: $${itemA.grading_cost ?? 0})`,
      `  Market estimate: ${itemA.market_price != null ? "$" + itemA.market_price : "Unknown"}`,
      ``,
      `CARD B: ${itemB.name}`,
      `  Set: ${itemB.card_set ?? "Unknown"} | Franchise: ${itemB.franchise ?? "Unknown"}`,
      `  Condition: ${itemB.condition} | PSA Grade: ${itemB.psa_grade ?? "Not graded"}`,
      `  My buy price: $${itemB.buy_price} (grading: $${itemB.grading_cost ?? 0})`,
      `  Market estimate: ${itemB.market_price != null ? "$" + itemB.market_price : "Unknown"}`,
      ``,
      `Please answer:`,
      `1. Current market price for each card (cite sources + dates)`,
      `2. Which has better price momentum right now?`,
      `3. Which to grade first if budget allows only one ($25 grading fee)?`,
      `4. Hold, sell, or flip recommendation for each card`,
    ].join("\n");

    setBusy(true);
    setResult("");
    abortRef.current = new AbortController();

    try {
      const reply = await callAI(
        [{ role: "user", content: prompt }],
        "market",
        { signal: abortRef.current.signal, cacheKey: `arena-${itemA.id}-${itemB.id}` }
      );
      setResult(reply);
    } catch (err: unknown) {
      if ((err as Error).message !== "ABORTED") setResult(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [busy, itemA, itemB]);

  return (
    <div className="mb-4">
      <button
        onClick={runCompare}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
          busy
            ? "bg-red-900/60 border border-red-700 text-red-300 hover:bg-red-800/60"
            : "bg-gradient-to-r from-blue-700 to-purple-700 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg"
        }`}
      >
        {busy ? "⏹ Cancel AI Compare" : "🤖 AI Deep Compare (web search)"}
      </button>

      {busy && !result && (
        <p className="text-xs text-gray-500 text-center mt-2 animate-pulse">Searching eBay + TCGPlayer… (15–30s)</p>
      )}

      {result && (
        <div className="mt-3 bg-gray-800/80 border border-blue-800/40 rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-y-auto">
          {result}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ArenaView
// ─────────────────────────────────────────────────────────────────────────────

export function ArenaView({
  items,
  arenaA,
  arenaB,
  partners,
  dispatch,
}: {
  items: CollectionItem[];
  arenaA: string | null;
  arenaB: string | null;
  partners: Partner[];
  dispatch: React.Dispatch<Action>;
}) {
  const itemA = items.find((i) => i.id === arenaA) ?? null;
  const itemB = items.find((i) => i.id === arenaB) ?? null;
  const partnerOf = (item: CollectionItem | null) =>
    item ? partners.find((p) => p.id === item.partner_id) : undefined;

  const costA = itemA ? itemCost(itemA) : 0;
  const costB = itemB ? itemCost(itemB) : 0;
  const profitA = itemA ? itemProfit(itemA) : null;
  const profitB = itemB ? itemProfit(itemB) : null;
  const roiA = profitA != null && costA > 0 ? (profitA / costA) * 100 : null;
  const roiB = profitB != null && costB > 0 ? (profitB / costB) * 100 : null;

  let gradingRec = "";
  if (itemA && itemB) {
    const bothRaw = !itemA.psa_grade && !itemB.psa_grade;
    const upsideA = itemA.market_price != null ? itemA.market_price / costA : 0;
    const upsideB = itemB.market_price != null ? itemB.market_price / costB : 0;
    if (bothRaw) {
      if (upsideA >= 3 && upsideB >= 3) {
        gradingRec = `Both cards show high grading upside (${itemA.name}: ${upsideA.toFixed(1)}x, ${itemB.name}: ${upsideB.toFixed(1)}x). Consider grading both.`;
      } else if (upsideA >= 3) {
        gradingRec = `High grading upside on ${itemA.name} (${upsideA.toFixed(1)}x ROI potential). ${itemB.name} shows lower upside (${upsideB.toFixed(1)}x).`;
      } else if (upsideB >= 3) {
        gradingRec = `High grading upside on ${itemB.name} (${upsideB.toFixed(1)}x ROI potential). ${itemA.name} shows lower upside (${upsideA.toFixed(1)}x).`;
      } else {
        gradingRec = `Both cards are raw. Market upside is modest. Grading cost may not justify the investment for either card.`;
      }
    } else if (itemA.psa_grade && !itemB.psa_grade) {
      if (upsideB >= 3) {
        gradingRec = `${itemB.name} is raw with high grading upside (${upsideB.toFixed(1)}x). Consider grading it.`;
      } else {
        gradingRec = `${itemA.name} is already graded PSA ${itemA.psa_grade}. ${itemB.name} is raw with modest upside.`;
      }
    } else if (!itemA.psa_grade && itemB.psa_grade) {
      if (upsideA >= 3) {
        gradingRec = `${itemA.name} is raw with high grading upside (${upsideA.toFixed(1)}x). Consider grading it.`;
      } else {
        gradingRec = `${itemB.name} is already graded PSA ${itemB.psa_grade}. ${itemA.name} is raw with modest upside.`;
      }
    } else {
      gradingRec = `Both cards are already graded. Compare ROI: ${itemA.name} ${roiA != null ? fmtPct(roiA) : "N/A"} vs ${itemB.name} ${roiB != null ? fmtPct(roiB) : "N/A"}.`;
    }
  } else if (itemA || itemB) {
    const single = itemA ?? itemB!;
    const upside = single.market_price != null ? single.market_price / itemCost(single) : 0;
    if (!single.psa_grade && upside >= 3) {
      gradingRec = `${single.name} shows high grading upside (${upside.toFixed(1)}x). Consider grading.`;
    } else if (!single.psa_grade) {
      gradingRec = `${single.name} is raw. Add a second card to compare, or grade if upside justifies cost.`;
    } else {
      gradingRec = `${single.name} is graded PSA ${single.psa_grade}. Add a second card to compare.`;
    }
  }

  const SlotPlaceholder = ({ slot }: { slot: "a" | "b" }) => (
    <div className="arena-slot-empty flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-700 text-gray-600 gap-2 p-4" style={{ minHeight: 220 }}>
      <span className="text-3xl">⚔</span>
      <span className="text-sm">{slot === "a" ? "Slot A" : "Slot B"}</span>
      <span className="text-xs">Pick a card below</span>
    </div>
  );

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-col sm:flex-row">
        <div className="flex-1">
          {itemA ? (
            <CollectibleCard
              item={itemA}
              partner={partnerOf(itemA)}
              arenaSlot="a"
              onDelete={() => dispatch({ t: "ARENA_SET", slot: "a", id: null })}
            />
          ) : (
            <SlotPlaceholder slot="a" />
          )}
        </div>
        <div className="flex-1">
          {itemB ? (
            <CollectibleCard
              item={itemB}
              partner={partnerOf(itemB)}
              arenaSlot="b"
              onDelete={() => dispatch({ t: "ARENA_SET", slot: "b", id: null })}
            />
          ) : (
            <SlotPlaceholder slot="b" />
          )}
        </div>
      </div>

      {(itemA || itemB) && (
        <div className="glass rounded-2xl overflow-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right px-3 py-2.5 text-xs text-gray-500 font-medium">Metric</th>
                <th className="text-right px-3 py-2.5 text-xs text-blue-400 font-medium">Slot A{itemA ? ` — ${itemA.name}` : ""}</th>
                <th className="text-right px-3 py-2.5 text-xs text-purple-400 font-medium">Slot B{itemB ? ` — ${itemB.name}` : ""}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Total Cost", a: itemA ? fmt$(costA) : "—", b: itemB ? fmt$(costB) : "—" },
                {
                  label: "Market Est.",
                  a: itemA ? (itemA.market_price != null ? fmt$(itemA.market_price) : "N/A") : "—",
                  b: itemB ? (itemB.market_price != null ? fmt$(itemB.market_price) : "N/A") : "—",
                },
                {
                  label: "Est. Profit",
                  a: itemA ? (profitA != null ? `${profitA >= 0 ? "+" : ""}${fmt$(profitA)}` : "—") : "—",
                  b: itemB ? (profitB != null ? `${profitB >= 0 ? "+" : ""}${fmt$(profitB)}` : "—") : "—",
                },
                {
                  label: "ROI",
                  a: itemA ? (roiA != null ? fmtPct(roiA) : "—") : "—",
                  b: itemB ? (roiB != null ? fmtPct(roiB) : "—") : "—",
                },
                { label: "Condition", a: itemA ? itemA.condition : "—", b: itemB ? itemB.condition : "—" },
                {
                  label: "PSA Grade",
                  a: itemA ? (itemA.psa_grade ? `PSA ${itemA.psa_grade}` : "Raw") : "—",
                  b: itemB ? (itemB.psa_grade ? `PSA ${itemB.psa_grade}` : "Raw") : "—",
                },
              ].map((row) => (
                <tr key={row.label} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-xs text-gray-400 font-medium">{row.label}</td>
                  <td className="px-3 py-2 text-xs text-white">{row.a}</td>
                  <td className="px-3 py-2 text-xs text-white">{row.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {gradingRec && (
        <div className="bg-purple-950/40 border border-purple-800/50 rounded-xl p-4 mb-4">
          <div className="text-xs font-bold text-purple-300 mb-1">Grading Recommendation</div>
          <div className="text-sm text-gray-200">{gradingRec}</div>
        </div>
      )}

      {itemA && itemB && <ArenaAICompare itemA={itemA} itemB={itemB} />}

      {(itemA || itemB) && (
        <Button variant="outline" size="sm" onClick={() => dispatch({ t: "ARENA_CLEAR" })}>
          Clear Arena
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ArenaTab
// ─────────────────────────────────────────────────────────────────────────────

export function ArenaTab({
  items,
  arenaA,
  arenaB,
  partners,
  dispatch,
  addToArena,
}: {
  items: CollectionItem[];
  arenaA: string | null;
  arenaB: string | null;
  partners: Partner[];
  dispatch: React.Dispatch<Action>;
  addToArena: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return !q
      ? items
      : items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.card_set ?? "").toLowerCase().includes(q) ||
            (i.franchise ?? "").toLowerCase().includes(q)
        );
  }, [items, search]);

  return (
    <div>
      <h2 className="font-bold mb-1">⚔️ Card Arena</h2>
      <p className="text-xs text-gray-500 mb-4">Compare two cards side by side. Pick cards from the grid below or use the ⚔ button in inventory.</p>

      <ArenaView
        items={items}
        arenaA={arenaA}
        arenaB={arenaB}
        partners={partners}
        dispatch={dispatch}
      />

      {items.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">PICK CARDS FOR ARENA</div>
            <span className="text-xs text-gray-600">{filtered.length} cards</span>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Filter cards…"
            className="w-full mb-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {filtered.map((item) => (
              <CollectibleCard
                key={item.id}
                item={item}
                compact
                arenaSlot={arenaA === item.id ? "a" : arenaB === item.id ? "b" : null}
                onArena={addToArena}
              />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-600 text-sm">
                No cards match your search
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
