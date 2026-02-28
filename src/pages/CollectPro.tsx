/**
 * CollectPro — Monster Mode
 * TCG Card Portfolio Manager with Arena, Cards View, Quick Scan, and Mobile Nav.
 */

import React, {
  useReducer,
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import "@/lib/collectpro/collectpro.css";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

import type {
  CollectionItem,
  Partner,
  ChatMessage,
  SortConfig,
  ItemForm,
  ItemStatus,
  AIMode,
  Tab,
  ViewMode,
  PortfolioStats,
  UndoBuffer,
  PricePoint,
} from "@/lib/collectpro/types";
import { computeStats, fmt$, fmtPct } from "@/lib/collectpro/stats";
import { callAI } from "@/lib/collectpro/ai";
import type { CardScanResult } from "@/lib/collectpro/ai";
import { compressImage, uploadCardImage } from "@/lib/collectpro/image";
import CameraScanner from "@/components/collectpro/CameraScanner";
import { exportCSV, exportEbayCSV, exportCardmarketCSV } from "@/lib/collectpro/export";

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function franchiseCfg(franchise?: string): { neon: string; accent: string; label: string } {
  const f = (franchise ?? "").toLowerCase();
  if (f.includes("pokemon") || f.includes("pokémon")) {
    return { neon: "neon-pokemon", accent: "#facc15", label: "Pokemon" };
  }
  if (f.includes("one piece") || f.includes("onepiece")) {
    return { neon: "neon-onepiece", accent: "#f97316", label: "One Piece" };
  }
  return { neon: "neon-other", accent: "#818cf8", label: franchise || "Other" };
}

function itemCost(item: CollectionItem): number {
  return +item.buy_price + +(item.grading_cost ?? 0);
}

function itemProfit(item: CollectionItem): number | null {
  const cost = itemCost(item);
  if (item.status === "sold" && item.sell_price != null) {
    return +item.sell_price - cost;
  }
  if (item.market_price != null) {
    return +item.market_price - cost;
  }
  return null;
}

function genPriceHistory(item: CollectionItem): PricePoint[] {
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
function extractFirstPrice(text: string): number | null {
  const m = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : null;
}

/** Items whose name appears (partially) in the query string */
function findMatchingItems(query: string, items: CollectionItem[]): CollectionItem[] {
  const q = query.toLowerCase();
  return items.filter((item) => {
    const name = item.name.toLowerCase();
    // exact substring or each significant word appears in query
    if (q.includes(name)) return true;
    return name.split(/\s+/).filter((w) => w.length > 3).some((w) => q.includes(w));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// State shape & reducer
// ─────────────────────────────────────────────────────────────────────────────

type State = {
  items:    CollectionItem[];
  partners: Partner[];
  loading:  boolean;
  tab:      Tab;
  franchise: boolean;
  viewMode: ViewMode;
  arena: { a: string | null; b: string | null };
  modal: string | null;
  showScanner: boolean;
  chat: { messages: ChatMessage[]; input: string; busy: boolean };
  market: { mode: AIMode; query: string; result: string; busy: boolean };
  inv: {
    search:    string;
    sort:      SortConfig;
    page:      number;
    showForm:  boolean;
    editId:    string | null;
    form:      ItemForm;
    selected:  string[];
  };
  partnerForm: { name: string; email: string };
  addingPartner: boolean;
  deleteTarget: string | null;
  undo:         UndoBuffer | null;
};

type Action =
  | { t: "LOAD_OK";    items: CollectionItem[]; partners: Partner[] }
  | { t: "RT_ITEM";    event: string; item: CollectionItem }
  | { t: "RT_PARTNER"; event: string; partner: Partner }
  | { t: "SET_TAB";    tab: Tab }
  | { t: "TOGGLE_FRANCHISE" }
  | { t: "SET_VIEW";   mode: ViewMode }
  | { t: "CHAT_INPUT"; v: string }
  | { t: "CHAT_MSG";   m: ChatMessage }
  | { t: "CHAT_BUSY";  v: boolean }
  | { t: "MKT_MODE";   v: AIMode }
  | { t: "MKT_QUERY";  v: string }
  | { t: "MKT_RESULT"; v: string }
  | { t: "MKT_BUSY";   v: boolean }
  | { t: "INV_SEARCH"; v: string }
  | { t: "INV_SORT";   s: SortConfig }
  | { t: "INV_PAGE";   n: number }
  | { t: "INV_FORM_SHOW"; show: boolean }
  | { t: "INV_FORM_EDIT"; id: string | null; form: ItemForm }
  | { t: "INV_FORM_PATCH"; p: Partial<ItemForm> }
  | { t: "INV_SEL_TOGGLE"; id: string }
  | { t: "INV_SEL_ALL"; ids: string[] }
  | { t: "INV_SEL_CLEAR" }
  | { t: "ARENA_SET";  slot: "a" | "b"; id: string | null }
  | { t: "ARENA_CLEAR" }
  | { t: "SET_MODAL";    id: string | null }
  | { t: "SET_SCANNER";  v: boolean }
  | { t: "PF_PATCH";   p: Partial<State["partnerForm"]> }
  | { t: "PF_BUSY";    v: boolean }
  | { t: "DEL_TARGET"; id: string | null }
  | { t: "UNDO_SET";   u: UndoBuffer | null };

function today() { return new Date().toISOString().slice(0, 10); }

function emptyForm(partnerId: string): ItemForm {
  return {
    name: "", card_set: "", franchise: "", condition: "NM",
    buy_price: "", grading_cost: "0", market_price: "",
    buy_date: today(), status: "active", partner_id: partnerId,
    notes: "", image_url: "", psa_grade: "",
  };
}

const INIT: State = {
  items: [], partners: [], loading: true,
  tab: "brain", franchise: false, viewMode: "cards",
  arena: { a: null, b: null }, modal: null, showScanner: false,
  chat:   { messages: [], input: "", busy: false },
  market: { mode: "market", query: "", result: "", busy: false },
  inv: {
    search: "", sort: { field: "buy_date", dir: "desc" },
    page: 1, showForm: false, editId: null,
    form: emptyForm(""), selected: [],
  },
  partnerForm: { name: "", email: "" }, addingPartner: false,
  deleteTarget: null, undo: null,
};

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "LOAD_OK":
      return { ...s, loading: false, items: a.items, partners: a.partners };

    case "RT_ITEM":
      switch (a.event) {
        case "INSERT": return { ...s, items: [a.item, ...s.items.filter(i => i.id !== a.item.id)] };
        case "UPDATE": return { ...s, items: s.items.map(i => i.id === a.item.id ? a.item : i) };
        case "DELETE": return { ...s, items: s.items.filter(i => i.id !== a.item.id) };
        default: return s;
      }

    case "RT_PARTNER":
      switch (a.event) {
        case "INSERT":
          return { ...s, partners: [...s.partners, a.partner].sort((a, b) => a.name.localeCompare(b.name, "he")) };
        case "UPDATE":
          return { ...s, partners: s.partners.map(p => p.id === a.partner.id ? a.partner : p) };
        case "DELETE":
          return { ...s, partners: s.partners.filter(p => p.id !== a.partner.id) };
        default: return s;
      }

    case "SET_TAB":          return { ...s, tab: a.tab };
    case "TOGGLE_FRANCHISE": return { ...s, franchise: !s.franchise };
    case "SET_VIEW":         return { ...s, viewMode: a.mode };

    case "CHAT_INPUT": return { ...s, chat: { ...s.chat, input: a.v } };
    case "CHAT_MSG":   return { ...s, chat: { ...s.chat, messages: [...s.chat.messages, a.m] } };
    case "CHAT_BUSY":  return { ...s, chat: { ...s.chat, busy: a.v } };

    case "MKT_MODE":   return { ...s, market: { ...s.market, mode: a.v } };
    case "MKT_QUERY":  return { ...s, market: { ...s.market, query: a.v } };
    case "MKT_RESULT": return { ...s, market: { ...s.market, result: a.v } };
    case "MKT_BUSY":   return { ...s, market: { ...s.market, busy: a.v } };

    case "INV_SEARCH":    return { ...s, inv: { ...s.inv, search: a.v, page: 1 } };
    case "INV_SORT":      return { ...s, inv: { ...s.inv, sort: a.s } };
    case "INV_PAGE":      return { ...s, inv: { ...s.inv, page: a.n } };
    case "INV_FORM_SHOW": return { ...s, inv: { ...s.inv, showForm: a.show } };
    case "INV_FORM_EDIT": return { ...s, inv: { ...s.inv, editId: a.id, form: a.form, showForm: true } };
    case "INV_FORM_PATCH": return { ...s, inv: { ...s.inv, form: { ...s.inv.form, ...a.p } } };

    case "INV_SEL_TOGGLE": {
      const sel = s.inv.selected;
      return {
        ...s,
        inv: {
          ...s.inv,
          selected: sel.includes(a.id) ? sel.filter(id => id !== a.id) : [...sel, a.id],
        },
      };
    }
    case "INV_SEL_ALL":   return { ...s, inv: { ...s.inv, selected: a.ids } };
    case "INV_SEL_CLEAR": return { ...s, inv: { ...s.inv, selected: [] } };

    case "ARENA_SET":   return { ...s, arena: { ...s.arena, [a.slot]: a.id } };
    case "ARENA_CLEAR": return { ...s, arena: { a: null, b: null } };
    case "SET_MODAL":   return { ...s, modal: a.id };
    case "SET_SCANNER": return { ...s, showScanner: a.v };

    case "PF_PATCH": return { ...s, partnerForm: { ...s.partnerForm, ...a.p } };
    case "PF_BUSY":  return { ...s, addingPartner: a.v };

    case "DEL_TARGET": return { ...s, deleteTarget: a.id };
    case "UNDO_SET":   return { ...s, undo: a.u };

    default: return s;
  }
}

const PAGE = 25;

// ─────────────────────────────────────────────────────────────────────────────
// Tilt helpers
// ─────────────────────────────────────────────────────────────────────────────

const applyTilt = (e: React.MouseEvent<HTMLDivElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  e.currentTarget.style.transform = `perspective(600px) rotateY(${x * 16}deg) rotateX(${-y * 16}deg) scale3d(1.03,1.03,1.03)`;
};

const resetTilt = (e: React.MouseEvent<HTMLDivElement>) => {
  e.currentTarget.style.transform = "";
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ItemStatus }) {
  const map: Record<ItemStatus, string> = {
    active: "bg-emerald-900 text-emerald-300",
    grading: "bg-yellow-900 text-yellow-300",
    sold: "bg-blue-900 text-blue-300",
  };
  const label: Record<ItemStatus, string> = { active: "Active", grading: "Grading", sold: "Sold" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function FranchiseIcon({ franchise, size = 24 }: { franchise?: string; size?: number }) {
  const cfg = franchiseCfg(franchise);
  const label = franchise?.toLowerCase().includes("pokemon") || franchise?.toLowerCase().includes("pokémon")
    ? "P"
    : franchise?.toLowerCase().includes("one piece") || franchise?.toLowerCase().includes("onepiece")
    ? "OP"
    : "?";
  return (
    <span
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        color: cfg.accent,
        border: `1.5px solid ${cfg.accent}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

interface CollectibleCardProps {
  item: CollectionItem;
  partner?: Partner;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onEdit?: (item: CollectionItem) => void;
  onDelete?: (id: string) => void;
  onMarkSold?: (item: CollectionItem) => void;
  onArena?: (id: string) => void;
  onOpenModal?: (id: string) => void;
  arenaSlot?: "a" | "b" | null;
  compact?: boolean;
}

function CollectibleCard({
  item,
  partner,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onMarkSold,
  onArena,
  onOpenModal,
  arenaSlot,
  compact,
}: CollectibleCardProps) {
  const cfg = franchiseCfg(item.franchise);
  const cost = itemCost(item);
  const profit = itemProfit(item);
  const roiPct = profit != null && cost > 0 ? (profit / cost) * 100 : null;

  return (
    <div
      className={`glass card-tilt holo-card ${cfg.neon} relative flex flex-col rounded-2xl overflow-hidden cursor-pointer select-none transition-all duration-200${selected ? " ring-2 ring-blue-500" : ""}${compact ? " compact-card" : ""}`}
      onMouseMove={applyTilt}
      onMouseLeave={resetTilt}
      onClick={onSelect ? () => onSelect(item.id) : undefined}
      style={{ minHeight: compact ? 120 : 220 }}
    >
      {/* Arena slot badge */}
      {arenaSlot && (
        <div className={`absolute top-2 left-2 z-20 px-2 py-0.5 rounded-full text-xs font-bold ${arenaSlot === "a" ? "bg-blue-600 text-white" : "bg-purple-600 text-white"}`}>
          {arenaSlot === "a" ? "Slot A" : "Slot B"}
        </div>
      )}

      {/* Selection checkbox */}
      {onSelect && (
        <div
          className="absolute top-2 right-2 z-20"
          onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selected ? "bg-blue-500 border-blue-500" : "bg-black/40 border-white/40"}`}>
            {selected && <span className="text-white text-xs">✓</span>}
          </div>
        </div>
      )}

      {/* Image */}
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full object-cover"
          style={{ height: compact ? 70 : 130, objectFit: "cover" }}
        />
      ) : (
        <div
          className="w-full flex items-center justify-center bg-gray-800/50"
          style={{ height: compact ? 70 : 130 }}
        >
          <FranchiseIcon franchise={item.franchise} size={compact ? 32 : 48} />
        </div>
      )}

      {/* Card info */}
      <div className="flex-1 p-2 flex flex-col gap-1">
        <div className="font-bold text-white leading-tight" style={{ fontSize: compact ? 11 : 13 }}>
          {item.name}
        </div>
        <div className="text-gray-400 leading-tight" style={{ fontSize: compact ? 9 : 10 }}>
          {[item.card_set, item.condition, item.psa_grade ? `PSA ${item.psa_grade}` : ""].filter(Boolean).join(" · ")}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <StatusBadge status={item.status} />
          {roiPct != null && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${roiPct >= 0 ? "bg-emerald-900/70 text-emerald-300" : "bg-red-900/70 text-red-300"}`}>
              {fmtPct(roiPct)}
            </span>
          )}
        </div>

        <div className="flex justify-between text-xs text-gray-400 mt-auto pt-1">
          <span>Cost: {fmt$(cost)}</span>
          {item.market_price != null && <span className="text-blue-400">~{fmt$(item.market_price)}</span>}
        </div>
      </div>

      {/* Action buttons */}
      {!compact && (
        <div
          className="card-actions flex gap-1 p-2 bg-black/30 backdrop-blur-sm border-t border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {item.status !== "sold" && onMarkSold && (
            <button
              onClick={() => onMarkSold(item)}
              className="flex-1 text-xs py-1 rounded bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800 transition-colors"
              title="Mark sold"
            >✓</button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(item)}
              className="flex-1 text-xs py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              title="Edit"
            >✏</button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(item.id)}
              className="flex-1 text-xs py-1 rounded bg-red-900/60 text-red-300 hover:bg-red-800 transition-colors"
              title="Delete"
            >✕</button>
          )}
          {onArena && (
            <button
              onClick={() => onArena(item.id)}
              className="flex-1 text-xs py-1 rounded bg-purple-900/60 text-purple-300 hover:bg-purple-800 transition-colors"
              title="Arena"
            >⚔</button>
          )}
          {onOpenModal && (
            <button
              onClick={() => onOpenModal(item.id)}
              className="flex-1 text-xs py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              title="Detail"
            >🔍</button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CardDetailModal
// ─────────────────────────────────────────────────────────────────────────────

function CardDetailModal({
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
  useEffect(() => {
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
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

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

// ─────────────────────────────────────────────────────────────────────────────
// ArenaView
// ─────────────────────────────────────────────────────────────────────────────

function ArenaView({
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

  // Grading recommendation logic
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
        {/* Slot A */}
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
        {/* Slot B */}
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

      {/* Comparison table */}
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
                {
                  label: "Total Cost",
                  a: itemA ? fmt$(costA) : "—",
                  b: itemB ? fmt$(costB) : "—",
                },
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
                {
                  label: "Condition",
                  a: itemA ? itemA.condition : "—",
                  b: itemB ? itemB.condition : "—",
                },
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

      {/* Grading recommendation */}
      {gradingRec && (
        <div className="bg-purple-950/40 border border-purple-800/50 rounded-xl p-4 mb-4">
          <div className="text-xs font-bold text-purple-300 mb-1">Grading Recommendation</div>
          <div className="text-sm text-gray-200">{gradingRec}</div>
        </div>
      )}

      {/* AI Deep Compare — web search on both cards */}
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
// ArenaAICompare — calls Market AI with web search to compare two cards
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
// BatchBar
// ─────────────────────────────────────────────────────────────────────────────

function BatchBar({
  count,
  onStatusUpdate,
  onPriceUpdate,
  onExport,
  onDelete,
  onClear,
}: {
  count: number;
  onStatusUpdate: () => void;
  onPriceUpdate: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div className="batch-bar fixed bottom-16 md:bottom-0 inset-x-0 z-30 flex items-center justify-between gap-2 px-4 py-3 bg-gray-900/95 backdrop-blur-xl border-t border-gray-700 shadow-2xl">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-white">{count} selected</span>
        <button onClick={onClear} className="text-xs text-gray-500 hover:text-white">✕ Clear</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={onStatusUpdate}>Status</Button>
        <Button size="sm" variant="outline" onClick={onPriceUpdate}>Price</Button>
        <Button size="sm" variant="outline" onClick={onExport}>Export</Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>Delete All</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BottomNav
// ─────────────────────────────────────────────────────────────────────────────

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: "brain", icon: "🧠", label: "Brain" },
    { key: "inventory", icon: "📦", label: "Inv" },
    { key: "arena", icon: "⚔️", label: "Arena" },
    { key: "market", icon: "🌐", label: "Market" },
    { key: "partners", icon: "🤝", label: "Partners" },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex border-t border-gray-800 bg-gray-950/95 backdrop-blur-xl md:hidden bottom-nav-safe">
      {tabs.map(({ key, icon, label }) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
            tab === key ? "text-blue-400" : "text-gray-600 hover:text-gray-300"
          }`}
        >
          <span className="text-lg leading-none">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main CollectPro component
// ─────────────────────────────────────────────────────────────────────────────

export default function CollectPro() {
  const [s, d] = useReducer(reducer, INIT);
  const aiAbort    = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const undoTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Initial data load ──────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const [{ data: items }, { data: partners }] = await Promise.all([
        supabase.from("coll_items").select("*").order("buy_date", { ascending: false }),
        supabase.from("coll_partners").select("*").order("name"),
      ]);
      d({ t: "LOAD_OK", items: (items as CollectionItem[]) ?? [], partners: (partners as Partner[]) ?? [] });
    })();
  }, []);

  // ── Event bus — Supabase Realtime ──────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel("collectpro-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "coll_items" },
        (payload) => {
          d({ t: "RT_ITEM", event: payload.eventType, item: (payload.new ?? payload.old) as CollectionItem });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "coll_partners" },
        (payload) => {
          d({ t: "RT_PARTNER", event: payload.eventType, partner: (payload.new ?? payload.old) as Partner });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [s.chat.messages]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const stats = useMemo(() => computeStats(s.items), [s.items]);

  const filteredItems = useMemo(() => {
    const q = s.inv.search.toLowerCase();
    return s.items.filter((i) =>
      (!q ||
        i.name.toLowerCase().includes(q) ||
        (i.card_set ?? "").toLowerCase().includes(q) ||
        (i.franchise ?? "").toLowerCase().includes(q)) &&
      (!s.franchise || !!i.franchise)
    );
  }, [s.items, s.inv.search, s.franchise]);

  const sortedItems = useMemo(() => {
    const arr = [...filteredItems];
    const { field, dir } = s.inv.sort;
    arr.sort((a, b) => {
      const av = a[field] ?? "";
      const bv = b[field] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "he");
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredItems, s.inv.sort]);

  const pagedItems = useMemo(() => {
    const start = (s.inv.page - 1) * PAGE;
    return sortedItems.slice(start, start + PAGE);
  }, [sortedItems, s.inv.page]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE));

  const partnerStats = useMemo(
    () =>
      s.partners.map((p) => ({
        partner: p,
        stats: computeStats(s.items.filter((i) => i.partner_id === p.id)),
      })),
    [s.partners, s.items]
  );

  const portfolioCtx = useMemo(
    () =>
      JSON.stringify({
        stats,
        items: s.items.slice(0, 80).map((i) => ({
          name: i.name,
          set: i.card_set,
          status: i.status,
          buy: i.buy_price,
          grading: i.grading_cost,
          market: i.market_price,
          sold: i.sell_price,
          buy_date: i.buy_date,
          partner: s.partners.find((p) => p.id === i.partner_id)?.name,
        })),
      }),
    [s.items, s.partners, stats]
  );

  // ── Sort helpers ───────────────────────────────────────────────────────────

  const toggleSort = useCallback(
    (field: SortConfig["field"]) => {
      d({
        t: "INV_SORT",
        s:
          s.inv.sort.field === field
            ? { field, dir: s.inv.sort.dir === "asc" ? "desc" : "asc" }
            : { field, dir: "asc" },
      });
    },
    [s.inv.sort]
  );

  const sortArrow = (field: SortConfig["field"]) =>
    s.inv.sort.field !== field ? " ↕" : s.inv.sort.dir === "asc" ? " ↑" : " ↓";

  // ── Item CRUD ──────────────────────────────────────────────────────────────

  const saveItem = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const f = s.inv.form;
      if (!f.name.trim()) { toast.error("Name is required"); return; }
      if (!f.buy_price || isNaN(+f.buy_price)) { toast.error("Valid buy price required"); return; }
      if (!f.partner_id) { toast.error("Partner is required"); return; }

      const dup = s.items.some(
        (i) =>
          i.id !== s.inv.editId &&
          i.name.toLowerCase() === f.name.toLowerCase() &&
          i.partner_id === f.partner_id
      );
      if (dup) toast.warning(`"${f.name}" already exists for this partner`);

      const payload = {
        name: f.name.trim(),
        card_set: f.card_set || null,
        franchise: f.franchise || null,
        condition: f.condition,
        buy_price: +f.buy_price,
        grading_cost: +(f.grading_cost) || 0,
        market_price: f.market_price ? +f.market_price : null,
        sell_price: null as number | null,
        buy_date: f.buy_date || today(),
        status: f.status as ItemStatus,
        partner_id: f.partner_id,
        notes: f.notes || null,
        image_url: f.image_url || null,
        psa_grade: f.psa_grade ? +f.psa_grade : null,
      };

      try {
        let itemId: string;
        if (s.inv.editId) {
          const { error } = await supabase.from("coll_items").update(payload).eq("id", s.inv.editId);
          if (error) throw error;
          itemId = s.inv.editId;
          toast.success("Item updated");
        } else {
          itemId = crypto.randomUUID();
          const { error } = await supabase.from("coll_items").insert({ ...payload, id: itemId });
          if (error) throw error;
          toast.success("Item added");
        }

        // Record price point in history when market_price is set
        if (payload.market_price != null) {
          supabase.from("cp_price_history").insert({
            item_id: itemId,
            price: payload.market_price,
            source: "manual",
            note: "Market estimate updated via form",
          }).then(({ error }) => {
            if (error) console.warn("Price history insert failed:", error.message);
          });
        }

        d({ t: "INV_FORM_SHOW", show: false });
        d({ t: "INV_FORM_EDIT", id: null, form: emptyForm(f.partner_id) });
      } catch (err: unknown) {
        toast.error(`Error: ${(err as Error).message}`);
      }
    },
    [s.inv.form, s.inv.editId, s.items]
  );

  const startEdit = useCallback((item: CollectionItem) => {
    d({
      t: "INV_FORM_EDIT",
      id: item.id,
      form: {
        name: item.name,
        card_set: item.card_set ?? "",
        franchise: item.franchise ?? "",
        condition: item.condition,
        buy_price: String(item.buy_price),
        grading_cost: String(item.grading_cost ?? 0),
        market_price: item.market_price != null ? String(item.market_price) : "",
        buy_date: item.buy_date,
        status: item.status,
        partner_id: item.partner_id,
        notes: item.notes ?? "",
        image_url: item.image_url ?? "",
        psa_grade: item.psa_grade != null ? String(item.psa_grade) : "",
      },
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!s.deleteTarget) return;
    const target = s.items.find((i) => i.id === s.deleteTarget);
    if (!target) { d({ t: "DEL_TARGET", id: null }); return; }

    const { error } = await supabase.from("coll_items").delete().eq("id", s.deleteTarget);
    if (error) { toast.error(`Error: ${error.message}`); d({ t: "DEL_TARGET", id: null }); return; }

    d({ t: "UNDO_SET", u: { item: target, at: Date.now() } });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => d({ t: "UNDO_SET", u: null }), 30_000);
    d({ t: "DEL_TARGET", id: null });
    toast("Item deleted — you have 30s to undo");
  }, [s.deleteTarget, s.items]);

  const undoDelete = useCallback(async (item: CollectionItem) => {
    const { error } = await supabase.from("coll_items").insert(item);
    if (error) { toast.error(`Restore error: ${error.message}`); return; }
    d({ t: "UNDO_SET", u: null });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    toast.success("Item restored");
  }, []);

  const markSold = useCallback(async (item: CollectionItem) => {
    const raw = window.prompt(`Sale price for "${item.name}":`, String(item.market_price ?? ""));
    if (raw === null) return;
    const price = +raw;
    if (isNaN(price) || price < 0) { toast.error("Invalid price"); return; }
    const soldAt = new Date().toISOString();
    const { error } = await supabase
      .from("coll_items")
      .update({ status: "sold", sell_price: price, sold_at: soldAt })
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }

    // Record sell price in price history
    supabase.from("cp_price_history").insert({
      item_id: item.id,
      price,
      source: "sell",
      note: `Sold at ${fmt$(price)}`,
    }).then(({ error: e }) => { if (e) console.warn("Price history:", e.message); });

    const cost = itemCost(item);
    const profit = price - cost;
    toast.success(`Sale recorded · Profit: ${fmt$(profit)} (${fmtPct(cost > 0 ? (profit / cost) * 100 : 0)})`);
  }, []);

  const handleImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately while uploading
    const preview = await compressImage(file).catch(() => null);
    if (!preview) { toast.error("Image processing error"); return; }
    d({ t: "INV_FORM_PATCH", p: { image_url: preview } });

    // Upload to Supabase Storage in background; replace preview URL with CDN URL
    const pathKey = s.inv.editId ?? crypto.randomUUID();
    uploadCardImage(file, pathKey)
      .then((url) => d({ t: "INV_FORM_PATCH", p: { image_url: url } }))
      .catch((err) => {
        // Storage might not be deployed yet — keep base64 preview silently
        console.warn("Storage upload skipped (bucket not configured):", err.message);
      });
  }, [s.inv.editId]);

  // ── Arena handler ──────────────────────────────────────────────────────────

  const addToArena = useCallback((id: string) => {
    if (!s.arena.a) {
      d({ t: "ARENA_SET", slot: "a", id });
    } else if (!s.arena.b && s.arena.a !== id) {
      d({ t: "ARENA_SET", slot: "b", id });
    } else {
      // Replace slot A
      d({ t: "ARENA_SET", slot: "a", id });
    }
    d({ t: "SET_TAB", tab: "arena" });
  }, [s.arena]);

  // ── Batch handlers ─────────────────────────────────────────────────────────

  const batchUpdateStatus = useCallback(async () => {
    const statusOpts: ItemStatus[] = ["active", "grading", "sold"];
    const newStatus = window.prompt(
      `New status for ${s.inv.selected.length} items (active / grading / sold):`
    ) as ItemStatus | null;
    if (!newStatus || !statusOpts.includes(newStatus)) { toast.error("Invalid status"); return; }
    const { error } = await supabase
      .from("coll_items")
      .update({ status: newStatus })
      .in("id", s.inv.selected);
    if (error) { toast.error(error.message); return; }
    d({ t: "INV_SEL_CLEAR" });
    toast.success(`${s.inv.selected.length} items updated to "${newStatus}"`);
  }, [s.inv.selected]);

  const batchUpdatePrice = useCallback(async () => {
    const raw = window.prompt(`New market price for ${s.inv.selected.length} items ($):`);
    if (raw === null) return;
    const price = +raw;
    if (isNaN(price) || price < 0) { toast.error("Invalid price"); return; }
    const { error } = await supabase
      .from("coll_items")
      .update({ market_price: price })
      .in("id", s.inv.selected);
    if (error) { toast.error(error.message); return; }

    // Record price history for each updated item
    const historyRows = s.inv.selected.map((id) => ({
      item_id: id,
      price,
      source: "manual",
      note: `Batch price update to ${fmt$(price)}`,
    }));
    supabase.from("cp_price_history").insert(historyRows)
      .then(({ error: e }) => { if (e) console.warn("Price history batch:", e.message); });

    d({ t: "INV_SEL_CLEAR" });
    toast.success(`Market price updated for ${s.inv.selected.length} items`);
  }, [s.inv.selected]);

  const batchDelete = useCallback(async () => {
    if (!window.confirm(`Delete ${s.inv.selected.length} items? This cannot be undone.`)) return;
    const { error } = await supabase.from("coll_items").delete().in("id", s.inv.selected);
    if (error) { toast.error(error.message); return; }
    d({ t: "INV_SEL_CLEAR" });
    toast.success(`${s.inv.selected.length} items deleted`);
  }, [s.inv.selected]);

  // ── AI — Brain chat ────────────────────────────────────────────────────────

  const sendChat = useCallback(async () => {
    const text = s.chat.input.trim();
    if (!text || s.chat.busy) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    d({ t: "CHAT_MSG", m: userMsg });
    d({ t: "CHAT_INPUT", v: "" });
    d({ t: "CHAT_BUSY", v: true });

    const history = s.chat.messages.slice(-6);
    const messages: ChatMessage[] =
      history.length === 0
        ? [{ role: "user", content: `=== Portfolio ===\n${portfolioCtx}\n\n=== Question ===\n${text}` }]
        : [...history, userMsg];

    aiAbort.current = new AbortController();
    try {
      const reply = await callAI(messages, "brain", { signal: aiAbort.current.signal });
      d({ t: "CHAT_MSG", m: { role: "assistant", content: reply } });
    } catch (err: unknown) {
      if ((err as Error).message !== "ABORTED") toast.error(`AI: ${(err as Error).message}`);
    } finally {
      d({ t: "CHAT_BUSY", v: false });
    }
  }, [s.chat.input, s.chat.busy, s.chat.messages, portfolioCtx]);

  // ── AI — Market scan ───────────────────────────────────────────────────────

  const runScan = useCallback(async () => {
    const query = s.market.query.trim();
    if (!query || s.market.busy) return;
    d({ t: "MKT_RESULT", v: "" });
    d({ t: "MKT_BUSY", v: true });
    aiAbort.current = new AbortController();
    try {
      const result = await callAI(
        [{ role: "user", content: query }],
        s.market.mode,
        { signal: aiAbort.current.signal, cacheKey: query }
      );
      d({ t: "MKT_RESULT", v: result });
    } catch (err: unknown) {
      if ((err as Error).message !== "ABORTED") toast.error(`Scan: ${(err as Error).message}`);
    } finally {
      d({ t: "MKT_BUSY", v: false });
    }
  }, [s.market.query, s.market.busy, s.market.mode]);

  const cancelAI = useCallback(() => {
    aiAbort.current?.abort();
    d({ t: "CHAT_BUSY", v: false });
    d({ t: "MKT_BUSY", v: false });
  }, []);

  // ── Apply AI price to inventory item ────────────────────────────────────────

  const applyMarketPrice = useCallback(async (item: CollectionItem, price: number) => {
    const { error } = await supabase
      .from("coll_items")
      .update({ market_price: price })
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }

    // Record in price history
    await supabase.from("cp_price_history").insert({
      item_id: item.id,
      price,
      source: "market_ai",
      note: `Market AI scan: ${s.market.query.slice(0, 120)}`,
    });

    toast.success(`${item.name} → market price updated to ${fmt$(price)}`);
  }, [s.market.query]);

  // ── Partner CRUD ───────────────────────────────────────────────────────────

  const addPartner = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!s.partnerForm.name.trim()) { toast.error("Name is required"); return; }
      d({ t: "PF_BUSY", v: true });
      const { error } = await supabase.from("coll_partners").insert({
        id: crypto.randomUUID(),
        name: s.partnerForm.name.trim(),
        email: s.partnerForm.email.trim() || null,
      });
      d({ t: "PF_BUSY", v: false });
      if (error) { toast.error(error.message); return; }
      d({ t: "PF_PATCH", p: { name: "", email: "" } });
      toast.success("Partner added");
    },
    [s.partnerForm]
  );

  // ── Modal item ─────────────────────────────────────────────────────────────

  const modalItem = s.modal ? s.items.find((i) => i.id === s.modal) ?? null : null;
  const modalPartner = modalItem ? s.partners.find((p) => p.id === modalItem.partner_id) : undefined;

  // ─────────────────────────────────────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────────────────────────────────────

  if (s.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-400">
        Loading…
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-gray-950 text-gray-100 font-sans">

      {/* ── Camera Scanner overlay ───────────────────────────────────────────── */}
      {s.showScanner && (
        <CameraScanner
          onResult={(card: CardScanResult) => {
            d({
              t: "INV_FORM_PATCH",
              p: {
                name:        card.name,
                card_set:    card.card_set,
                franchise:   card.franchise,
                condition:   (card.condition as ItemForm["condition"]) || "NM",
                notes:       card.notes,
                status:      "active",
                buy_date:    new Date().toISOString().slice(0, 10),
              },
            });
            toast.success(`זוהה: ${card.name || "קלף לא ידוע"}`);
          }}
          onClose={() => d({ t: "SET_SCANNER", v: false })}
        />
      )}

      {/* ── Card detail modal ────────────────────────────────────────────────── */}
      {modalItem && (
        <CardDetailModal
          item={modalItem}
          partner={modalPartner}
          onClose={() => d({ t: "SET_MODAL", id: null })}
          onArena={(id) => { addToArena(id); d({ t: "SET_MODAL", id: null }); }}
        />
      )}

      {/* ── Delete confirmation ──────────────────────────────────────────────── */}
      <AlertDialog open={!!s.deleteTarget} onOpenChange={() => d({ t: "DEL_TARGET", id: null })}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>Permanent Delete</AlertDialogTitle>
            <AlertDialogDescription>
              This item will be permanently deleted. You have 30 seconds to restore it after deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-700 hover:bg-red-800" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Undo bar ─────────────────────────────────────────────────────────── */}
      {s.undo && (
        <div className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-800 border border-gray-600 rounded-xl px-5 py-3 shadow-2xl text-sm">
          <span>"{s.undo.item.name}" deleted</span>
          <Button size="sm" onClick={() => undoDelete(s.undo!.item)}>Undo</Button>
          <button
            className="text-gray-400 hover:text-white"
            onClick={() => {
              d({ t: "UNDO_SET", u: null });
              if (undoTimer.current) clearTimeout(undoTimer.current);
            }}
          >✕</button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-gray-900 via-blue-950 to-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white">CollectPro</h1>
            <p className="text-xs text-gray-500 mt-0.5">TCG Card Portfolio Manager</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
            <span>Franchise only</span>
            <div
              onClick={() => d({ t: "TOGGLE_FRANCHISE" })}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${s.franchise ? "bg-blue-600" : "bg-gray-700"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${s.franchise ? "right-0.5" : "right-4"}`} />
            </div>
          </label>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { label: "Total Invested", value: fmt$(stats.totalCost), color: "text-amber-400" },
            { label: "Active Market Est. ⚠", value: fmt$(stats.estimatedValue), sub: "estimate only", color: "text-blue-400" },
            { label: "Unrealised P&L", value: fmt$(stats.unrealisedPnL), color: stats.unrealisedPnL >= 0 ? "text-emerald-400" : "text-red-400" },
            { label: "Realised Profit", value: fmt$(stats.realisedProfit), color: stats.realisedProfit >= 0 ? "text-emerald-400" : "text-red-400" },
            { label: "ROI", value: fmtPct(stats.roiPct), sub: `${stats.soldCount} sales`, color: stats.roiPct >= 0 ? "text-emerald-400" : "text-red-400" },
          ].map((st) => (
            <div key={st.label} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex-1 min-w-[110px]">
              <div className="text-xs text-gray-500 mb-0.5 leading-tight">{st.label}</div>
              <div className={`text-sm font-bold ${st.color}`}>{st.value}</div>
              {st.sub && <div className="text-xs text-amber-600 mt-0.5">{st.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Desktop Tab bar (hidden on mobile) ──────────────────────────────── */}
      <div className="hidden md:flex bg-gray-900 border-b border-gray-800 overflow-x-auto">
        {(["brain", "inventory", "roi", "arena", "market", "partners"] as Tab[]).map((tab) => {
          const labels: Record<Tab, string> = {
            brain: "🧠 Brain", inventory: "📦 Inventory", roi: "📈 ROI",
            arena: "⚔️ Arena", market: "🌐 Market", partners: "🤝 Partners",
          };
          return (
            <button
              key={tab}
              onClick={() => d({ t: "SET_TAB", tab })}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                s.tab === tab
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-500 hover:text-gray-200"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-3 py-4 pb-20 md:pb-5">

        {/* ══ BRAIN ══════════════════════════════════════════════════════════ */}
        {s.tab === "brain" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-bold mb-1">🧠 Forensic Portfolio Advisor</h2>
            <p className="text-xs text-gray-500 mb-4">Analysis based on your portfolio data. Ask anything — including uncomfortable questions.</p>

            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto mb-3 p-1">
              {s.chat.messages.length === 0 && (
                <p className="text-center text-gray-600 text-sm mt-10">Start asking…</p>
              )}
              {s.chat.messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "self-start bg-gray-700 rounded-tl-sm"
                      : "self-end bg-blue-900/60 rounded-tr-sm"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {s.chat.busy && <div className="self-end text-sm text-gray-500 italic">Analyzing…</div>}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2">
              <Input
                dir="rtl"
                value={s.chat.input}
                onChange={(e) => d({ t: "CHAT_INPUT", v: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask about your portfolio…"
                disabled={s.chat.busy}
                className="bg-gray-800 border-gray-700"
              />
              {s.chat.busy
                ? <Button variant="destructive" onClick={cancelAI}>Cancel</Button>
                : <Button onClick={sendChat} disabled={!s.chat.input.trim()}>Send</Button>
              }
            </div>
          </div>
        )}

        {/* ══ INVENTORY ══════════════════════════════════════════════════════ */}
        {s.tab === "inventory" && (
          <div>
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 mb-3 items-center">
              <Input
                dir="rtl"
                className="flex-1 min-w-[160px] bg-gray-800 border-gray-700"
                value={s.inv.search}
                onChange={(e) => d({ t: "INV_SEARCH", v: e.target.value })}
                placeholder="🔍 Search name, set, franchise…"
              />
              {/* View toggle */}
              <div className="flex rounded-lg overflow-hidden border border-gray-700">
                <button
                  onClick={() => d({ t: "SET_VIEW", mode: "cards" })}
                  className={`px-3 py-2 text-xs transition-colors ${s.viewMode === "cards" ? "bg-blue-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                >
                  Cards
                </button>
                <button
                  onClick={() => d({ t: "SET_VIEW", mode: "table" })}
                  className={`px-3 py-2 text-xs transition-colors ${s.viewMode === "table" ? "bg-blue-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                >
                  Table
                </button>
              </div>
              <Button
                onClick={() => d({ t: "INV_FORM_EDIT", id: null, form: emptyForm(s.partners[0]?.id ?? "") })}
              >
                + Add
              </Button>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => exportCSV(sortedItems, s.partners)}>CSV</Button>
                <Button variant="outline" size="sm" onClick={() => exportEbayCSV(sortedItems)}>eBay</Button>
                <Button variant="outline" size="sm" onClick={() => exportCardmarketCSV(sortedItems)}>CM</Button>
              </div>
            </div>

            {/* Batch select all button */}
            {sortedItems.length > 0 && (
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                <button
                  onClick={() => {
                    if (s.inv.selected.length === sortedItems.length) {
                      d({ t: "INV_SEL_CLEAR" });
                    } else {
                      d({ t: "INV_SEL_ALL", ids: sortedItems.map((i) => i.id) });
                    }
                  }}
                  className="hover:text-white transition-colors"
                >
                  {s.inv.selected.length === sortedItems.length ? "Deselect all" : "Select all"}
                </button>
                {s.inv.selected.length > 0 && (
                  <span className="text-blue-400">{s.inv.selected.length} selected</span>
                )}
              </div>
            )}

            {/* Form */}
            {s.inv.showForm && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold">{s.inv.editId ? "✏ Edit Item" : "➕ New Item"}</h3>
                  <button
                    onClick={() => d({ t: "SET_SCANNER", v: true })}
                    className="scan-btn px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-600 to-orange-600 text-white text-xs font-bold hover:from-yellow-500 hover:to-orange-500 transition-all shadow-lg"
                  >
                    📸 Camera Scan
                  </button>
                </div>
                <form onSubmit={saveItem} className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: "Name *", key: "name", type: "text" },
                      { label: "Set", key: "card_set", type: "text" },
                      { label: "Franchise", key: "franchise", type: "text" },
                    ].map(({ label, key, type }) => (
                      <div key={key}>
                        <label className="text-xs text-gray-400 block mb-1">{label}</label>
                        <Input
                          type={type}
                          dir="rtl"
                          className="bg-gray-800 border-gray-700"
                          value={s.inv.form[key as keyof ItemForm]}
                          onChange={(e) => d({ t: "INV_FORM_PATCH", p: { [key]: e.target.value } })}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Condition</label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100"
                        value={s.inv.form.condition}
                        onChange={(e) => d({ t: "INV_FORM_PATCH", p: { condition: e.target.value } })}
                      >
                        {["M", "NM", "LP", "MP", "HP", "D", "PSA"].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Status</label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100"
                        value={s.inv.form.status}
                        onChange={(e) => d({ t: "INV_FORM_PATCH", p: { status: e.target.value as ItemStatus } })}
                      >
                        <option value="active">Active</option>
                        <option value="grading">Grading</option>
                        <option value="sold">Sold</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Partner *</label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100"
                        value={s.inv.form.partner_id}
                        onChange={(e) => d({ t: "INV_FORM_PATCH", p: { partner_id: e.target.value } })}
                        required
                      >
                        <option value="">Select…</option>
                        {s.partners.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Buy Date</label>
                      <Input
                        type="date"
                        className="bg-gray-800 border-gray-700"
                        value={s.inv.form.buy_date}
                        onChange={(e) => d({ t: "INV_FORM_PATCH", p: { buy_date: e.target.value } })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Buy Price ($) *", key: "buy_price" },
                      { label: "Grading Cost ($)", key: "grading_cost" },
                      { label: "Market Est. ($)", key: "market_price" },
                      { label: "PSA Grade", key: "psa_grade" },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="text-xs text-gray-400 block mb-1">{label}</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="bg-gray-800 border-gray-700"
                          value={s.inv.form[key as keyof ItemForm]}
                          onChange={(e) => d({ t: "INV_FORM_PATCH", p: { [key]: e.target.value } })}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Notes</label>
                    <Input
                      dir="rtl"
                      className="bg-gray-800 border-gray-700"
                      value={s.inv.form.notes}
                      onChange={(e) => d({ t: "INV_FORM_PATCH", p: { notes: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Image (auto-compressed)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImage}
                      className="text-sm text-gray-300"
                    />
                    {s.inv.form.image_url && (
                      <img
                        src={s.inv.form.image_url}
                        alt="preview"
                        className="mt-2 w-16 h-20 object-cover rounded-lg"
                      />
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button type="submit">{s.inv.editId ? "Update" : "Add"}</Button>
                    <Button type="button" variant="outline" onClick={() => d({ t: "INV_FORM_SHOW", show: false })}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Cards View ── */}
            {s.viewMode === "cards" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {pagedItems.map((item) => (
                  <CollectibleCard
                    key={item.id}
                    item={item}
                    partner={s.partners.find((p) => p.id === item.partner_id)}
                    selected={s.inv.selected.includes(item.id)}
                    onSelect={(id) => d({ t: "INV_SEL_TOGGLE", id })}
                    onEdit={startEdit}
                    onDelete={(id) => d({ t: "DEL_TARGET", id })}
                    onMarkSold={markSold}
                    onArena={addToArena}
                    onOpenModal={(id) => d({ t: "SET_MODAL", id })}
                    arenaSlot={
                      s.arena.a === item.id ? "a" : s.arena.b === item.id ? "b" : null
                    }
                  />
                ))}
                {pagedItems.length === 0 && (
                  <div className="col-span-full text-center py-12 text-gray-600">
                    {s.inv.search ? "No results found" : "No items — click Add to start"}
                  </div>
                )}
              </div>
            )}

            {/* ── Table View ── */}
            {s.viewMode === "table" && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-3 py-2.5 text-xs text-gray-400 w-8">
                        <input
                          type="checkbox"
                          checked={s.inv.selected.length === sortedItems.length && sortedItems.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              d({ t: "INV_SEL_ALL", ids: sortedItems.map((i) => i.id) });
                            } else {
                              d({ t: "INV_SEL_CLEAR" });
                            }
                          }}
                          className="cursor-pointer"
                        />
                      </th>
                      {[
                        { label: "Item", field: "name" as const },
                        { label: "Status", field: "status" as const },
                        { label: "Date", field: "buy_date" as const },
                        { label: "Buy", field: "buy_price" as const },
                        { label: "Grading", field: "grading_cost" as const },
                        { label: "Market", field: "market_price" as const },
                        { label: "Sale", field: "sell_price" as const },
                      ].map(({ label, field }) => (
                        <th
                          key={field}
                          className="text-right px-3 py-2.5 text-xs font-semibold text-gray-400 cursor-pointer hover:text-white whitespace-nowrap select-none"
                          onClick={() => toggleSort(field)}
                        >
                          {label}{sortArrow(field)}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-xs font-semibold text-gray-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedItems.map((item) => {
                      const cost   = +item.buy_price + +(item.grading_cost ?? 0);
                      const profit = item.status === "sold" ? +(item.sell_price ?? 0) - cost : null;
                      return (
                        <tr key={item.id} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={s.inv.selected.includes(item.id)}
                              onChange={() => d({ t: "INV_SEL_TOGGLE", id: item.id })}
                              className="cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-9 h-9 rounded-md object-cover flex-shrink-0"
                                />
                              )}
                              <div>
                                <div className="font-semibold">{item.name}</div>
                                <div className="text-xs text-gray-500">
                                  {[item.card_set, item.condition, item.psa_grade ? `PSA ${item.psa_grade}` : ""].filter(Boolean).join(" · ")}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5"><StatusBadge status={item.status} /></td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{item.buy_date}</td>
                          <td className="px-3 py-2.5">{fmt$(item.buy_price)}</td>
                          <td className="px-3 py-2.5 text-amber-400">
                            {item.grading_cost ? fmt$(item.grading_cost) : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-blue-400">
                            {item.market_price != null ? fmt$(item.market_price) : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {item.status === "sold" && item.sell_price != null ? (
                              <div>
                                <div>{fmt$(item.sell_price)}</div>
                                <div className={`text-xs ${profit! >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {profit! >= 0 ? "+" : ""}{fmt$(profit!)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1.5">
                              {item.status !== "sold" && (
                                <button
                                  onClick={() => markSold(item)}
                                  className="text-xs px-2 py-1 bg-emerald-900/60 text-emerald-300 rounded hover:bg-emerald-800 transition-colors"
                                  title="Mark sold"
                                >✓</button>
                              )}
                              <button
                                onClick={() => startEdit(item)}
                                className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                              >✏</button>
                              <button
                                onClick={() => d({ t: "DEL_TARGET", id: item.id })}
                                className="text-xs px-2 py-1 bg-red-900/60 text-red-300 rounded hover:bg-red-800 transition-colors"
                              >✕</button>
                              <button
                                onClick={() => addToArena(item.id)}
                                className="text-xs px-2 py-1 bg-purple-900/60 text-purple-300 rounded hover:bg-purple-800 transition-colors"
                                title="Arena"
                              >⚔</button>
                              <button
                                onClick={() => d({ t: "SET_MODAL", id: item.id })}
                                className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                                title="Detail"
                              >🔍</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {pagedItems.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-10 text-gray-600">
                          {s.inv.search ? "No results" : "No items — click Add"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-end gap-3 px-4 py-2.5 text-sm text-gray-500 border-t border-gray-800">
                    <span>{sortedItems.length} items</span>
                    <button
                      disabled={s.inv.page === 1}
                      onClick={() => d({ t: "INV_PAGE", n: s.inv.page - 1 })}
                      className="px-2 py-1 rounded bg-gray-800 disabled:opacity-30 hover:bg-gray-700"
                    >◀</button>
                    <span>Page {s.inv.page} / {totalPages}</span>
                    <button
                      disabled={s.inv.page === totalPages}
                      onClick={() => d({ t: "INV_PAGE", n: s.inv.page + 1 })}
                      className="px-2 py-1 rounded bg-gray-800 disabled:opacity-30 hover:bg-gray-700"
                    >▶</button>
                  </div>
                )}
              </div>
            )}

            {/* Pagination for cards view */}
            {s.viewMode === "cards" && totalPages > 1 && (
              <div className="flex items-center justify-end gap-3 px-4 py-2.5 text-sm text-gray-500 mt-2">
                <span>{sortedItems.length} items</span>
                <button
                  disabled={s.inv.page === 1}
                  onClick={() => d({ t: "INV_PAGE", n: s.inv.page - 1 })}
                  className="px-2 py-1 rounded bg-gray-800 disabled:opacity-30 hover:bg-gray-700"
                >◀</button>
                <span>Page {s.inv.page} / {totalPages}</span>
                <button
                  disabled={s.inv.page === totalPages}
                  onClick={() => d({ t: "INV_PAGE", n: s.inv.page + 1 })}
                  className="px-2 py-1 rounded bg-gray-800 disabled:opacity-30 hover:bg-gray-700"
                >▶</button>
              </div>
            )}
          </div>
        )}

        {/* ══ ROI ════════════════════════════════════════════════════════════ */}
        {s.tab === "roi" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Invested (incl. grading)", value: fmt$(stats.totalCost), cls: "text-amber-400" },
                { label: "Sale Revenue", value: fmt$(stats.realisedRevenue), cls: "text-blue-400" },
                { label: "Net Realised Profit", value: fmt$(stats.realisedProfit), cls: stats.realisedProfit >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Realised ROI", value: fmtPct(stats.roiPct), cls: stats.roiPct >= 0 ? "text-emerald-400" : "text-red-400" },
              ].map((st) => (
                <div key={st.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">{st.label}</div>
                  <div className={`text-lg font-bold ${st.cls}`}>{st.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-auto">
              <div className="px-4 py-3 border-b border-gray-800 font-semibold text-sm">Sold Transactions</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {["Item", "Buy", "Grading", "Base Cost", "Sale", "Net Profit", "ROI", "Partner"].map((h) => (
                      <th key={h} className="text-right px-3 py-2.5 text-xs font-semibold text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.items.filter((i) => i.status === "sold" && i.sell_price != null).map((i) => {
                    const base   = +i.buy_price + +(i.grading_cost ?? 0);
                    const profit = +(i.sell_price ?? 0) - base;
                    const roi    = base > 0 ? (profit / base) * 100 : 0;
                    return (
                      <tr key={i.id} className="border-b border-gray-800/40 hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 font-semibold">{i.name}</td>
                        <td className="px-3 py-2.5">{fmt$(i.buy_price)}</td>
                        <td className="px-3 py-2.5 text-amber-400">{i.grading_cost ? fmt$(i.grading_cost) : "—"}</td>
                        <td className="px-3 py-2.5 text-amber-300 font-medium">{fmt$(base)}</td>
                        <td className="px-3 py-2.5">{fmt$(i.sell_price!)}</td>
                        <td className={`px-3 py-2.5 font-semibold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {profit >= 0 ? "+" : ""}{fmt$(profit)}
                        </td>
                        <td className={`px-3 py-2.5 ${roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtPct(roi)}</td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">
                          {s.partners.find((p) => p.id === i.partner_id)?.name ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {s.items.filter((i) => i.status === "sold").length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-600">No sold transactions yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ ARENA ══════════════════════════════════════════════════════════ */}
        {s.tab === "arena" && (
          <div>
            <h2 className="font-bold mb-1">⚔️ Card Arena</h2>
            <p className="text-xs text-gray-500 mb-4">Compare two cards side by side. Pick cards from the grid below or use the ⚔ button in inventory.</p>

            <ArenaView
              items={s.items}
              arenaA={s.arena.a}
              arenaB={s.arena.b}
              partners={s.partners}
              dispatch={d}
            />

            {/* Item picker grid */}
            {s.items.length > 0 && (
              <div className="mt-6">
                <div className="text-xs text-gray-500 mb-3 font-semibold">PICK CARDS FOR ARENA</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {s.items.slice(0, 24).map((item) => (
                    <CollectibleCard
                      key={item.id}
                      item={item}
                      compact
                      arenaSlot={
                        s.arena.a === item.id ? "a" : s.arena.b === item.id ? "b" : null
                      }
                      onArena={addToArena}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ MARKET ═════════════════════════════════════════════════════════ */}
        {s.tab === "market" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-bold mb-1">🌐 Market Scan — Forensic Truth</h2>
            <p className="text-xs text-gray-500 mb-4">
              AI with web search. Searches eBay, TCGPlayer, PSA Registry and cites sources.
              Results are automatically saved to the knowledge base.
            </p>

            <div className="flex gap-2 mb-3">
              {(["market", "arbitrage"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => d({ t: "MKT_MODE", v: m })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    s.market.mode === m ? "bg-blue-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {m === "market" ? "🔍 Prices" : "⚡ Arbitrage"}
                </button>
              ))}
            </div>

            <Textarea
              dir="rtl"
              className="bg-gray-800 border-gray-700 mb-3 resize-y"
              rows={3}
              value={s.market.query}
              onChange={(e) => d({ t: "MKT_QUERY", v: e.target.value })}
              placeholder={
                s.market.mode === "market"
                  ? "e.g. What is the price of PSA 10 Charizard Base Set 1st Edition?"
                  : "e.g. Arbitrage opportunities in One Piece Paramount War cards"
              }
            />

            <div className="flex gap-2">
              {s.market.busy
                ? <Button variant="destructive" onClick={cancelAI}>Cancel Scan</Button>
                : <Button onClick={runScan} disabled={!s.market.query.trim()}>🔍 Run Scan</Button>
              }
            </div>

            {s.market.busy && (
              <p className="text-sm text-gray-500 mt-3">Scanning… (15–30 seconds)</p>
            )}

            {s.market.result && (() => {
              const price  = extractFirstPrice(s.market.result);
              const matches = findMatchingItems(s.market.query, s.items.filter((i) => i.status === "active"));
              return (
                <>
                  {price != null && matches.length > 0 && (
                    <div className="mt-3 p-3 bg-green-950/50 border border-green-800 rounded-xl">
                      <p className="text-xs text-green-400 font-semibold mb-2">
                        📌 Apply {fmt$(price)} to inventory?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {matches.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => applyMarketPrice(item, price)}
                            className="px-2 py-1 rounded-lg bg-green-800/60 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                    {s.market.result}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ══ PARTNERS ═══════════════════════════════════════════════════════ */}
        {s.tab === "partners" && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-bold mb-3">➕ Add Partner</h3>
              <form onSubmit={addPartner} className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-gray-400 block mb-1">Name *</label>
                  <Input
                    dir="rtl"
                    className="bg-gray-800 border-gray-700"
                    value={s.partnerForm.name}
                    onChange={(e) => d({ t: "PF_PATCH", p: { name: e.target.value } })}
                    required
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-gray-400 block mb-1">Email</label>
                  <Input
                    type="email"
                    className="bg-gray-800 border-gray-700"
                    value={s.partnerForm.email}
                    onChange={(e) => d({ t: "PF_PATCH", p: { email: e.target.value } })}
                  />
                </div>
                <Button type="submit" disabled={s.addingPartner}>
                  {s.addingPartner ? "Adding…" : "Add"}
                </Button>
              </form>
            </div>

            {partnerStats.map(({ partner, stats: ps }) => (
              <div key={partner.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold text-base">{partner.name}</div>
                    {partner.email && <div className="text-xs text-gray-500">{partner.email}</div>}
                    <div className="text-xs text-gray-600 mt-0.5">
                      {ps.activeCount} active · {ps.gradingCount} grading · {ps.soldCount} sold
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportCSV(s.items.filter((i) => i.partner_id === partner.id), s.partners, `${partner.name}.csv`)}
                  >
                    ⬇ CSV
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  {[
                    { label: "Total Invested", value: fmt$(ps.totalCost), cls: "text-amber-400" },
                    { label: "Active Market Est.", value: fmt$(ps.estimatedValue), cls: "text-blue-400" },
                    { label: "Sale Revenue", value: fmt$(ps.realisedRevenue), cls: "text-emerald-400" },
                    { label: "Net Profit + ROI", value: `${fmt$(ps.realisedProfit)} (${fmtPct(ps.roiPct)})`, cls: ps.realisedProfit >= 0 ? "text-emerald-400" : "text-red-400" },
                  ].map((st) => (
                    <div key={st.label} className="bg-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">{st.label}</div>
                      <div className={`text-sm font-bold ${st.cls}`}>{st.value}</div>
                    </div>
                  ))}
                </div>

                {s.items.filter((i) => i.partner_id === partner.id).slice(0, 4).map((i) => {
                  const base   = +i.buy_price + +(i.grading_cost ?? 0);
                  const value  = i.status === "sold" ? +(i.sell_price ?? 0) : +(i.market_price ?? i.buy_price);
                  const profit = value - base;
                  return (
                    <div key={i.id} className="flex justify-between items-center py-1.5 border-t border-gray-800 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{i.name}</span>
                        <StatusBadge status={i.status} />
                      </div>
                      <span className={profit >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {profit >= 0 ? "+" : ""}{fmt$(profit)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

            {s.partners.length === 0 && (
              <div className="text-center py-12 text-gray-600">No partners — add the first one above</div>
            )}
          </div>
        )}

      </div>

      {/* ── Batch bar ────────────────────────────────────────────────────────── */}
      {s.inv.selected.length > 0 && (
        <BatchBar
          count={s.inv.selected.length}
          onStatusUpdate={batchUpdateStatus}
          onPriceUpdate={batchUpdatePrice}
          onExport={() => exportCSV(s.items.filter((i) => s.inv.selected.includes(i.id)), s.partners)}
          onDelete={batchDelete}
          onClear={() => d({ t: "INV_SEL_CLEAR" })}
        />
      )}

      {/* ── Mobile bottom nav ────────────────────────────────────────────────── */}
      <BottomNav tab={s.tab} setTab={(tab) => d({ t: "SET_TAB", tab })} />

    </div>
  );
}
