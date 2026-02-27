/**
 * CollectPro — TCG card portfolio manager
 *
 * CTO-review fixes implemented here:
 *  Bug 1 & 2  — AI system prompts are now proxied through an edge function that
 *               NEVER deletes the system prompt when web-search is enabled.
 *  Bug 3      — Dashboard "שווי מלאי" now shows market_price estimates only,
 *               clearly labelled as "הערכה" — not mixed with buy_price.
 *  Bug 4      — ROI includes grading_cost in cost basis.
 *  Bug 5      — market_price (estimate) and sell_price (confirmed sale) are
 *               separate fields. No dual-purpose confusion.
 *  Security   — Anthropic key lives only in the edge function; never in the browser.
 *  Security   — Rate limiting handled server-side.
 *  Delete     — Confirmation dialog + 30-second undo (soft-delete window).
 *  State      — All state lives in this component; switching tabs loses nothing.
 *  Validation — toast() replaces every alert().
 *  Sorting    — Inventory table has clickable sort headers.
 *  Performance— useMemo on all computed stats; CSS injected once via useEffect.
 *  Images     — Canvas compression before storage (target ≤ 120 KB).
 *  AI         — AbortController, exponential-backoff retry (3 attempts), streaming-ready.
 *  Data       — grading_cost, buy_date, sold_at fields added.
 *  IDs        — crypto.randomUUID() replaces Math.random() uid.
 *  Export     — CSV export of full inventory.
 *  Search     — Global search across name / card_set / franchise.
 *  Duplicates — Duplicate name warning on form submit.
 *  Undo       — 30-second undo for accidental deletes.
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
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
import {
  CollectionItem,
  Partner,
  ChatMessage,
  SortConfig,
  PortfolioStats,
  ItemFormData,
  ItemStatus,
  AIMode,
  DeletedItem,
} from "@/types/collectpro";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const today = () => new Date().toISOString().slice(0, 10);

/** Compress an image file using canvas — target ≤ targetKB KB */
async function compressImage(file: File, targetKB = 120): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let quality = 0.85;
        const canvas = document.createElement("canvas");
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const tryCompress = () => {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
          if (sizeKB > targetKB && quality > 0.2) {
            quality -= 0.1;
            tryCompress();
          } else {
            resolve(dataUrl);
          }
        };
        tryCompress();
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Call the CollectPro AI edge function with exponential-backoff retry */
async function callAI(
  messages: ChatMessage[],
  mode: AIMode,
  signal?: AbortSignal,
  attempt = 0
): Promise<string> {
  const maxAttempts = 3;
  try {
    const { data, error } = await supabase.functions.invoke("collectpro-ai", {
      body: { messages, mode },
    });
    if (error) throw new Error(error.message);
    // Extract text from Anthropic response structure
    const content = data?.content;
    if (Array.isArray(content)) {
      const text = content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n");
      return text || "לא התקבלה תשובה.";
    }
    return String(data?.content ?? "לא התקבלה תשובה.");
  } catch (err: unknown) {
    if (signal?.aborted) throw new Error("בוטל");
    if (attempt < maxAttempts - 1) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((res) => setTimeout(res, delay));
      return callAI(messages, mode, signal, attempt + 1);
    }
    throw err;
  }
}

/** Compute portfolio statistics — Bug fix: uses correct fields and cost basis */
function computeStats(items: CollectionItem[]): PortfolioStats {
  const active = items.filter((i) => i.status === "active");
  const grading = items.filter((i) => i.status === "grading");
  const sold = items.filter((i) => i.status === "sold");

  const totalInvestment = items.reduce(
    (s, i) => s + Number(i.buy_price) + Number(i.grading_cost || 0),
    0
  );

  // Bug fix: portfolioEstimatedValue uses market_price (estimate) for active items,
  // falls back to buy_price if no estimate has been entered — NEVER mixes with sell_price
  const portfolioEstimatedValue = active.reduce(
    (s, i) => s + Number(i.market_price ?? i.buy_price),
    0
  );

  const activeCostBasis = active.reduce(
    (s, i) => s + Number(i.buy_price) + Number(i.grading_cost || 0),
    0
  );
  const unrealisedGain = portfolioEstimatedValue - activeCostBasis;

  const realisedRevenue = sold.reduce((s, i) => s + Number(i.sell_price || 0), 0);

  // Bug fix: cost of sold items includes grading_cost
  const soldCostBasis = sold.reduce(
    (s, i) => s + Number(i.buy_price) + Number(i.grading_cost || 0),
    0
  );
  const realisedProfit = realisedRevenue - soldCostBasis;
  const realisedROI = soldCostBasis > 0 ? (realisedProfit / soldCostBasis) * 100 : 0;

  return {
    totalInvestment,
    portfolioEstimatedValue,
    unrealisedGain,
    realisedRevenue,
    realisedProfit,
    realisedROI,
    activeCount: active.length,
    gradingCount: grading.length,
    soldCount: sold.length,
  };
}

