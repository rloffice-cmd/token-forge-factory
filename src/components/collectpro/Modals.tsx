import React, { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import type { CollectionItem, ItemStatus } from "@/lib/collectpro/types";
import { itemCost } from "@/lib/collectpro/helpers";
import { fmt$, fmtPct } from "@/lib/collectpro/stats";
import { callAI, buildMarketPricePrompt, parseAIPrice, saveMarketPrice } from "@/lib/collectpro/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─────────────────────────────────────────────────────────────────────────────
// SellDialog
// ─────────────────────────────────────────────────────────────────────────────

export function SellDialog({
  item,
  onConfirm,
  onClose,
}: {
  item: CollectionItem;
  onConfirm: (item: CollectionItem, price: number) => Promise<void>;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(item.market_price != null ? String(item.market_price) : "");
  const [busy, setBusy] = useState(false);
  const cost = itemCost(item);
  const numPrice = parseFloat(price);
  const profit = !isNaN(numPrice) ? numPrice - cost : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numPrice) || numPrice < 0) { toast.error("Invalid price"); return; }
    setBusy(true);
    await onConfirm(item, numPrice);
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-white mb-0.5">Mark as Sold</h3>
        <p className="text-sm text-gray-400 mb-4 truncate">{item.name}</p>

        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
          <div className="bg-gray-800 rounded-lg p-2.5">
            <div className="text-xs text-gray-500 mb-0.5">Cost basis</div>
            <div className="font-bold text-amber-400">{fmt$(cost)}</div>
          </div>
          {item.market_price != null && (
            <div className="bg-gray-800 rounded-lg p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">Market est.</div>
              <div className="font-bold text-blue-400">{fmt$(item.market_price)}</div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Sale Price ($) *</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              className="bg-gray-800 border-gray-700 text-white"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter sale price…"
            />
            {profit != null && price !== "" && (
              <div className={`text-xs mt-1.5 font-medium ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {profit >= 0 ? "▲ Profit" : "▼ Loss"}: {fmt$(profit)}{" "}
                ({fmtPct(cost > 0 ? (profit / cost) * 100 : 0)})
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !price} className="flex-1">
              {busy ? "Saving…" : "Confirm Sale ✓"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BatchOperationModal
// ─────────────────────────────────────────────────────────────────────────────

export function BatchOperationModal({
  type,
  count,
  onStatusUpdate,
  onPriceUpdate,
  onClose,
}: {
  type: "status" | "price";
  count: number;
  onStatusUpdate: (status: ItemStatus) => Promise<void>;
  onPriceUpdate: (price: number) => Promise<void>;
  onClose: () => void;
}) {
  const [statusVal, setStatusVal] = useState<ItemStatus>("active");
  const [priceVal, setPriceVal] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (type === "status") {
        await onStatusUpdate(statusVal);
      } else {
        const p = +priceVal;
        if (isNaN(p) || p < 0) { toast.error("Invalid price"); return; }
        await onPriceUpdate(p);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-white mb-0.5">
          {type === "status" ? "Update Status" : "Update Market Price"}
        </h3>
        <p className="text-sm text-gray-400 mb-4">{count} items selected</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {type === "status" ? (
            <div>
              <label className="text-xs text-gray-400 block mb-1">New Status</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                value={statusVal}
                onChange={(e) => setStatusVal(e.target.value as ItemStatus)}
              >
                <option value="active">Active</option>
                <option value="grading">Grading</option>
                <option value="sold">Sold</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-400 block mb-1">Market Price ($)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                className="bg-gray-800 border-gray-700"
                value={priceVal}
                onChange={(e) => setPriceVal(e.target.value)}
                placeholder="Enter price…"
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={busy || (type === "price" && !priceVal)}
              className="flex-1"
            >
              {busy ? "Applying…" : "Apply to All"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BatchPriceRefreshModal
// ─────────────────────────────────────────────────────────────────────────────

type RefreshRow = {
  item:    CollectionItem;
  status:  "pending" | "running" | "done" | "error";
  price?:  number;
  error?:  string;
};

export function BatchPriceRefreshModal({
  items,
  onClose,
}: {
  items: CollectionItem[];
  onClose: () => void;
}) {
  const [rows, setRows]       = useState<RefreshRow[]>(items.map(item => ({ item, status: "pending" })));
  const [running, setRunning] = useState(false);
  const [done, setDone]       = useState(false);
  const cancelledRef          = useRef(false);

  const { updated, errored } = rows.reduce(
    (acc, r) => ({
      updated: acc.updated + (r.status === "done"  ? 1 : 0),
      errored: acc.errored + (r.status === "error" ? 1 : 0),
    }),
    { updated: 0, errored: 0 }
  );

  const run = useCallback(async () => {
    cancelledRef.current = false;
    setRunning(true);
    setDone(false);
    setRows(items.map(item => ({ item, status: "pending" })));

    for (let i = 0; i < items.length; i++) {
      if (cancelledRef.current) break;

      setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "running" } : r));

      const item = items[i];

      try {
        const reply = await callAI(
          [{ role: "user", content: buildMarketPricePrompt(item) }],
          "market",
          { cacheKey: `batch-price-${item.id}-${Date.now()}` }
        );

        if (cancelledRef.current) {
          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "pending" } : r));
          break;
        }

        const price = parseAIPrice(reply);
        if (price !== null) {
          await saveMarketPrice(item.id, price, `Batch AI scan — $${price}`);
          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "done", price } : r));
        } else {
          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "error", error: "Price not found" } : r));
        }
      } catch (err) {
        if (!cancelledRef.current) {
          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "error", error: (err as Error).message } : r));
        } else {
          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "pending" } : r));
        }
      }
    }

    if (!cancelledRef.current) { setRunning(false); setDone(true); }
  }, [items]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    setRows(items.map(item => ({ item, status: "pending" })));
    setDone(false);
  }, [items]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={running ? undefined : onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-white">📊 AI Market Price Refresh</h3>
            <p className="text-xs text-gray-500 mt-0.5">Searches eBay + TCGPlayer for each item</p>
          </div>
          {!running && <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>}
        </div>

        {/* Row list */}
        <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
          {rows.map(({ item, status, price, error }) => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800/60">
              <span className="text-base shrink-0 w-5 text-center">
                {status === "pending" ? "⏳" : status === "running" ? "🔍" : status === "done" ? "✅" : "❌"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {item.condition}{item.psa_grade ? ` · PSA ${item.psa_grade}` : ""}{item.card_set ? ` · ${item.card_set}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right min-w-[56px]">
                {status === "done"    && price != null && <span className="text-emerald-400 font-bold text-sm">{fmt$(price)}</span>}
                {status === "running" && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin ml-auto" />}
                {status === "error"   && <span className="text-red-400 text-xs" title={error}>failed</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 shrink-0 space-y-3">
          {!done && (
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${((updated + errored) / rows.length) * 100}%` }}
              />
            </div>
          )}

          {done && (
            <div className="flex gap-3 text-sm text-center">
              <div className="flex-1 bg-emerald-900/30 border border-emerald-900/40 rounded-lg py-2">
                <div className="font-bold text-emerald-400">{updated}</div>
                <div className="text-gray-500 text-xs">updated</div>
              </div>
              <div className="flex-1 bg-red-900/30 border border-red-900/40 rounded-lg py-2">
                <div className="font-bold text-red-400">{errored}</div>
                <div className="text-gray-500 text-xs">failed</div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {!running && !done && (
              <Button className="flex-1" onClick={run}>
                🔍 Start ({items.length} item{items.length !== 1 ? "s" : ""})
              </Button>
            )}
            {running && (
              <Button className="flex-1" variant="destructive" onClick={cancel}>⏹ Cancel</Button>
            )}
            {done && (
              <>
                <Button variant="outline" className="flex-1" onClick={reset}>Run again</Button>
                <Button className="flex-1" onClick={onClose}>Done</Button>
              </>
            )}
          </div>
          {!done && !running && (
            <p className="text-xs text-gray-600 text-center">Each item takes ~15–30s · {items.length} items total</p>
          )}
        </div>
      </div>
    </div>
  );
}
