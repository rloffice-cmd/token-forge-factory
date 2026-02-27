/**
 * CollectPro — TCG Card Portfolio Manager
 *
 * Layer architecture:
 *   Knowledge   → coll_items, coll_partners, cp_knowledge  (Supabase)
 *   Definitions → cp_instructions, cp_instruction_patches  (Supabase)
 *   Logic       → this file + src/lib/collectpro/*         (client)
 *
 * Event bus → Supabase Realtime channels
 *   Any mutation by any client is automatically broadcast to all others.
 *
 * State management → useReducer (single source of truth, predictable mutations)
 */

import React, {
  useReducer,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Shadcn UI
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

// Domain lib
import type {
  CollectionItem,
  Partner,
  ChatMessage,
  SortConfig,
  ItemForm,
  ItemStatus,
  AIMode,
  Tab,
  UndoBuffer,
} from "@/lib/collectpro/types";
import { computeStats, fmt$, fmtPct } from "@/lib/collectpro/stats";
import { callAI } from "@/lib/collectpro/ai";
import { compressImage } from "@/lib/collectpro/image";
import { exportCSV } from "@/lib/collectpro/export";

// ─────────────────────────────────────────────────────────────────────────────
// State shape & reducer
// ─────────────────────────────────────────────────────────────────────────────

type State = {
  items:    CollectionItem[];
  partners: Partner[];
  loading:  boolean;
  tab:      Tab;
  franchise: boolean; // franchise-only filter toggle

  // Tab-level state — all persisted, never lost on tab switch
  chat: { messages: ChatMessage[]; input: string; busy: boolean };
  market: { mode: AIMode; query: string; result: string; busy: boolean };
  inv: {
    search:    string;
    sort:      SortConfig;
    page:      number;
    showForm:  boolean;
    editId:    string | null;
    form:      ItemForm;
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
  tab: "brain", franchise: false,
  chat:   { messages: [], input: "", busy: false },
  market: { mode: "market", query: "", result: "", busy: false },
  inv: {
    search: "", sort: { field: "buy_date", dir: "desc" },
    page: 1, showForm: false, editId: null, form: emptyForm(""),
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

    case "PF_PATCH": return { ...s, partnerForm: { ...s.partnerForm, ...a.p } };
    case "PF_BUSY":  return { ...s, addingPartner: a.v };

    case "DEL_TARGET": return { ...s, deleteTarget: a.id };
    case "UNDO_SET":   return { ...s, undo: a.u };

    default: return s;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page size
// ─────────────────────────────────────────────────────────────────────────────

const PAGE = 25;

// ─────────────────────────────────────────────────────────────────────────────
// Main component
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
  // Any client mutation is broadcast here automatically (no manual sync needed)

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

  // ── Derived data (useMemo — not recomputed on every keystroke) ─────────────

  const stats = useMemo(() => computeStats(s.items), [s.items]);

  const filteredItems = useMemo(() => {
    const q = s.inv.search.toLowerCase();
    return s.items.filter((i) =>
      (!q || i.name.toLowerCase().includes(q) ||
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
      const cmp = typeof av === "number" && typeof bv === "number"
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
    () => s.partners.map((p) => ({ partner: p, stats: computeStats(s.items.filter((i) => i.partner_id === p.id)) })),
    [s.partners, s.items]
  );

  // ── Portfolio context for AI (truncated to last 8 items for context window) ─

  const portfolioCtx = useMemo(() => JSON.stringify({
    stats,
    items: s.items.slice(0, 80).map((i) => ({
      name: i.name, set: i.card_set, status: i.status,
      buy: i.buy_price, grading: i.grading_cost,
      market: i.market_price, sold: i.sell_price,
      buy_date: i.buy_date, partner: s.partners.find((p) => p.id === i.partner_id)?.name,
    })),
  }), [s.items, s.partners, stats]);

  // ── Sort toggle ────────────────────────────────────────────────────────────

  const toggleSort = useCallback((field: SortConfig["field"]) => {
    d({
      t: "INV_SORT",
      s: s.inv.sort.field === field
        ? { field, dir: s.inv.sort.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    });
  }, [s.inv.sort]);

  const sortArrow = (field: SortConfig["field"]) =>
    s.inv.sort.field !== field ? " ↕" : s.inv.sort.dir === "asc" ? " ↑" : " ↓";

  // ── Item CRUD ──────────────────────────────────────────────────────────────

  const saveItem = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const f = s.inv.form;
    if (!f.name.trim()) { toast.error("נדרש שם"); return; }
    if (!f.buy_price || isNaN(+f.buy_price)) { toast.error("נדרש מחיר קנייה תקין"); return; }
    if (!f.partner_id) { toast.error("נדרש שותף"); return; }

    const dup = s.items.some(
      (i) => i.id !== s.inv.editId &&
             i.name.toLowerCase() === f.name.toLowerCase() &&
             i.partner_id === f.partner_id
    );
    if (dup) toast.warning(`"${f.name}" כבר קיים עבור שותף זה`);

    const payload = {
      name: f.name.trim(), card_set: f.card_set || null, franchise: f.franchise || null,
      condition: f.condition, buy_price: +f.buy_price, grading_cost: +(f.grading_cost) || 0,
      market_price: f.market_price ? +f.market_price : null,
      sell_price: null as number | null,
      buy_date: f.buy_date || today(), status: f.status as ItemStatus,
      partner_id: f.partner_id, notes: f.notes || null,
      image_url: f.image_url || null,
      psa_grade: f.psa_grade ? +f.psa_grade : null,
    };

    try {
      if (s.inv.editId) {
        const { error } = await supabase.from("coll_items").update(payload).eq("id", s.inv.editId);
        if (error) throw error;
        // Realtime will update state automatically
        toast.success("פריט עודכן");
      } else {
        const id = crypto.randomUUID();
        const { error } = await supabase.from("coll_items").insert({ ...payload, id });
        if (error) throw error;
        toast.success("פריט נוסף");
      }
      d({ t: "INV_FORM_SHOW", show: false });
      d({ t: "INV_FORM_EDIT", id: null, form: emptyForm(f.partner_id) });
    } catch (err: unknown) {
      toast.error(`שגיאה: ${(err as Error).message}`);
    }
  }, [s.inv.form, s.inv.editId, s.items]);

  const startEdit = useCallback((item: CollectionItem) => {
    d({
      t: "INV_FORM_EDIT", id: item.id, form: {
        name: item.name, card_set: item.card_set ?? "", franchise: item.franchise ?? "",
        condition: item.condition, buy_price: String(item.buy_price),
        grading_cost: String(item.grading_cost ?? 0),
        market_price: item.market_price != null ? String(item.market_price) : "",
        buy_date: item.buy_date, status: item.status, partner_id: item.partner_id,
        notes: item.notes ?? "", image_url: item.image_url ?? "",
        psa_grade: item.psa_grade != null ? String(item.psa_grade) : "",
      },
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!s.deleteTarget) return;
    const target = s.items.find((i) => i.id === s.deleteTarget);
    if (!target) { d({ t: "DEL_TARGET", id: null }); return; }

    const { error } = await supabase.from("coll_items").delete().eq("id", s.deleteTarget);
    if (error) { toast.error(`שגיאה: ${error.message}`); d({ t: "DEL_TARGET", id: null }); return; }

    // Realtime handles state update; set undo buffer
    d({ t: "UNDO_SET", u: { item: target, at: Date.now() } });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => d({ t: "UNDO_SET", u: null }), 30_000);
    d({ t: "DEL_TARGET", id: null });
    toast("פריט נמחק — ניתן לשחזר תוך 30 שניות");
  }, [s.deleteTarget, s.items]);

  const undoDelete = useCallback(async (item: CollectionItem) => {
    const { error } = await supabase.from("coll_items").insert(item);
    if (error) { toast.error(`שגיאת שחזור: ${error.message}`); return; }
    d({ t: "UNDO_SET", u: null });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    toast.success("פריט שוחזר");
  }, []);

  const markSold = useCallback(async (item: CollectionItem) => {
    const raw = window.prompt(`מחיר מכירה עבור "${item.name}":`, String(item.market_price ?? ""));
    if (raw === null) return;
    const price = +raw;
    if (isNaN(price) || price < 0) { toast.error("מחיר לא תקין"); return; }
    const soldAt = new Date().toISOString();
    const { error } = await supabase
      .from("coll_items")
      .update({ status: "sold", sell_price: price, sold_at: soldAt })
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    const profit = price - (+item.buy_price) - (+(item.grading_cost ?? 0));
    toast.success(`מכירה נרשמה · רווח: ${fmt$(profit)} (${fmtPct((profit / (+item.buy_price + +(item.grading_cost ?? 0))) * 100)})`);
  }, []);

  // ── Image upload ───────────────────────────────────────────────────────────

  const handleImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file).catch(() => null);
    if (!compressed) { toast.error("שגיאה בעיבוד תמונה"); return; }
    d({ t: "INV_FORM_PATCH", p: { image_url: compressed } });
  }, []);

  // ── AI — Brain chat ────────────────────────────────────────────────────────

  const sendChat = useCallback(async () => {
    const text = s.chat.input.trim();
    if (!text || s.chat.busy) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    d({ t: "CHAT_MSG", m: userMsg });
    d({ t: "CHAT_INPUT", v: "" });
    d({ t: "CHAT_BUSY", v: true });

    // First message carries full portfolio context; subsequent carry last 6 messages
    const history = s.chat.messages.slice(-6);
    const messages: ChatMessage[] = history.length === 0
      ? [{ role: "user", content: `=== פורטפוליו ===\n${portfolioCtx}\n\n=== שאלה ===\n${text}` }]
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
      if ((err as Error).message !== "ABORTED") toast.error(`סריקה: ${(err as Error).message}`);
    } finally {
      d({ t: "MKT_BUSY", v: false });
    }
  }, [s.market.query, s.market.busy, s.market.mode]);

  const cancelAI = useCallback(() => {
    aiAbort.current?.abort();
    d({ t: "CHAT_BUSY", v: false });
    d({ t: "MKT_BUSY", v: false });
  }, []);

  // ── Partner CRUD ───────────────────────────────────────────────────────────

  const addPartner = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s.partnerForm.name.trim()) { toast.error("נדרש שם"); return; }
    d({ t: "PF_BUSY", v: true });
    const { error } = await supabase.from("coll_partners").insert({
      id: crypto.randomUUID(),
      name: s.partnerForm.name.trim(),
      email: s.partnerForm.email.trim() || null,
    });
    d({ t: "PF_BUSY", v: false });
    if (error) { toast.error(error.message); return; }
    d({ t: "PF_PATCH", p: { name: "", email: "" } });
    toast.success("שותף נוסף");
  }, [s.partnerForm]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const StatusBadge = ({ status }: { status: ItemStatus }) => {
    const map: Record<ItemStatus, string> = {
      active: "bg-emerald-900 text-emerald-300",
      grading: "bg-yellow-900 text-yellow-300",
      sold: "bg-blue-900 text-blue-300",
    };
    const label: Record<ItemStatus, string> = { active: "פעיל", grading: "גריידינג", sold: "נמכר" };
    return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>{label[status]}</span>;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────────────────────────────────────

  if (s.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-400">
        טוען…
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-gray-950 text-gray-100 font-sans">

      {/* ── Delete confirmation ──────────────────────────────────────────────── */}
      <AlertDialog open={!!s.deleteTarget} onOpenChange={() => d({ t: "DEL_TARGET", id: null })}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקה בלתי הפיכה</AlertDialogTitle>
            <AlertDialogDescription>
              פריט זה יימחק לצמיתות ממסד הנתונים. יש לך 30 שניות לשחזור לאחר המחיקה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction className="bg-red-700 hover:bg-red-800" onClick={confirmDelete}>
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Undo toast bar ───────────────────────────────────────────────────── */}
      {s.undo && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-800 border border-gray-600 rounded-xl px-5 py-3 shadow-2xl text-sm">
          <span>"{s.undo.item.name}" נמחק</span>
          <Button size="sm" onClick={() => undoDelete(s.undo!.item)}>בטל מחיקה</Button>
          <button className="text-gray-400 hover:text-white" onClick={() => { d({ t: "UNDO_SET", u: null }); if (undoTimer.current) clearTimeout(undoTimer.current); }}>✕</button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-gray-900 via-blue-950 to-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white">CollectPro</h1>
            <p className="text-xs text-gray-500 mt-0.5">ניהול פורטפוליו קלפים מסחריים</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
            <span>פרנצ'ייז בלבד</span>
            <div
              onClick={() => d({ t: "TOGGLE_FRANCHISE" })}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${s.franchise ? "bg-blue-600" : "bg-gray-700"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${s.franchise ? "right-0.5" : "right-4"}`} />
            </div>
          </label>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 mt-4">
          {[
            { label: "השקעה כוללת (כולל גריידינג)", value: fmt$(stats.totalCost), color: "text-amber-400" },
            { label: "הערכת שוק פעיל ⚠", value: fmt$(stats.estimatedValue), sub: "הערכה בלבד — לא ממומש", color: "text-blue-400" },
            { label: "רווח/הפסד לא ממומש", value: fmt$(stats.unrealisedPnL), color: stats.unrealisedPnL >= 0 ? "text-emerald-400" : "text-red-400" },
            { label: "רווח ממומש נטו", value: fmt$(stats.realisedProfit), color: stats.realisedProfit >= 0 ? "text-emerald-400" : "text-red-400" },
            { label: "ROI ממומש", value: fmtPct(stats.roiPct), sub: `${stats.soldCount} עסקאות`, color: stats.roiPct >= 0 ? "text-emerald-400" : "text-red-400" },
          ].map((st) => (
            <div key={st.label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 flex-1 min-w-[130px]">
              <div className="text-xs text-gray-500 mb-1">{st.label}</div>
              <div className={`text-base font-bold ${st.color}`}>{st.value}</div>
              {st.sub && <div className="text-xs text-amber-600 mt-0.5">{st.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex bg-gray-900 border-b border-gray-800 overflow-x-auto">
        {(["brain", "inventory", "roi", "market", "partners"] as Tab[]).map((tab) => {
          const labels: Record<Tab, string> = {
            brain: "🧠 מוח", inventory: "📦 מלאי", roi: "📈 ROI",
            market: "🌐 שוק", partners: "🤝 שותפים",
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
      <div className="max-w-5xl mx-auto px-4 py-5">

        {/* ══ BRAIN ══════════════════════════════════════════════════════════ */}
        {s.tab === "brain" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-bold mb-1">🧠 יועץ אמת פורנזי</h2>
            <p className="text-xs text-gray-500 mb-4">הניתוח מבוסס על נתוני הפורטפוליו שלך. שאל כל שאלה — כולל שאלות לא נוחות.</p>

            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto mb-3 p-1">
              {s.chat.messages.length === 0 && (
                <p className="text-center text-gray-600 text-sm mt-10">התחל לשאול…</p>
              )}
              {s.chat.messages.map((m, i) => (
                <div key={i} className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "self-start bg-gray-700 rounded-tl-sm"
                    : "self-end bg-blue-900/60 rounded-tr-sm"
                }`}>
                  {m.content}
                </div>
              ))}
              {s.chat.busy && <div className="self-end text-sm text-gray-500 italic">מנתח…</div>}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2">
              <Input
                dir="rtl"
                value={s.chat.input}
                onChange={(e) => d({ t: "CHAT_INPUT", v: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="שאל שאלה על הפורטפוליו…"
                disabled={s.chat.busy}
                className="bg-gray-800 border-gray-700"
              />
              {s.chat.busy
                ? <Button variant="destructive" onClick={cancelAI}>בטל</Button>
                : <Button onClick={sendChat} disabled={!s.chat.input.trim()}>שלח</Button>
              }
            </div>
          </div>
        )}

        {/* ══ INVENTORY ══════════════════════════════════════════════════════ */}
        {s.tab === "inventory" && (
          <div>
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <Input
                dir="rtl"
                className="flex-1 min-w-[180px] bg-gray-800 border-gray-700"
                value={s.inv.search}
                onChange={(e) => d({ t: "INV_SEARCH", v: e.target.value })}
                placeholder="🔍 חיפוש לפי שם, סט, פרנצ'ייז…"
              />
              <Button onClick={() => { d({ t: "INV_FORM_EDIT", id: null, form: emptyForm(s.partners[0]?.id ?? "") }); }}>
                + הוסף פריט
              </Button>
              <Button variant="outline" onClick={() => exportCSV(sortedItems, s.partners)}>
                ⬇ CSV
              </Button>
            </div>

            {/* Form */}
            {s.inv.showForm && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
                <h3 className="font-bold mb-4">{s.inv.editId ? "✏ עריכת פריט" : "➕ פריט חדש"}</h3>
                <form onSubmit={saveItem} className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: "שם *", key: "name", type: "text" },
                      { label: "סט", key: "card_set", type: "text" },
                      { label: "פרנצ'ייז", key: "franchise", type: "text" },
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
                      <label className="text-xs text-gray-400 block mb-1">מצב</label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100"
                        value={s.inv.form.condition}
                        onChange={(e) => d({ t: "INV_FORM_PATCH", p: { condition: e.target.value } })}
                      >
                        {["M","NM","LP","MP","HP","D","PSA"].map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">סטטוס</label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100"
                        value={s.inv.form.status}
                        onChange={(e) => d({ t: "INV_FORM_PATCH", p: { status: e.target.value as ItemStatus } })}
                      >
                        <option value="active">פעיל</option>
                        <option value="grading">גריידינג</option>
                        <option value="sold">נמכר</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">שותף *</label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100"
                        value={s.inv.form.partner_id}
                        onChange={(e) => d({ t: "INV_FORM_PATCH", p: { partner_id: e.target.value } })}
                        required
                      >
                        <option value="">בחר…</option>
                        {s.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">תאריך קנייה</label>
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
                      { label: "מחיר קנייה ($) *", key: "buy_price" },
                      { label: "עלות גריידינג ($)", key: "grading_cost" },
                      { label: "הערכת שוק ($) — לא מחיר מכירה", key: "market_price" },
                      { label: "ציון PSA", key: "psa_grade" },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="text-xs text-gray-400 block mb-1">{label}</label>
                        <Input
                          type="number" min="0" step="0.01"
                          className="bg-gray-800 border-gray-700"
                          value={s.inv.form[key as keyof ItemForm]}
                          onChange={(e) => d({ t: "INV_FORM_PATCH", p: { [key]: e.target.value } })}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">הערות</label>
                    <Input
                      dir="rtl"
                      className="bg-gray-800 border-gray-700"
                      value={s.inv.form.notes}
                      onChange={(e) => d({ t: "INV_FORM_PATCH", p: { notes: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">תמונה (דחוסה אוטומטית)</label>
                    <input type="file" accept="image/*" onChange={handleImage} className="text-sm text-gray-300" />
                    {s.inv.form.image_url && (
                      <img src={s.inv.form.image_url} alt="preview" className="mt-2 w-16 h-16 object-cover rounded-lg" />
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button type="submit">{s.inv.editId ? "עדכן" : "הוסף"}</Button>
                    <Button type="button" variant="outline" onClick={() => d({ t: "INV_FORM_SHOW", show: false })}>ביטול</Button>
                  </div>
                </form>
              </div>
            )}

            {/* Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {[
                      { label: "פריט",       field: "name"         as const },
                      { label: "סטטוס",      field: "status"       as const },
                      { label: "תאריך",      field: "buy_date"     as const },
                      { label: "קנייה",      field: "buy_price"    as const },
                      { label: "גריידינג",   field: "grading_cost" as const },
                      { label: "הערכה",      field: "market_price" as const },
                      { label: "מכירה",      field: "sell_price"   as const },
                    ].map(({ label, field }) => (
                      <th
                        key={field}
                        className="text-right px-3 py-2.5 text-xs font-semibold text-gray-400 cursor-pointer hover:text-white whitespace-nowrap select-none"
                        onClick={() => toggleSort(field)}
                      >
                        {label}{sortArrow(field)}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-400 text-right">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedItems.map((item) => {
                    const cost   = +item.buy_price + +(item.grading_cost ?? 0);
                    const profit = item.status === "sold" ? +(item.sell_price ?? 0) - cost : null;
                    return (
                      <tr key={item.id} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {item.image_url && (
                              <img src={item.image_url} alt={item.name} className="w-9 h-9 rounded-md object-cover flex-shrink-0" />
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
                        <td className="px-3 py-2.5 text-amber-400">{item.grading_cost ? fmt$(item.grading_cost) : <span className="text-gray-600">—</span>}</td>
                        <td className="px-3 py-2.5 text-blue-400">{item.market_price != null ? fmt$(item.market_price) : <span className="text-gray-600">—</span>}</td>
                        <td className="px-3 py-2.5">
                          {item.status === "sold" && item.sell_price != null ? (
                            <div>
                              <div>{fmt$(item.sell_price)}</div>
                              <div className={`text-xs ${profit! >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {profit! >= 0 ? "+" : ""}{fmt$(profit!)}
                              </div>
                            </div>
                          ) : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1.5">
                            {item.status !== "sold" && (
                              <button onClick={() => markSold(item)} className="text-xs px-2 py-1 bg-emerald-900/60 text-emerald-300 rounded hover:bg-emerald-800 transition-colors" title="רשום מכירה">✓</button>
                            )}
                            <button onClick={() => startEdit(item)} className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors">✏</button>
                            <button onClick={() => d({ t: "DEL_TARGET", id: item.id })} className="text-xs px-2 py-1 bg-red-900/60 text-red-300 rounded hover:bg-red-800 transition-colors">✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pagedItems.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-gray-600">
                      {s.inv.search ? "לא נמצאו תוצאות" : "אין פריטים — לחץ על הוסף פריט"}
                    </td></tr>
                  )}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-3 px-4 py-2.5 text-sm text-gray-500 border-t border-gray-800">
                  <span>{sortedItems.length} פריטים</span>
                  <button disabled={s.inv.page === 1} onClick={() => d({ t: "INV_PAGE", n: s.inv.page - 1 })} className="px-2 py-1 rounded bg-gray-800 disabled:opacity-30 hover:bg-gray-700">◀</button>
                  <span>עמוד {s.inv.page} / {totalPages}</span>
                  <button disabled={s.inv.page === totalPages} onClick={() => d({ t: "INV_PAGE", n: s.inv.page + 1 })} className="px-2 py-1 rounded bg-gray-800 disabled:opacity-30 hover:bg-gray-700">▶</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ ROI ════════════════════════════════════════════════════════════ */}
        {s.tab === "roi" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "השקעה כוללת (קנייה + גריידינג)", value: fmt$(stats.totalCost), cls: "text-amber-400" },
                { label: "הכנסות מכירות", value: fmt$(stats.realisedRevenue), cls: "text-blue-400" },
                { label: "רווח נטו ממומש", value: fmt$(stats.realisedProfit), cls: stats.realisedProfit >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "ROI ממומש", value: fmtPct(stats.roiPct), cls: stats.roiPct >= 0 ? "text-emerald-400" : "text-red-400" },
              ].map((st) => (
                <div key={st.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">{st.label}</div>
                  <div className={`text-lg font-bold ${st.cls}`}>{st.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-auto">
              <div className="px-4 py-3 border-b border-gray-800 font-semibold text-sm">פירוט עסקאות שנמכרו</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {["פריט","קנייה","גריידינג","עלות בסיס","מכירה","רווח נטו","ROI","שותף"].map((h) => (
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
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{s.partners.find((p) => p.id === i.partner_id)?.name ?? "—"}</td>
                      </tr>
                    );
                  })}
                  {s.items.filter((i) => i.status === "sold").length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-600">אין עסקאות שנמכרו עדיין</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ MARKET ═════════════════════════════════════════════════════════ */}
        {s.tab === "market" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-bold mb-1">🌐 סריקת שוק — אמת פורנזית</h2>
            <p className="text-xs text-gray-500 mb-4">
              AI עם חיפוש אינטרנט. מחפש ב-eBay, TCGPlayer, PSA Registry ומציין מקורות.
              תוצאות נשמרות אוטומטית לבסיס הידע.
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
                  {m === "market" ? "🔍 מחירים" : "⚡ ארביטראז׳"}
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
                  ? "לדוגמה: מה מחיר PSA 10 Charizard Base Set 1st Edition?"
                  : "לדוגמה: הזדמנויות ארביטראז׳ בקלפי One Piece Paramount War"
              }
            />

            <div className="flex gap-2">
              {s.market.busy
                ? <Button variant="destructive" onClick={cancelAI}>בטל סריקה</Button>
                : <Button onClick={runScan} disabled={!s.market.query.trim()}>🔍 הפעל סריקה</Button>
              }
            </div>

            {s.market.busy && (
              <p className="text-sm text-gray-500 mt-3">סורק… (15–30 שניות)</p>
            )}

            {s.market.result && (
              <div className="mt-4 bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                {s.market.result}
              </div>
            )}
          </div>
        )}

        {/* ══ PARTNERS ═══════════════════════════════════════════════════════ */}
        {s.tab === "partners" && (
          <div className="space-y-4">
            {/* Add partner */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-bold mb-3">➕ הוסף שותף</h3>
              <form onSubmit={addPartner} className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-gray-400 block mb-1">שם *</label>
                  <Input dir="rtl" className="bg-gray-800 border-gray-700" value={s.partnerForm.name} onChange={(e) => d({ t: "PF_PATCH", p: { name: e.target.value } })} required />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-gray-400 block mb-1">אימייל</label>
                  <Input type="email" className="bg-gray-800 border-gray-700" value={s.partnerForm.email} onChange={(e) => d({ t: "PF_PATCH", p: { email: e.target.value } })} />
                </div>
                <Button type="submit" disabled={s.addingPartner}>{s.addingPartner ? "מוסיף…" : "הוסף"}</Button>
              </form>
            </div>

            {/* Partner cards */}
            {partnerStats.map(({ partner, stats: ps }) => (
              <div key={partner.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold text-base">{partner.name}</div>
                    {partner.email && <div className="text-xs text-gray-500">{partner.email}</div>}
                    <div className="text-xs text-gray-600 mt-0.5">
                      {ps.activeCount} פעיל · {ps.gradingCount} גריידינג · {ps.soldCount} נמכר
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => exportCSV(s.items.filter((i) => i.partner_id === partner.id), s.partners, `${partner.name}.csv`)}>
                    ⬇ CSV
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  {[
                    { label: "השקעה (כולל גריידינג)", value: fmt$(ps.totalCost), cls: "text-amber-400" },
                    { label: "הערכת שוק פעיל", value: fmt$(ps.estimatedValue), cls: "text-blue-400" },
                    { label: "הכנסות מכירות", value: fmt$(ps.realisedRevenue), cls: "text-emerald-400" },
                    { label: "רווח נטו + ROI", value: `${fmt$(ps.realisedProfit)} (${fmtPct(ps.roiPct)})`, cls: ps.realisedProfit >= 0 ? "text-emerald-400" : "text-red-400" },
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
              <div className="text-center py-12 text-gray-600">אין שותפים — הוסף שותף ראשון למעלה</div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
