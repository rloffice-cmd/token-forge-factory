import React, { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import type { CollectionItem, ItemStatus, Partner } from "@/lib/collectpro/types";
import { itemCost } from "@/lib/collectpro/helpers";
import { fmt$, fmtPct } from "@/lib/collectpro/stats";
import { callAI, buildMarketPricePrompt, parseAIPrice, saveMarketPrice } from "@/lib/collectpro/ai";
import { parseImportCSV, toInsertRows } from "@/lib/collectpro/importcsv";
import type { ParsedImportRow, ItemInsertRow } from "@/lib/collectpro/importcsv";
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
  const [suggesting, setSuggesting] = useState(false);
  const suggestAbort = useRef<AbortController | null>(null);

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

  const suggestPrice = useCallback(async () => {
    setSuggesting(true);
    suggestAbort.current = new AbortController();
    try {
      const prompt = buildMarketPricePrompt(item, { verbose: false });
      const reply  = await callAI(
        [{ role: "user", content: prompt }],
        "market",
        { signal: suggestAbort.current.signal }
      );
      const suggested = parseAIPrice(reply);
      if (suggested != null) {
        setPrice(String(suggested));
        toast.success(`AI suggests ${fmt$(suggested)}`);
      } else {
        toast.error("Could not extract a price from the AI response");
      }
    } catch (err: unknown) {
      if ((err as Error).message !== "ABORTED") toast.error("AI error — try again");
    } finally {
      setSuggesting(false);
    }
  }, [item]);

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

        {/* Quick price presets (only when market_price is known) */}
        {item.market_price != null && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {([
              { label: "Market",  mult: 1.00 },
              { label: "Mkt +10%", mult: 1.10 },
              { label: "Mkt +20%", mult: 1.20 },
              { label: "Mkt −10%", mult: 0.90 },
            ] as const).map(({ label, mult }) => {
              const p = Math.round(item.market_price! * mult * 100) / 100;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setPrice(String(p))}
                  className="px-2.5 py-1 rounded-lg text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
                >
                  {label} <span className="text-gray-500">{fmt$(p)}</span>
                </button>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">Sale Price ($) *</label>
              <button
                type="button"
                onClick={suggesting ? () => suggestAbort.current?.abort() : suggestPrice}
                disabled={busy}
                className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 hover:bg-blue-800 transition-colors disabled:opacity-40"
              >
                {suggesting ? "⏹ Cancel" : "🤖 AI Suggest"}
              </button>
            </div>
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
            {suggesting && (
              <div className="flex items-center gap-2 mt-1.5 text-xs text-blue-400">
                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Searching eBay + TCGPlayer for current price…
              </div>
            )}
            {profit != null && price !== "" && !suggesting && (
              <div className={`text-xs mt-1.5 font-medium ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {profit >= 0 ? "▲ Profit" : "▼ Loss"}: {fmt$(profit)}{" "}
                ({fmtPct(cost > 0 ? (profit / cost) * 100 : 0)})
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || suggesting || !price} className="flex-1">
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
  partners,
  onStatusUpdate,
  onPriceUpdate,
  onPartnerUpdate,
  onClose,
}: {
  type: "status" | "price" | "partner";
  count: number;
  partners?: Partner[];
  onStatusUpdate: (status: ItemStatus) => Promise<void>;
  onPriceUpdate: (price: number) => Promise<void>;
  onPartnerUpdate?: (partnerId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [statusVal,  setStatusVal]  = useState<ItemStatus>("active");
  const [priceVal,   setPriceVal]   = useState("");
  const [partnerVal, setPartnerVal] = useState(partners?.[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (type === "status") {
        await onStatusUpdate(statusVal);
      } else if (type === "price") {
        const p = +priceVal;
        if (isNaN(p) || p < 0) { toast.error("Invalid price"); return; }
        await onPriceUpdate(p);
      } else if (type === "partner" && onPartnerUpdate) {
        if (!partnerVal) { toast.error("Select a partner"); return; }
        await onPartnerUpdate(partnerVal);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const titles = { status: "Update Status", price: "Update Market Price", partner: "Reassign Partner" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-white mb-0.5">{titles[type]}</h3>
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
          ) : type === "price" ? (
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
          ) : (
            <div>
              <label className="text-xs text-gray-400 block mb-1">Reassign to Partner</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                value={partnerVal}
                onChange={(e) => setPartnerVal(e.target.value)}
              >
                <option value="">Select partner…</option>
                {(partners ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={busy || (type === "price" && !priceVal) || (type === "partner" && !partnerVal)}
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

// ─────────────────────────────────────────────────────────────────────────────
// ImportCSVModal
// ─────────────────────────────────────────────────────────────────────────────

export function ImportCSVModal({
  partners,
  defaultPartnerId,
  onImport,
  onClose,
}: {
  partners: Partner[];
  defaultPartnerId: string;
  onImport: (rows: ItemInsertRow[]) => Promise<void>;
  onClose: () => void;
}) {
  const [rows,     setRows]     = useState<ParsedImportRow[]>([]);
  const [filename, setFilename] = useState("");
  const [busy,     setBusy]     = useState(false);
  const [done,     setDone]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRows(parseImportCSV(text));
      setDone(false);
    };
    reader.readAsText(file, "utf-8");
  };

  const validRows = rows.filter(r => !r.error && r.name);
  const errorRows = rows.filter(r => !!r.error);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setBusy(true);
    const inserts = toInsertRows(validRows, partners, defaultPartnerId);
    try {
      await onImport(inserts);
      setDone(true);
    } catch {
      // onImport shows the toast
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={!busy ? onClose : undefined}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-white">📥 Import CSV</h3>
            <p className="text-xs text-gray-500 mt-0.5">Import from a CollectPro-exported CSV file</p>
          </div>
          {!busy && (
            <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* File picker */}
          {!done && (
            <div
              className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-blue-600 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <input type="file" accept=".csv" ref={fileRef} className="hidden" onChange={handleFile} />
              <div className="text-3xl mb-2">📄</div>
              {filename ? (
                <p className="text-sm text-gray-300 font-medium">{filename}</p>
              ) : (
                <>
                  <p className="text-sm text-gray-400">Click to select a CSV file</p>
                  <p className="text-xs text-gray-600 mt-1">Must match CollectPro export format</p>
                </>
              )}
            </div>
          )}

          {/* Summary counts */}
          {rows.length > 0 && !done && (
            <div className="flex gap-3">
              <div className="flex-1 bg-emerald-900/20 border border-emerald-900/40 rounded-lg py-2 text-center">
                <div className="font-bold text-emerald-400 text-lg">{validRows.length}</div>
                <div className="text-gray-500 text-xs">ready to import</div>
              </div>
              <div className="flex-1 bg-red-900/20 border border-red-900/40 rounded-lg py-2 text-center">
                <div className="font-bold text-red-400 text-lg">{errorRows.length}</div>
                <div className="text-gray-500 text-xs">with errors (skipped)</div>
              </div>
            </div>
          )}

          {/* Preview table */}
          {validRows.length > 0 && !done && (
            <div className="bg-gray-800/60 rounded-xl overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    {["Name", "Status", "Partner", "Buy ($)", "Market ($)"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validRows.slice(0, 25).map((r, idx) => (
                    <tr key={idx} className="border-b border-gray-700/50">
                      <td className="px-3 py-1.5 font-medium max-w-[160px] truncate">{r.name}</td>
                      <td className="px-3 py-1.5 text-gray-400">{r.status}</td>
                      <td className="px-3 py-1.5 text-gray-400 max-w-[90px] truncate">{r.partner_name || "—"}</td>
                      <td className="px-3 py-1.5">{r.buy_price > 0 ? fmt$(r.buy_price) : "—"}</td>
                      <td className="px-3 py-1.5 text-blue-400">{r.market_price != null ? fmt$(r.market_price) : "—"}</td>
                    </tr>
                  ))}
                  {validRows.length > 25 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-center text-gray-600">
                        … and {validRows.length - 25} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Error rows */}
          {errorRows.length > 0 && !done && (
            <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3 space-y-1">
              <div className="text-xs font-semibold text-red-400 mb-2">Rows with errors (will be skipped)</div>
              {errorRows.slice(0, 10).map((r, idx) => (
                <div key={idx} className="text-xs text-red-300">{r.name || "(empty)"}: {r.error}</div>
              ))}
              {errorRows.length > 10 && (
                <div className="text-xs text-gray-600">… and {errorRows.length - 10} more</div>
              )}
            </div>
          )}

          {/* Success state */}
          {done && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-bold text-white text-lg">{validRows.length} items imported!</p>
              <p className="text-sm text-gray-500 mt-1">They'll appear in your inventory shortly.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 shrink-0 flex gap-2">
          {!done ? (
            <>
              <Button
                className="flex-1"
                disabled={validRows.length === 0 || busy}
                onClick={handleImport}
              >
                {busy ? "Importing…" : `Import ${validRows.length} item${validRows.length !== 1 ? "s" : ""}`}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            </>
          ) : (
            <Button className="flex-1" onClick={onClose}>Close</Button>
          )}
        </div>
      </div>
    </div>
  );
}