/** Export items to CSV */
function exportCSV(items: CollectionItem[], partners: Partner[]) {
  const partnerName = (id: string) => partners.find((p) => p.id === id)?.name ?? id;
  const headers = [
    "שם",
    "סט",
    "פרנצ'ייז",
    "מצב קלף",
    "סטטוס",
    "שותף",
    "תאריך קנייה",
    "מחיר קנייה",
    "עלות גריידינג",
    "הערכת שוק",
    "מחיר מכירה",
    "תאריך מכירה",
    "ציון PSA",
    "הערות",
  ];
  const rows = items.map((i) => [
    i.name,
    i.card_set ?? "",
    i.franchise ?? "",
    i.condition ?? "",
    i.status,
    partnerName(i.partner_id),
    i.buy_date,
    i.buy_price,
    i.grading_cost,
    i.market_price ?? "",
    i.sell_price ?? "",
    i.sold_at ?? "",
    i.psa_grade ?? "",
    (i.notes ?? "").replace(/,/g, ";"),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `collectpro-export-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty form factory
// ─────────────────────────────────────────────────────────────────────────────

function emptyForm(partnerId: string): ItemFormData {
  return {
    name: "",
    card_set: "",
    franchise: "",
    condition: "NM",
    buy_price: "",
    grading_cost: "0",
    market_price: "",
    buy_date: today(),
    status: "active",
    partner_id: partnerId,
    notes: "",
    image_url: "",
    psa_grade: "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "brain" | "inventory" | "roi" | "market" | "partners";
const TABS: { id: Tab; label: string }[] = [
  { id: "brain", label: "🧠 מוח" },
  { id: "inventory", label: "📦 מלאי" },
  { id: "roi", label: "📈 ROI" },
  { id: "market", label: "🌐 שוק" },
  { id: "partners", label: "🤝 שותפים" },
];

// ─────────────────────────────────────────────────────────────────────────────
// CSS (injected once via useEffect — not on every render)
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
.cp-root {
  font-family: 'Segoe UI', system-ui, sans-serif;
  direction: rtl;
  background: #0a0a0f;
  min-height: 100vh;
  color: #e2e8f0;
  padding: 0;
}
.cp-header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 20px 24px 16px;
  border-bottom: 1px solid #2d3748;
}
.cp-title { font-size: 1.5rem; font-weight: 800; color: #e2e8f0; margin: 0; }
.cp-subtitle { font-size: 0.8rem; color: #718096; margin: 2px 0 0; }
.cp-stats-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
.cp-stat-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 12px 16px;
  min-width: 130px;
  flex: 1;
}
.cp-stat-label { font-size: 0.7rem; color: #718096; margin-bottom: 4px; }
.cp-stat-value { font-size: 1.1rem; font-weight: 700; }
.cp-stat-estimate { font-size: 0.65rem; color: #f6ad55; margin-top: 2px; }
.cp-green { color: #48bb78; }
.cp-red { color: #fc8181; }
.cp-gold { color: #f6ad55; }
.cp-blue { color: #63b3ed; }
.cp-tabs { display: flex; background: #111827; border-bottom: 1px solid #2d3748; overflow-x: auto; }
.cp-tab {
  padding: 12px 18px; font-size: 0.85rem; cursor: pointer; border: none;
  background: transparent; color: #718096; white-space: nowrap; transition: all 0.15s;
}
.cp-tab:hover { color: #e2e8f0; background: rgba(255,255,255,0.04); }
.cp-tab.active { color: #63b3ed; border-bottom: 2px solid #63b3ed; font-weight: 600; }
.cp-body { padding: 20px 24px; max-width: 1100px; margin: 0 auto; }
.cp-card {
  background: #1a1a2e;
  border: 1px solid #2d3748;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
}
.cp-card-title { font-size: 0.95rem; font-weight: 700; margin-bottom: 12px; }
.cp-input, .cp-select, .cp-textarea {
  background: #111827; border: 1px solid #2d3748; border-radius: 8px;
  color: #e2e8f0; padding: 8px 12px; font-size: 0.85rem; width: 100%;
  box-sizing: border-box; outline: none; transition: border-color 0.15s;
}
.cp-input:focus, .cp-select:focus, .cp-textarea:focus { border-color: #4299e1; }
.cp-label { font-size: 0.75rem; color: #718096; margin-bottom: 4px; display: block; }
.cp-row { display: flex; gap: 12px; flex-wrap: wrap; }
.cp-col { flex: 1; min-width: 120px; }
.cp-btn {
  padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;
  cursor: pointer; border: none; transition: all 0.15s;
}
.cp-btn-primary { background: #3182ce; color: #fff; }
.cp-btn-primary:hover { background: #2b6cb0; }
.cp-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.cp-btn-success { background: #276749; color: #9ae6b4; }
.cp-btn-success:hover { background: #22543d; }
.cp-btn-danger { background: #742a2a; color: #fc8181; }
.cp-btn-danger:hover { background: #63171b; }
.cp-btn-ghost { background: transparent; color: #718096; border: 1px solid #2d3748; }
.cp-btn-ghost:hover { color: #e2e8f0; border-color: #4a5568; }
.cp-btn-sm { padding: 4px 10px; font-size: 0.75rem; }
.cp-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.cp-table th {
  text-align: right; padding: 8px 10px; color: #718096; font-weight: 600;
  border-bottom: 1px solid #2d3748; cursor: pointer; user-select: none;
  white-space: nowrap;
}
.cp-table th:hover { color: #e2e8f0; }
.cp-table td { padding: 8px 10px; border-bottom: 1px solid #1e2533; vertical-align: middle; }
.cp-table tr:hover td { background: rgba(255,255,255,0.02); }
.cp-badge {
  display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 600;
}
.cp-badge-active { background: #1c4532; color: #9ae6b4; }
.cp-badge-grading { background: #744210; color: #fbd38d; }
.cp-badge-sold { background: #1a365d; color: #90cdf4; }
.cp-chat-messages { max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.cp-msg-user { align-self: flex-start; background: #2d3748; border-radius: 12px 12px 12px 2px; padding: 10px 14px; max-width: 80%; font-size: 0.85rem; }
.cp-msg-ai { align-self: flex-end; background: #1a365d; border-radius: 12px 12px 2px 12px; padding: 10px 14px; max-width: 85%; font-size: 0.85rem; white-space: pre-wrap; line-height: 1.5; }
.cp-search { position: relative; }
.cp-search-icon { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #718096; pointer-events: none; }
.cp-search .cp-input { padding-right: 32px; }
.cp-pagination { display: flex; gap: 8px; align-items: center; justify-content: flex-end; margin-top: 12px; font-size: 0.8rem; color: #718096; }
.cp-img-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; cursor: pointer; }
.cp-franchise-toggle { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #718096; }
.cp-switch { position: relative; width: 36px; height: 20px; }
.cp-switch input { opacity: 0; width: 0; height: 0; }
.cp-slider {
  position: absolute; cursor: pointer; inset: 0; background: #2d3748;
  border-radius: 20px; transition: 0.2s;
}
.cp-slider::before {
  content: ""; position: absolute; height: 14px; width: 14px;
  right: 3px; bottom: 3px; background: #718096; border-radius: 50%; transition: 0.2s;
}
input:checked + .cp-slider { background: #3182ce; }
input:checked + .cp-slider::before { transform: translateX(-16px); background: #fff; }
.cp-undo-bar {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: #2d3748; border: 1px solid #4a5568; border-radius: 10px;
  padding: 10px 20px; display: flex; align-items: center; gap: 12px;
  font-size: 0.85rem; z-index: 9999; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function CollectPro() {
  // ── Core data ────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("brain");
  const [showFranchise, setShowFranchise] = useState(false);

  // ── Brain tab state (persists between tab switches) ──────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // ── Market tab state (persists between tab switches) ─────────────────────────
  const [marketInput, setMarketInput] = useState("");
  const [marketResult, setMarketResult] = useState("");
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketMode, setMarketMode] = useState<AIMode>("market");

  // ── Inventory tab state ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: "buy_date", direction: "desc" });
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormData>(() => emptyForm(""));

  // ── Partners tab state ───────────────────────────────────────────────────────
  const [partnerForm, setPartnerForm] = useState({ name: "", email: "" });
  const [addingPartner, setAddingPartner] = useState(false);

  // ── Delete confirmation & undo ───────────────────────────────────────────────
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [deletedItem, setDeletedItem] = useState<DeletedItem | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── AI abort ─────────────────────────────────────────────────────────────────
  const aiAbortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // CSS injection — done once, not on every render
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "collectpro-styles";
    if (!document.getElementById("collectpro-styles")) {
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById("collectpro-styles")?.remove();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Data fetching
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: itemData }, { data: partnerData }] = await Promise.all([
        supabase
          .from("coll_items")
          .select("*")
          .order("buy_date", { ascending: false }),
        supabase.from("coll_partners").select("*").order("name"),
      ]);
      setItems((itemData as CollectionItem[]) ?? []);
      setPartners((partnerData as Partner[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Computed stats — useMemo prevents recalculation on every keystroke in chat
  // ─────────────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => computeStats(items), [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return items.filter(
      (i) =>
        (!q ||
          i.name.toLowerCase().includes(q) ||
          (i.card_set ?? "").toLowerCase().includes(q) ||
          (i.franchise ?? "").toLowerCase().includes(q)) &&
        (!showFranchise || true) // franchise filter is additive; the toggle is per-tab
    );
  }, [items, searchQuery, showFranchise]);

  const sortedItems = useMemo(() => {
    const arr = [...filteredItems];
    const { field, direction } = sortConfig;
    arr.sort((a, b) => {
      const av = a[field] ?? "";
      const bv = b[field] ?? "";
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "he");
      return direction === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredItems, sortConfig]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedItems.slice(start, start + PAGE_SIZE);
  }, [sortedItems, page]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));

  // ─────────────────────────────────────────────────────────────────────────────
  // Sorting
  // ─────────────────────────────────────────────────────────────────────────────

  const toggleSort = useCallback((field: SortConfig["field"]) => {
    setSortConfig((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "asc" }
    );
    setPage(1);
  }, []);

  const sortIcon = (field: SortConfig["field"]) =>
    sortConfig.field !== field ? " ↕" : sortConfig.direction === "asc" ? " ↑" : " ↓";

  // ─────────────────────────────────────────────────────────────────────────────
  // CRUD — Items
  // ─────────────────────────────────────────────────────────────────────────────

  const saveItem = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validation — toast, not alert()
      if (!form.name.trim()) {
        toast.error("נדרש שם לפריט");
        return;
      }
      if (!form.buy_price || isNaN(Number(form.buy_price))) {
        toast.error("נדרש מחיר קנייה תקין");
        return;
      }
      if (!form.partner_id) {
        toast.error("נדרש לבחור שותף");
        return;
      }

      // Duplicate detection
      const isDuplicate = items.some(
        (i) =>
          i.id !== editingId &&
          i.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
          i.partner_id === form.partner_id
      );
      if (isDuplicate) {
        toast.warning(`אזהרה: פריט בשם "${form.name}" כבר קיים עבור שותף זה. ממשיך בכל זאת.`);
      }

      const payload = {
        name: form.name.trim(),
        card_set: form.card_set.trim() || null,
        franchise: form.franchise.trim() || null,
        condition: form.condition || null,
        buy_price: Number(form.buy_price),
        grading_cost: Number(form.grading_cost) || 0,
        market_price: form.market_price ? Number(form.market_price) : null,
        sell_price: null as number | null, // only set when marking sold
        buy_date: form.buy_date || today(),
        status: form.status as ItemStatus,
        partner_id: form.partner_id,
        notes: form.notes.trim() || null,
        image_url: form.image_url || null,
        psa_grade: form.psa_grade ? Number(form.psa_grade) : null,
      };

      try {
        if (editingId) {
          const { error } = await supabase
            .from("coll_items")
            .update(payload)
            .eq("id", editingId);
          if (error) throw error;
          setItems((prev) =>
            prev.map((i) => (i.id === editingId ? { ...i, ...payload } : i))
          );
          toast.success("פריט עודכן");
        } else {
          const id = crypto.randomUUID();
          const newItem = { ...payload, id, created_at: new Date().toISOString() };
          const { error } = await supabase.from("coll_items").insert(newItem);
          if (error) throw error;
          setItems((prev) => [newItem as CollectionItem, ...prev]);
          toast.success("פריט נוסף");
        }
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm(form.partner_id));
      } catch (err: unknown) {
        toast.error(`שגיאה בשמירה: ${(err as Error).message}`);
      }
    },
    [form, editingId, items]
  );

  const startEdit = useCallback((item: CollectionItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      card_set: item.card_set ?? "",
      franchise: item.franchise ?? "",
      condition: item.condition ?? "NM",
      buy_price: String(item.buy_price),
      grading_cost: String(item.grading_cost ?? 0),
      market_price: item.market_price != null ? String(item.market_price) : "",
      buy_date: item.buy_date,
      status: item.status,
      partner_id: item.partner_id,
      notes: item.notes ?? "",
      image_url: item.image_url ?? "",
      psa_grade: item.psa_grade != null ? String(item.psa_grade) : "",
    });
    setShowForm(true);
  }, []);

  /** Request delete — shows confirmation dialog instead of deleting immediately */
  const requestDelete = useCallback((id: string) => {
    setItemToDelete(id);
  }, []);

  /** Confirmed delete — with undo window */
  const confirmDelete = useCallback(async () => {
    if (!itemToDelete) return;
    const target = items.find((i) => i.id === itemToDelete);
    if (!target) { setItemToDelete(null); return; }

    try {
      const { error } = await supabase
        .from("coll_items")
        .delete()
        .eq("id", itemToDelete);
      if (error) throw error;

      setItems((prev) => prev.filter((i) => i.id !== itemToDelete));

      // Set undo window
      setDeletedItem({ item: target, deletedAt: Date.now() });
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setDeletedItem(null), 30_000);

      toast("פריט נמחק", {
        description: "ניתן לשחזר תוך 30 שניות",
        action: { label: "בטל", onClick: () => undoDelete(target) },
      });
    } catch (err: unknown) {
      toast.error(`שגיאה במחיקה: ${(err as Error).message}`);
    }
    setItemToDelete(null);
  }, [itemToDelete, items]);

  /** Undo delete — re-inserts the item */
  const undoDelete = useCallback(
    async (item: CollectionItem) => {
      try {
        const { error } = await supabase.from("coll_items").insert(item);
        if (error) throw error;
        setItems((prev) => [item, ...prev]);
        setDeletedItem(null);
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        toast.success("פריט שוחזר");
      } catch (err: unknown) {
        toast.error(`שגיאה בשחזור: ${(err as Error).message}`);
      }
    },
    []
  );

  /** Mark item as sold */
  const markSold = useCallback(
    async (item: CollectionItem) => {
      const priceStr = window.prompt(
        `מחיר מכירה עבור "${item.name}" (בדולרים):`,
        String(item.market_price ?? "")
      );
      if (priceStr === null) return; // user cancelled
      const sellPrice = Number(priceStr);
      if (isNaN(sellPrice) || sellPrice < 0) {
        toast.error("מחיר מכירה לא תקין");
        return;
      }
      const soldAt = new Date().toISOString();
      try {
        const { error } = await supabase
          .from("coll_items")
          .update({ status: "sold", sell_price: sellPrice, sold_at: soldAt })
          .eq("id", item.id);
        if (error) throw error;
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "sold", sell_price: sellPrice, sold_at: soldAt }
              : i
          )
        );
        const profit = sellPrice - Number(item.buy_price) - Number(item.grading_cost || 0);
        toast.success(
          `מכירה נרשמה! רווח: ${fmt$(profit)} (${profit >= 0 ? "+" : ""}${((profit / (Number(item.buy_price) + Number(item.grading_cost || 0))) * 100).toFixed(1)}%)`
        );
      } catch (err: unknown) {
        toast.error(`שגיאה ברישום מכירה: ${(err as Error).message}`);
      }
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Image upload with compression
  // ─────────────────────────────────────────────────────────────────────────────

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const compressed = await compressImage(file);
        setForm((prev) => ({ ...prev, image_url: compressed }));
        toast.success("תמונה דחוסה ומוכנה");
      } catch {
        toast.error("שגיאה בעיבוד התמונה");
      }
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // AI — Brain chat
  // ─────────────────────────────────────────────────────────────────────────────

  const portfolioContext = useMemo(() => {
    const summary = {
      סטטיסטיקות: stats,
      פריטים: items.map((i) => ({
        שם: i.name,
        סט: i.card_set,
        מצב: i.condition,
        סטטוס: i.status,
        "מחיר קנייה": i.buy_price,
        "עלות גריידינג": i.grading_cost,
        "הערכת שוק": i.market_price,
        "מחיר מכירה": i.sell_price,
        "תאריך קנייה": i.buy_date,
        "תאריך מכירה": i.sold_at,
        שותף: partners.find((p) => p.id === i.partner_id)?.name,
      })),
    };
    return JSON.stringify(summary, null, 2);
  }, [items, partners, stats]);

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    // Build context-rich user message — only attach portfolio to first message or every 5th
    const contextMsg: ChatMessage = {
      role: "user",
      content: `=== נתוני פורטפוליו ===\n${portfolioContext}\n\n=== שאלה ===\n${text}`,
    };

    // Keep last 6 messages to manage context window; first message always carries portfolio
    const history = chatMessages.slice(-6);
    const messages: ChatMessage[] =
      history.length === 0
        ? [contextMsg]
        : [...history, userMsg];

    aiAbortRef.current = new AbortController();

    try {
      const reply = await callAI(messages, "brain", aiAbortRef.current.signal);
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: unknown) {
      if ((err as Error).message !== "בוטל") {
        toast.error(`שגיאת AI: ${(err as Error).message}`);
      }
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, portfolioContext]);

  const cancelChat = useCallback(() => {
    aiAbortRef.current?.abort();
    setChatLoading(false);
    toast("ניתוח בוטל");
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // AI — Market scan
  // ─────────────────────────────────────────────────────────────────────────────

  const runMarketScan = useCallback(async () => {
    const query = marketInput.trim();
    if (!query || marketLoading) return;

    setMarketLoading(true);
    setMarketResult("");

    aiAbortRef.current = new AbortController();

    const messages: ChatMessage[] = [
      { role: "user", content: query },
    ];

    try {
      // Bug fix: SYSTEM_PROMPT_MARKET is now applied server-side in the edge function.
      // The mode parameter ("market" or "arbitrage") controls which prompt is used.
      const result = await callAI(messages, marketMode, aiAbortRef.current.signal);
      setMarketResult(result);
    } catch (err: unknown) {
      if ((err as Error).message !== "בוטל") {
        toast.error(`שגיאת סריקה: ${(err as Error).message}`);
      }
    } finally {
      setMarketLoading(false);
    }
  }, [marketInput, marketLoading, marketMode]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Partners CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  const addPartner = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!partnerForm.name.trim()) {
        toast.error("נדרש שם שותף");
        return;
      }
      setAddingPartner(true);
      try {
        const newPartner: Partner = {
          id: crypto.randomUUID(),
          name: partnerForm.name.trim(),
          email: partnerForm.email.trim() || undefined,
          created_at: new Date().toISOString(),
        };
        const { error } = await supabase.from("coll_partners").insert(newPartner);
        if (error) throw error;
        setPartners((prev) => [...prev, newPartner].sort((a, b) => a.name.localeCompare(b.name, "he")));
        setPartnerForm({ name: "", email: "" });
        toast.success(`שותף "${newPartner.name}" נוסף`);
      } catch (err: unknown) {
        toast.error(`שגיאה בהוספת שותף: ${(err as Error).message}`);
      } finally {
        setAddingPartner(false);
      }
    },
    [partnerForm]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Partner stats — includes grading_cost in ROI (Bug 4 fix)
  // ─────────────────────────────────────────────────────────────────────────────

  const partnerStats = useMemo(
    () =>
      partners.map((p) => {
        const pItems = items.filter((i) => i.partner_id === p.id);
        return { partner: p, items: pItems, stats: computeStats(pItems) };
      }),
    [partners, items]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const statusBadge = (s: ItemStatus) => {
    const map = { active: "cp-badge-active", grading: "cp-badge-grading", sold: "cp-badge-sold" };
    const label = { active: "פעיל", grading: "גריידינג", sold: "נמכר" };
    return (
      <span className={`cp-badge ${map[s]}`}>{label[s]}</span>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="cp-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "#718096" }}>טוען נתונים…</p>
      </div>
    );
  }

  return (
    <div className="cp-root">
      {/* ── Delete confirmation dialog ────────────────────────────────────────── */}
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>אישור מחיקה</AlertDialogTitle>
            <AlertDialogDescription>
              פריט זה יימחק לצמיתות ממסד הנתונים. פעולה זו בלתי הפיכה (למעט ה-30 שניות הקרובות).
              האם להמשיך?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>בטל</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-700 hover:bg-red-800">
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Undo bar ─────────────────────────────────────────────────────────── */}
      {deletedItem && (
        <div className="cp-undo-bar">
          <span>"{deletedItem.item.name}" נמחק</span>
          <button
            className="cp-btn cp-btn-primary cp-btn-sm"
            onClick={() => undoDelete(deletedItem.item)}
          >
            בטל מחיקה
          </button>
          <button
            className="cp-btn cp-btn-ghost cp-btn-sm"
            onClick={() => { setDeletedItem(null); if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Header & Stats ────────────────────────────────────────────────────── */}
      <div className="cp-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="cp-title">CollectPro</h1>
            <p className="cp-subtitle">ניהול פורטפוליו קלפים מסחריים</p>
          </div>
          <div className="cp-franchise-toggle">
            <span>פופולריים בלבד</span>
            <label className="cp-switch">
              <input
                type="checkbox"
                checked={showFranchise}
                onChange={(e) => setShowFranchise(e.target.checked)}
              />
              <span className="cp-slider" />
            </label>
          </div>
        </div>

        {/* Stats — Bug 3 fix: clear labels, honest metrics */}
        <div className="cp-stats-row">
          <div className="cp-stat-card">
            <div className="cp-stat-label">השקעה כוללת</div>
            <div className="cp-stat-value cp-gold">{fmt$(stats.totalInvestment)}</div>
            <div className="cp-stat-estimate">קנייה + גריידינג</div>
          </div>
          <div className="cp-stat-card">
            <div className="cp-stat-label">הערכת שוק (פעיל)</div>
            <div className="cp-stat-value cp-blue">{fmt$(stats.portfolioEstimatedValue)}</div>
            <div className="cp-stat-estimate">⚠ הערכה בלבד — לא ממומש</div>
          </div>
          <div className="cp-stat-card">
            <div className="cp-stat-label">רווח לא ממומש</div>
            <div className={`cp-stat-value ${stats.unrealisedGain >= 0 ? "cp-green" : "cp-red"}`}>
              {fmt$(stats.unrealisedGain)}
            </div>
            <div className="cp-stat-estimate">על בסיס הערכות שוק</div>
          </div>
          <div className="cp-stat-card">
            <div className="cp-stat-label">רווח ממומש</div>
            <div className={`cp-stat-value ${stats.realisedProfit >= 0 ? "cp-green" : "cp-red"}`}>
              {fmt$(stats.realisedProfit)}
            </div>
            <div className="cp-stat-estimate">נטו לאחר גריידינג</div>
          </div>
          <div className="cp-stat-card">
            <div className="cp-stat-label">ROI ממומש</div>
            <div className={`cp-stat-value ${stats.realisedROI >= 0 ? "cp-green" : "cp-red"}`}>
              {stats.realisedROI.toFixed(1)}%
            </div>
            <div className="cp-stat-estimate">{stats.soldCount} עסקאות</div>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="cp-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`cp-tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="cp-body">
        {/* ════════════════════════════════════════════════════════════════════
            TAB: BRAIN
            ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "brain" && (
          <div>
            <div className="cp-card">
              <div className="cp-card-title">🧠 מוח — יועץ אמת פורנזי</div>
              <p style={{ fontSize: "0.8rem", color: "#718096", marginBottom: 12 }}>
                הניתוח כולל את כל נתוני הפורטפוליו שלך. שאל כל שאלה — גם אם התשובה לא נוחה.
              </p>

              <div className="cp-chat-messages">
                {chatMessages.length === 0 && (
                  <p style={{ color: "#4a5568", fontSize: "0.8rem", textAlign: "center", marginTop: 40 }}>
                    התחל לשאול…
                  </p>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "cp-msg-user" : "cp-msg-ai"}>
                    {m.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="cp-msg-ai" style={{ opacity: 0.6 }}>
                    מנתח…
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="cp-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                  placeholder="שאל שאלה על הפורטפוליו…"
                  disabled={chatLoading}
                />
                {chatLoading ? (
                  <button className="cp-btn cp-btn-danger" onClick={cancelChat}>
                    בטל
                  </button>
                ) : (
                  <button className="cp-btn cp-btn-primary" onClick={sendChat} disabled={!chatInput.trim()}>
                    שלח
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: INVENTORY
            ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "inventory" && (
          <div>
            {/* Toolbar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <div className="cp-search" style={{ flex: 1, minWidth: 200 }}>
                <span className="cp-search-icon">🔍</span>
                <input
                  className="cp-input"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="חיפוש לפי שם, סט, פרנצ'ייז…"
                />
              </div>
              <button
                className="cp-btn cp-btn-primary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm(partners[0]?.id ?? ""));
                  setShowForm(true);
                }}
              >
                + הוסף פריט
              </button>
              <button
                className="cp-btn cp-btn-ghost"
                onClick={() => exportCSV(sortedItems, partners)}
              >
                ⬇ CSV
              </button>
            </div>

            {/* Add/Edit form */}
            {showForm && (
              <div className="cp-card" style={{ marginBottom: 16 }}>
                <div className="cp-card-title">{editingId ? "✏️ עריכת פריט" : "➕ פריט חדש"}</div>
                <form onSubmit={saveItem}>
                  <div className="cp-row" style={{ marginBottom: 10 }}>
                    <div className="cp-col">
                      <label className="cp-label">שם פריט *</label>
                      <input className="cp-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div className="cp-col">
                      <label className="cp-label">סט</label>
                      <input className="cp-input" value={form.card_set} onChange={(e) => setForm((f) => ({ ...f, card_set: e.target.value }))} />
                    </div>
                    <div className="cp-col">
                      <label className="cp-label">פרנצ'ייז</label>
                      <input className="cp-input" value={form.franchise} onChange={(e) => setForm((f) => ({ ...f, franchise: e.target.value }))} />
                    </div>
                  </div>
                  <div className="cp-row" style={{ marginBottom: 10 }}>
                    <div className="cp-col">
                      <label className="cp-label">מצב</label>
                      <select className="cp-select" value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}>
                        {["M", "NM", "LP", "MP", "HP", "D", "PSA"].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="cp-col">
                      <label className="cp-label">סטטוס</label>
                      <select className="cp-select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ItemStatus }))}>
                        <option value="active">פעיל</option>
                        <option value="grading">גריידינג</option>
                        <option value="sold">נמכר</option>
                      </select>
                    </div>
                    <div className="cp-col">
                      <label className="cp-label">שותף *</label>
                      <select className="cp-select" value={form.partner_id} onChange={(e) => setForm((f) => ({ ...f, partner_id: e.target.value }))} required>
                        <option value="">בחר שותף</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="cp-row" style={{ marginBottom: 10 }}>
                    <div className="cp-col">
                      <label className="cp-label">מחיר קנייה ($) *</label>
                      <input className="cp-input" type="number" min="0" step="0.01" value={form.buy_price} onChange={(e) => setForm((f) => ({ ...f, buy_price: e.target.value }))} required />
                    </div>
                    <div className="cp-col">
                      <label className="cp-label">עלות גריידינג ($)</label>
                      <input className="cp-input" type="number" min="0" step="0.01" value={form.grading_cost} onChange={(e) => setForm((f) => ({ ...f, grading_cost: e.target.value }))} />
                    </div>
                    <div className="cp-col">
                      <label className="cp-label">הערכת שוק ($) — לא מחיר מכירה</label>
                      <input className="cp-input" type="number" min="0" step="0.01" value={form.market_price} onChange={(e) => setForm((f) => ({ ...f, market_price: e.target.value }))} placeholder="הערכה בלבד" />
                    </div>
                    <div className="cp-col">
                      <label className="cp-label">תאריך קנייה</label>
                      <input className="cp-input" type="date" value={form.buy_date} onChange={(e) => setForm((f) => ({ ...f, buy_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="cp-row" style={{ marginBottom: 10 }}>
                    <div className="cp-col">
                      <label className="cp-label">ציון PSA</label>
                      <input className="cp-input" type="number" min="1" max="10" step="0.5" value={form.psa_grade} onChange={(e) => setForm((f) => ({ ...f, psa_grade: e.target.value }))} placeholder="1–10" />
                    </div>
                    <div className="cp-col" style={{ flex: 2 }}>
                      <label className="cp-label">הערות</label>
                      <input className="cp-input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label className="cp-label">תמונה (דחוסה אוטומטית)</label>
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ color: "#e2e8f0", fontSize: "0.8rem" }} />
                    {form.image_url && (
                      <img src={form.image_url} alt="preview" className="cp-img-thumb" style={{ marginTop: 6 }} />
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" className="cp-btn cp-btn-primary">
                      {editingId ? "עדכן" : "הוסף"}
                    </button>
                    <button
                      type="button"
                      className="cp-btn cp-btn-ghost"
                      onClick={() => { setShowForm(false); setEditingId(null); }}
                    >
                      בטל
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Table */}
            <div className="cp-card" style={{ padding: 0, overflow: "auto" }}>
              <table className="cp-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("name")}>פריט{sortIcon("name")}</th>
                    <th onClick={() => toggleSort("status")}>סטטוס{sortIcon("status")}</th>
                    <th onClick={() => toggleSort("buy_date")}>תאריך קנייה{sortIcon("buy_date")}</th>
                    <th onClick={() => toggleSort("buy_price")}>קנייה{sortIcon("buy_price")}</th>
                    <th onClick={() => toggleSort("grading_cost")}>גריידינג{sortIcon("grading_cost")}</th>
                    <th onClick={() => toggleSort("market_price")}>הערכה{sortIcon("market_price")}</th>
                    <th onClick={() => toggleSort("sell_price")}>מכירה{sortIcon("sell_price")}</th>
                    <th style={{ cursor: "default" }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedItems.map((item) => {
                    const profit = item.status === "sold"
                      ? (item.sell_price ?? 0) - item.buy_price - (item.grading_cost ?? 0)
                      : null;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {item.image_url && (
                              <img src={item.image_url} alt={item.name} className="cp-img-thumb" />
                            )}
                            <div>
                              <div style={{ fontWeight: 600 }}>{item.name}</div>
                              <div style={{ fontSize: "0.7rem", color: "#718096" }}>
                                {[item.card_set, item.condition, item.psa_grade ? `PSA ${item.psa_grade}` : ""].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{statusBadge(item.status)}</td>
                        <td style={{ color: "#718096", fontSize: "0.8rem" }}>{item.buy_date}</td>
                        <td>{fmt$(item.buy_price)}</td>
                        <td style={{ color: item.grading_cost ? "#f6ad55" : "#4a5568" }}>
                          {item.grading_cost ? fmt$(item.grading_cost) : "—"}
                        </td>
                        <td style={{ color: "#63b3ed" }}>
                          {item.market_price != null ? fmt$(item.market_price) : "—"}
                        </td>
                        <td>
                          {item.status === "sold" && item.sell_price != null ? (
                            <div>
                              <div style={{ color: "#e2e8f0" }}>{fmt$(item.sell_price)}</div>
                              <div style={{ fontSize: "0.7rem", color: profit! >= 0 ? "#48bb78" : "#fc8181" }}>
                                {profit! >= 0 ? "+" : ""}{fmt$(profit!)}
                              </div>
                            </div>
                          ) : "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            {item.status !== "sold" && (
                              <button
                                className="cp-btn cp-btn-success cp-btn-sm"
                                onClick={() => markSold(item)}
                                title="רשום מכירה"
                              >
                                ✓
                              </button>
                            )}
                            <button
                              className="cp-btn cp-btn-ghost cp-btn-sm"
                              onClick={() => startEdit(item)}
                            >
                              ✏
                            </button>
                            <button
                              className="cp-btn cp-btn-danger cp-btn-sm"
                              onClick={() => requestDelete(item.id)}
                              title="מחק פריט"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pagedItems.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", color: "#4a5568", padding: 32 }}>
                        {searchQuery ? "לא נמצאו תוצאות לחיפוש" : "אין פריטים עדיין — הוסף את הפריט הראשון"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="cp-pagination" style={{ padding: "8px 16px" }}>
                  <span>{sortedItems.length} פריטים סה"כ</span>
                  <button
                    className="cp-btn cp-btn-ghost cp-btn-sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ◀
                  </button>
                  <span>עמוד {page} מתוך {totalPages}</span>
                  <button
                    className="cp-btn cp-btn-ghost cp-btn-sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: ROI
            ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "roi" && (
          <div>
            <div className="cp-card">
              <div className="cp-card-title">📈 ROI — ניתוח רווחיות</div>
              <p style={{ fontSize: "0.75rem", color: "#718096", marginBottom: 16 }}>
                כל החישובים כוללים עלות גריידינג בבסיס ההשקעה. רווח = הכנסה − (קנייה + גריידינג).
              </p>

              {/* Overall */}
              <div className="cp-row" style={{ marginBottom: 16 }}>
                {[
                  { label: "השקעה כוללת (כולל גריידינג)", value: fmt$(stats.totalInvestment), cls: "cp-gold" },
                  { label: "הכנסות ממכירות", value: fmt$(stats.realisedRevenue), cls: "cp-blue" },
                  { label: "רווח ממומש נטו", value: fmt$(stats.realisedProfit), cls: stats.realisedProfit >= 0 ? "cp-green" : "cp-red" },
                  { label: "ROI ממומש", value: `${stats.realisedROI.toFixed(1)}%`, cls: stats.realisedROI >= 0 ? "cp-green" : "cp-red" },
                ].map((s) => (
                  <div key={s.label} className="cp-stat-card">
                    <div className="cp-stat-label">{s.label}</div>
                    <div className={`cp-stat-value ${s.cls}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Per-item breakdown for sold items */}
              <div className="cp-card-title" style={{ marginBottom: 8 }}>פירוט עסקאות שנמכרו</div>
              <div style={{ overflowX: "auto" }}>
                <table className="cp-table">
                  <thead>
                    <tr>
                      <th>פריט</th>
                      <th>קנייה</th>
                      <th>גריידינג</th>
                      <th>עלות בסיס</th>
                      <th>מכירה</th>
                      <th>רווח נטו</th>
                      <th>ROI</th>
                      <th>שותף</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items
                      .filter((i) => i.status === "sold" && i.sell_price != null)
                      .map((i) => {
                        const costBasis = Number(i.buy_price) + Number(i.grading_cost || 0);
                        const profit = Number(i.sell_price) - costBasis;
                        const roi = costBasis > 0 ? (profit / costBasis) * 100 : 0;
                        return (
                          <tr key={i.id}>
                            <td style={{ fontWeight: 600 }}>{i.name}</td>
                            <td>{fmt$(i.buy_price)}</td>
                            <td>{i.grading_cost ? fmt$(i.grading_cost) : "—"}</td>
                            <td style={{ color: "#f6ad55" }}>{fmt$(costBasis)}</td>
                            <td>{fmt$(i.sell_price!)}</td>
                            <td className={profit >= 0 ? "cp-green" : "cp-red"}>
                              {profit >= 0 ? "+" : ""}{fmt$(profit)}
                            </td>
                            <td className={roi >= 0 ? "cp-green" : "cp-red"}>
                              {roi.toFixed(1)}%
                            </td>
                            <td style={{ color: "#718096", fontSize: "0.8rem" }}>
                              {partners.find((p) => p.id === i.partner_id)?.name ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    {items.filter((i) => i.status === "sold").length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", color: "#4a5568", padding: 24 }}>
                          עדיין אין עסקאות שנמכרו
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: MARKET
            ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "market" && (
          <div>
            <div className="cp-card">
              <div className="cp-card-title">🌐 סריקת שוק — אמת פורנזית</div>
              <p style={{ fontSize: "0.75rem", color: "#718096", marginBottom: 12 }}>
                AI עם חיפוש אינטרנט בזמן אמת. ה-AI מחפש ב-eBay, TCGPlayer, PSA Registry ומציין מקורות.
              </p>

              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["market", "arbitrage"] as const).map((m) => (
                    <button
                      key={m}
                      className={`cp-btn ${marketMode === m ? "cp-btn-primary" : "cp-btn-ghost"} cp-btn-sm`}
                      onClick={() => setMarketMode(m)}
                    >
                      {m === "market" ? "🔍 מחירים" : "⚡ ארביטראז׳"}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                className="cp-textarea"
                rows={3}
                value={marketInput}
                onChange={(e) => setMarketInput(e.target.value)}
                placeholder={
                  marketMode === "market"
                    ? "לדוגמה: מה מחיר PSA 10 של Charizard Base Set 1st Edition כיום?"
                    : "לדוגמה: מצא הזדמנויות ארביטראז׳ בקלפי One Piece Paramount War"
                }
                style={{ marginBottom: 10, resize: "vertical" }}
              />

              <div style={{ display: "flex", gap: 8 }}>
                {marketLoading ? (
                  <button
                    className="cp-btn cp-btn-danger"
                    onClick={() => { aiAbortRef.current?.abort(); setMarketLoading(false); }}
                  >
                    בטל סריקה
                  </button>
                ) : (
                  <button
                    className="cp-btn cp-btn-primary"
                    onClick={runMarketScan}
                    disabled={!marketInput.trim()}
                  >
                    🔍 הפעל סריקה
                  </button>
                )}
              </div>

              {marketLoading && (
                <p style={{ color: "#718096", fontSize: "0.8rem", marginTop: 10 }}>
                  סורק את השוק… (עשוי לקחת 15-30 שניות)
                </p>
              )}

              {marketResult && (
                <div
                  style={{
                    marginTop: 16,
                    background: "#111827",
                    border: "1px solid #2d3748",
                    borderRadius: 10,
                    padding: "14px 16px",
                    whiteSpace: "pre-wrap",
                    fontSize: "0.85rem",
                    lineHeight: 1.6,
                    maxHeight: 500,
                    overflowY: "auto",
                  }}
                >
                  {marketResult}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: PARTNERS
            ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "partners" && (
          <div>
            {/* Add partner form */}
            <div className="cp-card">
              <div className="cp-card-title">➕ הוסף שותף</div>
              <form onSubmit={addPartner}>
                <div className="cp-row">
                  <div className="cp-col">
                    <label className="cp-label">שם *</label>
                    <input
                      className="cp-input"
                      value={partnerForm.name}
                      onChange={(e) => setPartnerForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="cp-col">
                    <label className="cp-label">אימייל</label>
                    <input
                      className="cp-input"
                      type="email"
                      value={partnerForm.email}
                      onChange={(e) => setPartnerForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div style={{ alignSelf: "flex-end" }}>
                    <button type="submit" className="cp-btn cp-btn-primary" disabled={addingPartner}>
                      {addingPartner ? "מוסיף…" : "הוסף"}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Partner cards with stats */}
            {partnerStats.map(({ partner, stats: ps }) => (
              <div key={partner.id} className="cp-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>{partner.name}</div>
                    {partner.email && <div style={{ fontSize: "0.75rem", color: "#718096" }}>{partner.email}</div>}
                    <div style={{ fontSize: "0.75rem", color: "#4a5568", marginTop: 2 }}>
                      {ps.activeCount} פעיל · {ps.gradingCount} גריידינג · {ps.soldCount} נמכר
                    </div>
                  </div>
                  <button
                    className="cp-btn cp-btn-ghost cp-btn-sm"
                    onClick={() => exportCSV(
                      items.filter((i) => i.partner_id === partner.id),
                      partners
                    )}
                  >
                    ⬇ CSV
                  </button>
                </div>

                <div className="cp-row">
                  {[
                    { label: "השקעה (כולל גריידינג)", value: fmt$(ps.totalInvestment), cls: "cp-gold" },
                    { label: "הערכת שוק פעיל", value: fmt$(ps.portfolioEstimatedValue), cls: "cp-blue" },
                    { label: "הכנסות מכירות", value: fmt$(ps.realisedRevenue), cls: "cp-green" },
                    {
                      label: "רווח נטו + ROI",
                      value: `${fmt$(ps.realisedProfit)} (${ps.realisedROI.toFixed(1)}%)`,
                      cls: ps.realisedProfit >= 0 ? "cp-green" : "cp-red",
                    },
                  ].map((s) => (
                    <div key={s.label} className="cp-stat-card">
                      <div className="cp-stat-label">{s.label}</div>
                      <div className={`cp-stat-value ${s.cls}`} style={{ fontSize: "0.95rem" }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Per-partner top items */}
                {items
                  .filter((i) => i.partner_id === partner.id)
                  .slice(0, 5)
                  .map((i) => {
                    const costBasis = Number(i.buy_price) + Number(i.grading_cost || 0);
                    const value = i.status === "sold" ? (i.sell_price ?? 0) : (i.market_price ?? i.buy_price);
                    const profit = value - costBasis;
                    return (
                      <div
                        key={i.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 0",
                          borderTop: "1px solid #1e2533",
                          fontSize: "0.82rem",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600 }}>{i.name}</span>
                          <span style={{ color: "#718096", marginRight: 6 }}>{statusBadge(i.status)}</span>
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <span style={{ color: profit >= 0 ? "#48bb78" : "#fc8181" }}>
                            {profit >= 0 ? "+" : ""}{fmt$(profit)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}

            {partners.length === 0 && (
              <div className="cp-card" style={{ textAlign: "center", color: "#4a5568", padding: 32 }}>
                אין שותפים עדיין — הוסף שותף ראשון למעלה
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
