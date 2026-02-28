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
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

import type {
  CollectionItem,
  Partner,
  ChatMessage,
  SortConfig,
  ItemForm,
  ItemStatus,
  Tab,
} from "@/lib/collectpro/types";
import { computeStats, fmt$, fmtPct } from "@/lib/collectpro/stats";
import { callAI } from "@/lib/collectpro/ai";
import type { CardScanResult } from "@/lib/collectpro/ai";
import { useCollectProRealtime } from "@/lib/collectpro/realtime";
import { compressImage, uploadCardImage } from "@/lib/collectpro/image";
import { exportCSV, exportEbayCSV, exportCardmarketCSV } from "@/lib/collectpro/export";

import { INIT, reducer, today, emptyForm, PAGE } from "@/lib/collectpro/state";
import type { State } from "@/lib/collectpro/state";
import { itemCost, extractFirstPrice, findMatchingItems } from "@/lib/collectpro/helpers";

import CameraScanner from "@/components/collectpro/CameraScanner";
import GradingStudio from "@/components/collectpro/GradingStudio";
import CollectibleCard from "@/components/collectpro/CollectibleCard";
import CardDetailModal from "@/components/collectpro/CardDetailModal";
import { ArenaTab } from "@/components/collectpro/Arena";
import { SellDialog, BatchOperationModal, BatchPriceRefreshModal, ImportCSVModal } from "@/components/collectpro/Modals";
import type { ItemInsertRow } from "@/lib/collectpro/importcsv";
import AdminPanel from "@/components/collectpro/AdminPanel";
import { BatchBar, BottomNav } from "@/components/collectpro/Navigation";
import { StatusBadge } from "@/components/collectpro/StatusBadge";

export default function CollectPro() {
  const [s, d] = useReducer(reducer, INIT);
  // Separate abort controllers — cancelling chat must not kill an in-progress market scan
  const chatAbort  = useRef<AbortController | null>(null);
  const scanAbort  = useRef<AbortController | null>(null);
  const chatEndRef    = useRef<HTMLDivElement>(null);
  const chatInputRef  = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const undoTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state for sell dialog, batch operations, and grading studio
  const [sellTarget,     setSellTarget]     = useState<CollectionItem | null>(null);
  const [batchOp,        setBatchOp]        = useState<"status" | "price" | "partner" | null>(null);
  const [gradingForItem,        setGradingForItem]        = useState<CollectionItem | null>(null);
  const [batchPriceRefreshItems, setBatchPriceRefreshItems] = useState<CollectionItem[] | null>(null);
  const [expandedPartners,    setExpandedPartners]    = useState<Set<string>>(new Set());
  const [statusFilter,        setStatusFilter]        = useState<"all" | ItemStatus>("all");
  const [franchiseFilterInv,  setFranchiseFilterInv]  = useState<string | null>(null);
  const [scanHistory,         setScanHistory]         = useState<Array<{ query: string; mode: string; result: string; ts: number }>>([]);
  const [showImportCSV,       setShowImportCSV]       = useState(false);
  const [inlineEditId,        setInlineEditId]        = useState<string | null>(null);
  const [inlineEditVal,       setInlineEditVal]       = useState("");

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "/" || e.key === "s") {
        e.preventDefault();
        d({ t: "SET_TAB", tab: "inventory" });
        // Slight delay so the inventory tab renders first
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === "n") {
        d({ t: "SET_TAB", tab: "inventory" });
        d({ t: "INV_FORM_SHOW", show: true });
      } else if (e.key === "Escape") {
        if (s.inv.showForm) d({ t: "INV_FORM_SHOW", show: false });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.inv.showForm]);

  // ── Initial data load ──────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      // 1. Identify current user
      const { data: { user } } = await supabase.auth.getUser();

      // 2. Register in public user registry (fire-and-forget)
      if (user) {
        supabase.from("cp_users_public").upsert(
          { id: user.id, email: user.email ?? "", last_seen: new Date().toISOString() },
          { onConflict: "id" }
        ).then(() => {});
      }

      // 3. Check admin status + load data in parallel
      const [adminResult, { data: items }, { data: partners }] = await Promise.all([
        supabase.rpc("cp_is_admin"),
        supabase.from("coll_items").select("*").order("buy_date", { ascending: false }),
        supabase.from("coll_partners").select("*").order("name"),
      ]);

      d({ t: "SET_ADMIN",  v: !!adminResult.data });
      d({ t: "LOAD_OK", items: (items as CollectionItem[]) ?? [], partners: (partners as Partner[]) ?? [] });
    })();
  }, []);

  // ── Realtime sync (reconnect + DELETE fix) ────────────────────────────────

  const refetch = useCallback(async () => {
    const [{ data: items }, { data: partners }] = await Promise.all([
      supabase.from("coll_items").select("*").order("buy_date", { ascending: false }),
      supabase.from("coll_partners").select("*").order("name"),
    ]);
    d({ t: "LOAD_OK", items: (items as CollectionItem[]) ?? [], partners: (partners as Partner[]) ?? [] });
  }, []);

  const connState = useCollectProRealtime({
    onItem:    (event, item)    => d({ t: "RT_ITEM",    event, item }),
    onPartner: (event, partner) => d({ t: "RT_PARTNER", event, partner }),
    onRefetch: refetch,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [s.chat.messages]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const stats = useMemo(() => computeStats(s.items), [s.items]);

  // ── ROI Analytics ─────────────────────────────────────────────────────────

  const pnlTimeline = useMemo(() => {
    const sold = s.items
      .filter(i => i.status === "sold" && i.sell_price != null && i.sold_at)
      .sort((a, b) => new Date(a.sold_at!).getTime() - new Date(b.sold_at!).getTime());
    let cum = 0;
    return sold.map(i => {
      const cost = +i.buy_price + +(i.grading_cost ?? 0);
      cum += +(i.sell_price!) - cost;
      return {
        date: new Date(i.sold_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        profit: +cum.toFixed(0),
      };
    });
  }, [s.items]);

  const franchiseBreakdown = useMemo(() => {
    const active = s.items.filter(i => i.status === "active");
    const totalVal = active.reduce((acc, i) => acc + (i.market_price ?? +i.buy_price), 0);
    const map = new Map<string, { value: number; count: number }>();
    active.forEach(i => {
      const key = i.franchise ?? "Other";
      const e = map.get(key) ?? { value: 0, count: 0 };
      map.set(key, { value: e.value + (i.market_price ?? +i.buy_price), count: e.count + 1 });
    });
    return [...map.entries()]
      .map(([name, { value, count }]) => ({
        name, value, count,
        pct: totalVal > 0 ? (value / totalVal) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [s.items]);

  const topPerformers = useMemo(() => {
    return s.items
      .filter(i => +i.buy_price > 0)
      .map(i => {
        const cost   = +i.buy_price + +(i.grading_cost ?? 0);
        const val    = i.status === "sold" ? +(i.sell_price ?? 0) : (i.market_price ?? +i.buy_price);
        const profit = val - cost;
        const roi    = cost > 0 ? (profit / cost) * 100 : 0;
        return { item: i, roi, profit };
      })
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 5);
  }, [s.items]);

  const worstPerformers = useMemo(() => {
    return s.items
      .filter(i => +i.buy_price > 0)
      .map(i => {
        const cost   = +i.buy_price + +(i.grading_cost ?? 0);
        const val    = i.status === "sold" ? +(i.sell_price ?? 0) : (i.market_price ?? +i.buy_price);
        const profit = val - cost;
        const roi    = cost > 0 ? (profit / cost) * 100 : 0;
        return { item: i, roi, profit };
      })
      .sort((a, b) => a.roi - b.roi)
      .slice(0, 5);
  }, [s.items]);

  // Active items with known market price sorted by upside multiple (market / cost)
  const bestUpside = useMemo(() => {
    return s.items
      .filter(i => i.status === "active" && i.market_price != null && +i.buy_price > 0)
      .map(i => {
        const cost     = +i.buy_price + +(i.grading_cost ?? 0);
        const upside   = i.market_price! / cost;
        const profit   = i.market_price! - cost;
        return { item: i, upside, profit };
      })
      .filter(x => x.upside > 1)       // only show gainers
      .sort((a, b) => b.upside - a.upside)
      .slice(0, 5);
  }, [s.items]);

  // Raw active cards where market ≥ 2.5× cost — strong grading candidates
  // Estimate graded value = raw market × 2.5 (conservative PSA 10 premium)
  const gradingCandidates = useMemo(() => {
    const EST_FEE = 25; // typical PSA basic tier fee
    const EST_MULT = 2.5; // conservative PSA 10 premium over raw
    return s.items
      .filter(i => i.status === "active" && !i.psa_grade && i.market_price != null && +i.buy_price > 0)
      .map(i => {
        const cost      = +i.buy_price + +(i.grading_cost ?? 0);
        const rawMkt    = i.market_price!;
        const gradedEst = rawMkt * EST_MULT;
        const extraProfit = gradedEst - rawMkt - EST_FEE;
        const ratio     = rawMkt / cost;
        return { item: i, cost, rawMkt, gradedEst, extraProfit, ratio };
      })
      .filter(x => x.ratio >= 2.5 && x.extraProfit > 0)
      .sort((a, b) => b.extraProfit - a.extraProfit)
      .slice(0, 5);
  }, [s.items]);

  const avgHoldDays = useMemo(() => {
    const sold = s.items.filter(i => i.status === "sold" && i.sold_at);
    if (sold.length === 0) return null;
    const total = sold.reduce((acc, i) => {
      const days = (new Date(i.sold_at!).getTime() - new Date(i.buy_date).getTime()) / 86400000;
      return acc + days;
    }, 0);
    return Math.round(total / sold.length);
  }, [s.items]);

  const monthlyRevenue = useMemo(() => {
    const map = new Map<string, { revenue: number; profit: number }>();
    s.items
      .filter(i => i.status === "sold" && i.sell_price != null && i.sold_at)
      .forEach(i => {
        const month = new Date(i.sold_at!).toLocaleDateString("en-US", { year: "numeric", month: "short" });
        const cost  = +i.buy_price + +(i.grading_cost ?? 0);
        const entry = map.get(month) ?? { revenue: 0, profit: 0 };
        map.set(month, {
          revenue: entry.revenue + +(i.sell_price!),
          profit:  entry.profit  + (+(i.sell_price!) - cost),
        });
      });
    return [...map.entries()]
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([month, data]) => ({ month, ...data }));
  }, [s.items]);

  const portfolioAlerts = useMemo(() => {
    const alerts: { level: "warn" | "info"; msg: string; filter: "all" | ItemStatus }[] = [];
    const noPrice = s.items.filter(i => i.status === "active" && i.market_price == null);
    if (noPrice.length > 0) alerts.push({
      level: "warn",
      msg: `${noPrice.length} active card${noPrice.length > 1 ? "s have" : " has"} no market price — portfolio estimate may be inaccurate`,
      filter: "active",
    });
    const now = Date.now();
    const longGrading = s.items.filter(i => {
      if (i.status !== "grading") return false;
      return (now - new Date(i.buy_date).getTime()) / 86400000 > 60;
    });
    if (longGrading.length > 0) alerts.push({
      level: "warn",
      msg: `${longGrading.length} card${longGrading.length > 1 ? "s have" : " has"} been in grading for over 60 days`,
      filter: "grading",
    });
    const underwater = s.items.filter(i => {
      if (i.status !== "active" || i.market_price == null) return false;
      return i.market_price < (+i.buy_price + +(i.grading_cost ?? 0));
    });
    if (underwater.length > 0) alerts.push({
      level: "info",
      msg: `${underwater.length} active card${underwater.length > 1 ? "s are" : " is"} underwater (market price < cost)`,
      filter: "active",
    });
    return alerts;
  }, [s.items]);

  // Portfolio health score (0–100) — composite of 5 factors, each max 20pts
  const portfolioHealth = useMemo(() => {
    if (s.items.length === 0) return null;
    const active = s.items.filter(i => i.status === "active");
    if (active.length === 0) return null;

    // 1. Price coverage — % of active cards with a market price (0–20)
    const withPrice = active.filter(i => i.market_price != null).length;
    const priceCoverage = active.length > 0 ? Math.round((withPrice / active.length) * 20) : 0;

    // 2. Profitability — % of items (active+sold) with positive P&L (0–20)
    const evaluated = s.items.filter(i => +i.buy_price > 0);
    const profitable = evaluated.filter(i => {
      const cost = +i.buy_price + +(i.grading_cost ?? 0);
      const val  = i.status === "sold" ? +(i.sell_price ?? 0) : (i.market_price ?? +i.buy_price);
      return val >= cost;
    });
    const profitScore = evaluated.length > 0 ? Math.round((profitable.length / evaluated.length) * 20) : 0;

    // 3. Diversification — points for having 2+ franchises and 2+ partners (max 20)
    const franchises = new Set(s.items.map(i => i.franchise).filter(Boolean)).size;
    const partners   = new Set(s.items.map(i => i.partner_id)).size;
    const diverseScore = Math.min(20, (franchises >= 3 ? 10 : franchises * 4) + (partners >= 2 ? 10 : 0));

    // 4. No stale grading — deduct for cards in grading > 60 days (0–20)
    const now = Date.now();
    const staleGrading = s.items.filter(i =>
      i.status === "grading" && (now - new Date(i.buy_date).getTime()) / 86400000 > 60
    ).length;
    const gradingScore = Math.max(0, 20 - staleGrading * 5);

    // 5. ROI positivity — 20 pts if realised ROI > 0, scaled by magnitude (0–20)
    const roiScore = stats.roiPct > 20 ? 20 : stats.roiPct > 0 ? Math.round(stats.roiPct) : 0;

    const total = priceCoverage + profitScore + diverseScore + gradingScore + roiScore;
    const grade = total >= 80 ? "A" : total >= 60 ? "B" : total >= 40 ? "C" : "D";
    return { total, grade, priceCoverage, profitScore, diverseScore, gradingScore, roiScore };
  }, [s.items, stats]);

  const filteredItems = useMemo(() => {
    const q = s.inv.search.toLowerCase();
    return s.items.filter((i) =>
      (!q ||
        i.name.toLowerCase().includes(q) ||
        (i.card_set ?? "").toLowerCase().includes(q) ||
        (i.franchise ?? "").toLowerCase().includes(q)) &&
      (!s.franchise || !!i.franchise) &&
      (statusFilter === "all" || i.status === statusFilter) &&
      (!franchiseFilterInv || i.franchise === franchiseFilterInv)
    );
  }, [s.items, s.inv.search, s.franchise, statusFilter, franchiseFilterInv]);

  const invFranchises = useMemo(
    () => [...new Set(s.items.map((i) => i.franchise).filter(Boolean) as string[])].sort(),
    [s.items]
  );

  const conditionBreakdown = useMemo(() => {
    const ORDER = ["M", "NM", "LP", "MP", "HP", "D", "PSA"];
    const map   = new Map<string, number>();
    s.items.filter(i => i.status !== "sold").forEach(i => {
      map.set(i.condition, (map.get(i.condition) ?? 0) + 1);
    });
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    return ORDER
      .filter(c => map.has(c))
      .map(c => ({ condition: c, count: map.get(c)!, pct: (map.get(c)! / total) * 100 }));
  }, [s.items]);

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

  const portfolioCtx = useMemo(() => {
    const partnerName = (id: string) => s.partners.find((p) => p.id === id)?.name ?? "Unknown";
    const cost = (i: CollectionItem) => +i.buy_price + +(i.grading_cost ?? 0);
    const pct  = (val: number, base: number) => base > 0 ? ` (${val >= base ? "+" : ""}${(((val - base) / base) * 100).toFixed(1)}%)` : "";

    const active  = s.items.filter((i) => i.status === "active");
    const grading = s.items.filter((i) => i.status === "grading");
    const sold    = s.items.filter((i) => i.status === "sold" && i.sell_price != null);

    const lines: string[] = [
      "=== PORTFOLIO SUMMARY ===",
      `Cards: ${s.items.length} total  |  ${active.length} active, ${grading.length} grading, ${sold.length} sold`,
      `Total invested (buy + grading): ${fmt$(stats.totalCost)}`,
      `Active market estimate: ${fmt$(stats.estimatedValue)}${pct(stats.estimatedValue, stats.totalCost - sold.reduce((s,i)=>s+cost(i),0))}`,
      `Unrealised P&L: ${fmt$(stats.unrealisedPnL)}`,
      `Realised profit: ${fmt$(stats.realisedProfit)} on ${sold.length} sales (ROI ${fmtPct(stats.roiPct)})`,
    ];

    // Active cards — sorted by market value desc
    const sortedActive = [...active].sort(
      (a, b) => (+(b.market_price ?? b.buy_price)) - (+(a.market_price ?? a.buy_price))
    );
    lines.push("", "=== ACTIVE CARDS (by market value) ===");
    sortedActive.slice(0, 60).forEach((i, idx) => {
      const c = cost(i);
      const m = i.market_price ?? null;
      lines.push(
        `${idx + 1}. ${i.name}${i.card_set ? ` [${i.card_set}]` : ""}` +
        `${i.franchise ? ` | ${i.franchise}` : ""}` +
        ` | ${i.condition}` +
        (i.psa_grade ? ` | PSA ${i.psa_grade}` : " | Raw") +
        ` | Cost: ${fmt$(c)}` +
        (m != null ? ` | Market: ${fmt$(m)}${pct(m, c)}` : " | Market: unknown") +
        ` | Partner: ${partnerName(i.partner_id)}`
      );
    });

    // Grading queue
    if (grading.length > 0) {
      lines.push("", "=== GRADING QUEUE ===");
      grading.forEach((i) => {
        lines.push(
          `• ${i.name}${i.card_set ? ` [${i.card_set}]` : ""} | ${i.condition} | Cost so far: ${fmt$(cost(i))}` +
          (i.market_price ? ` | Target market: ${fmt$(i.market_price)}` : "")
        );
      });
    }

    // Sold history
    if (sold.length > 0) {
      lines.push("", "=== SOLD TRANSACTIONS ===");
      sold.forEach((i) => {
        const c = cost(i);
        const profit = +(i.sell_price ?? 0) - c;
        lines.push(
          `• ${i.name} | Sold: ${fmt$(i.sell_price!)} | Cost: ${fmt$(c)} | Net: ${profit >= 0 ? "+" : ""}${fmt$(profit)}${pct(+(i.sell_price!), c)} | Partner: ${partnerName(i.partner_id)}`
        );
      });
    }

    // Top grading candidates (raw cards with market > 3x cost)
    const gradingCandidates = active
      .filter((i) => !i.psa_grade && i.market_price != null && i.market_price / cost(i) >= 2.5)
      .sort((a, b) => (b.market_price! / cost(b)) - (a.market_price! / cost(a)))
      .slice(0, 5);

    if (gradingCandidates.length > 0) {
      lines.push("", "=== TOP GRADING CANDIDATES (market ≥ 2.5× cost, raw) ===");
      gradingCandidates.forEach((i) => {
        const c = cost(i);
        lines.push(
          `• ${i.name} | Cost: ${fmt$(c)} | Market: ${fmt$(i.market_price!)} (${(i.market_price! / c).toFixed(1)}×) | ${i.condition}`
        );
      });
    }

    return lines.join("\n");
  }, [s.items, s.partners, stats]);

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

      const isSold = f.status === "sold";
      const payload = {
        name: f.name.trim(),
        card_set: f.card_set || null,
        franchise: f.franchise || null,
        condition: f.condition,
        buy_price: +f.buy_price,
        grading_cost: +(f.grading_cost) || 0,
        market_price: f.market_price ? +f.market_price : null,
        sell_price: isSold && f.sell_price ? +f.sell_price : null,
        sold_at: isSold && f.sold_at ? f.sold_at : null,
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
          const originalItem = s.items.find((i) => i.id === s.inv.editId);
          if (originalItem) {
            d({ t: "RT_ITEM", event: "UPDATE", item: { ...originalItem, ...payload, updated_at: new Date().toISOString() } });
          }
          const { error } = await supabase.from("coll_items").update(payload).eq("id", s.inv.editId);
          if (error) {
            if (originalItem) d({ t: "RT_ITEM", event: "UPDATE", item: originalItem }); // rollback
            throw error;
          }
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
        sell_price: item.sell_price != null ? String(item.sell_price) : "",
        sold_at: item.sold_at ? item.sold_at.slice(0, 10) : "",
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

  const markSold = useCallback((item: CollectionItem) => {
    setSellTarget(item);
  }, []);

  const markSoldConfirm = useCallback(async (item: CollectionItem, price: number) => {
    const soldAt = new Date().toISOString();
    // Optimistic update — item moves to sold immediately without waiting for DB round-trip
    d({ t: "RT_ITEM", event: "UPDATE", item: { ...item, status: "sold" as ItemStatus, sell_price: price, sold_at: soldAt } });
    const { error } = await supabase
      .from("coll_items")
      .update({ status: "sold", sell_price: price, sold_at: soldAt })
      .eq("id", item.id);
    if (error) {
      d({ t: "RT_ITEM", event: "UPDATE", item }); // rollback
      toast.error(error.message);
      return;
    }

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
    setSellTarget(null);
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

  const batchUpdateStatus = useCallback(() => {
    setBatchOp("status");
  }, []);

  const executeBatchStatus = useCallback(async (newStatus: ItemStatus) => {
    const { error } = await supabase
      .from("coll_items")
      .update({ status: newStatus })
      .in("id", s.inv.selected);
    if (error) { toast.error(error.message); return; }
    d({ t: "INV_SEL_CLEAR" });
    toast.success(`${s.inv.selected.length} items updated to "${newStatus}"`);
  }, [s.inv.selected]);

  const batchUpdatePrice = useCallback(() => {
    setBatchOp("price");
  }, []);

  const executeBatchPrice = useCallback(async (price: number) => {
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

  const [batchDeleteTarget, setBatchDeleteTarget] = useState(false);

  const batchDelete = useCallback(() => {
    setBatchDeleteTarget(true);
  }, []);

  const executeBatchDelete = useCallback(async () => {
    const { error } = await supabase.from("coll_items").delete().in("id", s.inv.selected);
    if (error) { toast.error(error.message); return; }
    d({ t: "INV_SEL_CLEAR" });
    toast.success(`${s.inv.selected.length} items deleted`);
    setBatchDeleteTarget(false);
  }, [s.inv.selected]);

  const batchPartnerReassign = useCallback(() => {
    setBatchOp("partner" as "status" | "price");
  }, []);

  const executeBatchPartner = useCallback(async (partnerId: string) => {
    const { error } = await supabase
      .from("coll_items")
      .update({ partner_id: partnerId })
      .in("id", s.inv.selected);
    if (error) { toast.error(error.message); return; }
    const partnerName = s.partners.find(p => p.id === partnerId)?.name ?? partnerId;
    d({ t: "INV_SEL_CLEAR" });
    toast.success(`${s.inv.selected.length} items reassigned to ${partnerName}`);
  }, [s.inv.selected, s.partners]);

  const executeImportCSV = useCallback(async (rows: ItemInsertRow[]) => {
    if (rows.length === 0) return;
    const { error } = await supabase.from("coll_items").insert(rows);
    if (error) { toast.error(`Import error: ${error.message}`); throw error; }
    await refetch();
    toast.success(`${rows.length} item${rows.length !== 1 ? "s" : ""} imported`);
  }, [refetch]);

  const saveInlinePrice = useCallback(async (itemId: string, rawVal: string) => {
    setInlineEditId(null);
    const price = parseFloat(rawVal);
    if (isNaN(price) || price < 0) return;
    const item = s.items.find(i => i.id === itemId);
    if (!item) return;
    // Optimistic update
    d({ t: "RT_ITEM", event: "UPDATE", item: { ...item, market_price: price, updated_at: new Date().toISOString() } });
    const { error } = await supabase.from("coll_items").update({ market_price: price }).eq("id", itemId);
    if (error) {
      d({ t: "RT_ITEM", event: "UPDATE", item }); // rollback
      toast.error(error.message);
      return;
    }
    supabase.from("cp_price_history").insert({
      item_id: itemId, price, source: "manual", note: "Inline price edit",
    }).then(() => {});
    toast.success("Market price updated");
  }, [s.items]);

  // ── AI — Brain chat ────────────────────────────────────────────────────────

  const sendChatMessage = useCallback(async (text: string) => {
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

    chatAbort.current?.abort(); // cancel any previous chat request
    chatAbort.current = new AbortController();
    try {
      const reply = await callAI(messages, "brain", { signal: chatAbort.current.signal });
      d({ t: "CHAT_MSG", m: { role: "assistant", content: reply } });
    } catch (err: unknown) {
      if ((err as Error).message !== "ABORTED") toast.error(`AI: ${(err as Error).message}`);
    } finally {
      d({ t: "CHAT_BUSY", v: false });
      setTimeout(() => chatInputRef.current?.focus(), 50);
    }
  }, [s.chat.busy, s.chat.messages, portfolioCtx]);

  const sendChat = useCallback(() => {
    sendChatMessage(s.chat.input.trim());
  }, [s.chat.input, sendChatMessage]);

  // ── AI — Market scan ───────────────────────────────────────────────────────

  const runScan = useCallback(async () => {
    const query = s.market.query.trim();
    if (!query || s.market.busy) return;
    d({ t: "MKT_RESULT", v: "" });
    d({ t: "MKT_BUSY", v: true });
    scanAbort.current?.abort(); // cancel any previous scan
    scanAbort.current = new AbortController();
    try {
      const result = await callAI(
        [{ role: "user", content: query }],
        s.market.mode,
        { signal: scanAbort.current.signal, cacheKey: query }
      );
      d({ t: "MKT_RESULT", v: result });
      setScanHistory((prev) => [
        { query, mode: s.market.mode, result, ts: Date.now() },
        ...prev.filter((h) => h.query !== query),
      ].slice(0, 5));
    } catch (err: unknown) {
      if ((err as Error).message !== "ABORTED") toast.error(`Scan: ${(err as Error).message}`);
    } finally {
      d({ t: "MKT_BUSY", v: false });
    }
  }, [s.market.query, s.market.busy, s.market.mode]);

  const cancelAI = useCallback(() => {
    chatAbort.current?.abort();
    scanAbort.current?.abort();
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

  const updateItemNotes = useCallback(async (itemId: string, notes: string) => {
    const item = s.items.find(i => i.id === itemId);
    if (!item) return;
    d({ t: "RT_ITEM", event: "UPDATE", item: { ...item, notes: notes || undefined, updated_at: new Date().toISOString() } });
    const { error } = await supabase.from("coll_items").update({ notes: notes || null }).eq("id", itemId);
    if (error) {
      d({ t: "RT_ITEM", event: "UPDATE", item }); // rollback
      toast.error(error.message);
      throw error;
    }
    toast.success("Notes saved");
  }, [s.items]);

  // ── Modal item ─────────────────────────────────────────────────────────────

  const modalItem = s.modal ? s.items.find((i) => i.id === s.modal) ?? null : null;
  const modalPartner = modalItem ? s.partners.find((p) => p.id === modalItem.partner_id) : undefined;

  // ─────────────────────────────────────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────────────────────────────────────

  if (s.loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 gap-5">
        <div className="text-center">
          <div className="text-3xl font-extrabold text-white tracking-tight">CollectPro</div>
          <div className="text-sm text-gray-500 mt-1">TCG Card Portfolio Manager</div>
        </div>
        <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-sm text-gray-600">Loading portfolio…</div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-gray-950 text-gray-100 font-sans">

      {/* ── Sell dialog ─────────────────────────────────────────────────────── */}
      {sellTarget && (
        <SellDialog
          item={sellTarget}
          onConfirm={markSoldConfirm}
          onClose={() => setSellTarget(null)}
        />
      )}

      {/* ── Batch operation modals ───────────────────────────────────────────── */}
      {batchOp && (
        <BatchOperationModal
          type={batchOp}
          count={s.inv.selected.length}
          partners={s.partners}
          onStatusUpdate={executeBatchStatus}
          onPriceUpdate={executeBatchPrice}
          onPartnerUpdate={executeBatchPartner}
          onClose={() => setBatchOp(null)}
        />
      )}

      {/* ── Batch delete confirmation ────────────────────────────────────────── */}
      <AlertDialog open={batchDeleteTarget} onOpenChange={(open) => !open && setBatchDeleteTarget(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {s.inv.selected.length} items?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All selected items will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-700 hover:bg-red-800" onClick={executeBatchDelete}>
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          onUpdateNotes={updateItemNotes}
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white">CollectPro</h1>
              <span
                className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                  connState === "live"    ? "bg-emerald-400" :
                  connState === "offline" ? "bg-red-500" :
                  "bg-amber-400 animate-pulse"
                }`}
                title={`Sync: ${connState}`}
              />
            </div>
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
        {([
          "brain", "inventory", "roi", "arena", "market", "partners", "grade",
          ...(s.isAdmin ? ["admin"] : []),
        ] as Tab[]).map((tab) => {
          const labels: Record<Tab, string> = {
            brain: "🧠 Brain", inventory: "📦 Inventory", roi: "📈 ROI",
            arena: "⚔️ Arena", market: "🌐 Market", partners: "🤝 Partners",
            grade: "🔬 Grading", admin: "🔐 Admin",
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
          <div className="space-y-3">

            {/* ── Health Score ──────────────────────────────────────────────────── */}
            {portfolioHealth && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Portfolio Health Score</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-3xl font-extrabold ${
                      portfolioHealth.grade === "A" ? "text-emerald-400" :
                      portfolioHealth.grade === "B" ? "text-blue-400" :
                      portfolioHealth.grade === "C" ? "text-amber-400" : "text-red-400"
                    }`}>{portfolioHealth.grade}</span>
                    <span className="text-lg font-bold text-gray-300">{portfolioHealth.total}<span className="text-xs text-gray-600">/100</span></span>
                  </div>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      portfolioHealth.total >= 80 ? "bg-emerald-500" :
                      portfolioHealth.total >= 60 ? "bg-blue-500" :
                      portfolioHealth.total >= 40 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${portfolioHealth.total}%` }}
                  />
                </div>
                <div className="grid grid-cols-5 gap-1 text-xs">
                  {[
                    { label: "Prices",  score: portfolioHealth.priceCoverage  },
                    { label: "P&L",     score: portfolioHealth.profitScore     },
                    { label: "Diverse", score: portfolioHealth.diverseScore    },
                    { label: "Grading", score: portfolioHealth.gradingScore    },
                    { label: "ROI",     score: portfolioHealth.roiScore        },
                  ].map((f) => (
                    <div key={f.label} className="text-center">
                      <div className="h-1 bg-gray-800 rounded-full overflow-hidden mb-1">
                        <div className="h-full bg-blue-600/70 rounded-full" style={{ width: `${(f.score / 20) * 100}%` }} />
                      </div>
                      <span className="text-gray-600">{f.label}</span>
                      <span className="block text-gray-400 font-mono">{f.score}/20</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Portfolio snapshot ──────────────────────────────────────────── */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Portfolio Snapshot</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Active",   value: stats.activeCount.toString(),        sub: "cards",         color: "text-blue-400" },
                  { label: "Grading",  value: stats.gradingCount.toString(),       sub: "cards",         color: "text-amber-400" },
                  { label: "Invested", value: fmt$(stats.totalCost),               sub: "buy + grading", color: "text-gray-200" },
                  { label: "Est. P&L", value: fmt$(stats.unrealisedPnL),           sub: "unrealised",    color: stats.unrealisedPnL >= 0 ? "text-emerald-400" : "text-red-400" },
                ].map((st) => (
                  <div key={st.label} className="bg-gray-800/60 rounded-lg px-3 py-2">
                    <div className="text-xs text-gray-500">{st.label}</div>
                    <div className={`text-sm font-bold ${st.color}`}>{st.value}</div>
                    <div className="text-xs text-gray-600">{st.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Grading Queue ────────────────────────────────────────────────── */}
            {s.items.filter(i => i.status === "grading").length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>Grading Queue</span>
                  <span className="text-amber-500 font-mono">{s.items.filter(i => i.status === "grading").length} cards</span>
                </div>
                <div className="space-y-2">
                  {s.items
                    .filter(i => i.status === "grading")
                    .sort((a, b) => new Date(a.buy_date).getTime() - new Date(b.buy_date).getTime())
                    .map((item) => {
                      const days = Math.round((Date.now() - new Date(item.buy_date).getTime()) / 86400000);
                      const isLong = days > 60;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => d({ t: "SET_MODAL", id: item.id })}
                          className="w-full flex items-center justify-between gap-3 py-2 px-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {item.image_url && (
                              <img src={item.image_url} alt={item.name} loading="lazy" className="w-8 h-10 object-cover rounded flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.condition}{item.card_set ? ` · ${item.card_set}` : ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isLong ? "bg-red-900/60 text-red-300" : "bg-amber-900/60 text-amber-300"}`}>
                              {days}d
                            </span>
                            <span className="text-xs text-gray-500">{fmt$(+item.buy_price + +(item.grading_cost ?? 0))}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ── Best Upside ──────────────────────────────────────────────────── */}
            {bestUpside.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>🚀 Best Upside (Active)</span>
                  <span className="text-xs text-gray-600 font-normal normal-case">market ÷ cost</span>
                </div>
                <div className="space-y-2">
                  {bestUpside.map(({ item, upside, profit }, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => d({ t: "SET_MODAL", id: item.id })}
                      className="w-full flex items-center justify-between gap-3 py-1.5 px-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-gray-600 text-xs w-4 text-center">{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.condition}{item.psa_grade ? ` · PSA ${item.psa_grade}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-emerald-400">+{fmt$(profit)}</span>
                        <span className="text-sm font-bold text-emerald-400">{upside.toFixed(2)}×</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Grading Candidates ────────────────────────────────────────────── */}
            {gradingCandidates.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>🔬 Grade-Up Candidates</span>
                  <span className="text-xs text-gray-600 font-normal normal-case">raw × 2.5 est. — PSA 10 premium</span>
                </div>
                <div className="space-y-2">
                  {gradingCandidates.map(({ item, rawMkt, gradedEst, extraProfit, ratio }) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => d({ t: "SET_MODAL", id: item.id })}
                      className="w-full flex items-center justify-between gap-3 py-1.5 px-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {item.image_url && (
                          <img src={item.image_url} alt={item.name} loading="lazy" className="w-7 h-9 object-cover rounded flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.condition}{item.card_set ? ` · ${item.card_set}` : ""} · {ratio.toFixed(1)}× upside</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-right">
                        <div>
                          <div className="text-xs text-gray-500">{fmt$(rawMkt)} → {fmt$(gradedEst)}</div>
                          <div className="text-xs font-semibold text-indigo-400">+{fmt$(extraProfit)} est.</div>
                        </div>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300">Grade</span>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-700 mt-2">Estimates use raw × 2.5 premium and $25 grading fee. Actual results may vary.</p>
              </div>
            )}

            {/* ── Partner Summary ──────────────────────────────────────────────── */}
            {s.partners.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>Partner Overview</span>
                  <button
                    type="button"
                    onClick={() => d({ t: "SET_TAB", tab: "partners" })}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >View all →</button>
                </div>
                <div className="space-y-2">
                  {partnerStats.map(({ partner, stats: ps }) => {
                    const pctRoi = ps.roiPct;
                    return (
                      <div key={partner.id} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-300 w-24 truncate flex-shrink-0">{partner.name}</span>
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${ps.realisedProfit >= 0 ? "bg-emerald-600" : "bg-red-600"}`}
                            style={{ width: `${Math.min(100, Math.abs(pctRoi))}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500">{ps.activeCount + ps.gradingCount} cards</span>
                          <span className={`text-xs font-semibold ${pctRoi >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {pctRoi >= 0 ? "+" : ""}{fmtPct(pctRoi)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Alerts ──────────────────────────────────────────────────────── */}
            {portfolioAlerts.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Portfolio Alerts</div>
                {portfolioAlerts.map((a, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setStatusFilter(a.filter);
                      d({ t: "SET_TAB", tab: "inventory" });
                    }}
                    className={`w-full flex items-start gap-2 text-xs px-3 py-2 rounded-lg text-left transition-opacity hover:opacity-80 ${
                      a.level === "warn" ? "bg-amber-950/60 border border-amber-800/50 text-amber-300" : "bg-blue-950/60 border border-blue-800/50 text-blue-300"
                    }`}
                  >
                    <span className="text-base leading-none mt-0.5">{a.level === "warn" ? "⚠" : "ℹ"}</span>
                    <span className="flex-1">{a.msg}</span>
                    <span className="text-xs opacity-60 whitespace-nowrap mt-0.5">→ View</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Chat ────────────────────────────────────────────────────────── */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="font-bold mb-1">🧠 Forensic Portfolio Advisor</h2>
              <p className="text-xs text-gray-500 mb-3">Analysis based on your real portfolio data. Ask anything — including uncomfortable questions.</p>

              {/* Suggested questions — shown only when chat is empty */}
              {s.chat.messages.length === 0 && !s.chat.busy && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    "איזה קלף כדאי למכור עכשיו?",
                    "מהם המועמדים הטובים לגריידינג?",
                    "סיכום בריאות הפורטפוליו",
                    "איזה קלף מסוכן לשמירה?",
                    "מה ה-ROI הממוצע שלי?",
                    "השוואת פרנצ'ייזים",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => sendChatMessage(q)}
                      className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs border border-gray-700 hover:border-gray-500 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3 max-h-96 overflow-y-auto mb-3 p-1">
                {s.chat.messages.length === 0 && !s.chat.busy && (
                  <p className="text-center text-gray-600 text-sm mt-6">לחץ על שאלה מהרשימה למעלה לניתוח מיידי, או כתוב בחינם</p>
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
                {s.chat.busy && <div className="self-end text-sm text-gray-500 italic">מנתח…</div>}
                <div ref={chatEndRef} />
              </div>

              <div className="flex gap-2">
                <Input
                  ref={chatInputRef}
                  dir="rtl"
                  value={s.chat.input}
                  onChange={(e) => d({ t: "CHAT_INPUT", v: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                  placeholder="שאל על הפורטפוליו שלך…"
                  disabled={s.chat.busy}
                  className="bg-gray-800 border-gray-700"
                />
                {s.chat.busy
                  ? <Button variant="destructive" onClick={cancelAI}>ביטול</Button>
                  : <Button onClick={sendChat} disabled={!s.chat.input.trim()}>שלח</Button>
                }
              </div>
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
                ref={searchInputRef}
                className="flex-1 min-w-[160px] bg-gray-800 border-gray-700"
                value={s.inv.search}
                onChange={(e) => d({ t: "INV_SEARCH", v: e.target.value })}
                placeholder="🔍 Search name, set, franchise… ( / )"
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
                <Button variant="outline" size="sm" onClick={() => setShowImportCSV(true)} title="Import CSV">📥</Button>
              </div>
              <div className="group relative">
                <button className="w-6 h-6 rounded-full bg-gray-800 text-gray-500 hover:text-white text-xs font-bold flex items-center justify-center transition-colors" title="Keyboard shortcuts">?</button>
                <div className="absolute right-0 top-8 z-30 bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-gray-400 whitespace-nowrap shadow-xl hidden group-hover:block">
                  <div className="font-semibold text-gray-300 mb-1.5">Keyboard shortcuts</div>
                  <div className="space-y-1">
                    <div><kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">/</kbd> or <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">s</kbd> — Focus search</div>
                    <div><kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">n</kbd> — New item</div>
                    <div><kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">Esc</kbd> — Close form</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status filter chips */}
            {(() => {
              const activeItems  = s.items.filter(i => i.status === "active");
              const noPriceCount = activeItems.filter(i => i.market_price == null).length;
              return (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {([
                    { key: "all",     label: "All",     count: s.items.length,                                   badge: null },
                    { key: "active",  label: "Active",  count: activeItems.length,                               badge: noPriceCount > 0 ? `${noPriceCount} no price` : null },
                    { key: "grading", label: "Grading", count: s.items.filter(i => i.status === "grading").length, badge: null },
                    { key: "sold",    label: "Sold",    count: s.items.filter(i => i.status === "sold").length,   badge: null },
                  ] as const).map(({ key, label, count, badge }) => (
                    <button
                      key={key}
                      onClick={() => { setStatusFilter(key); d({ t: "INV_PAGE", n: 1 }); }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        statusFilter === key
                          ? "bg-blue-700 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                      }`}
                    >
                      {label} <span className={statusFilter === key ? "text-blue-200" : "text-gray-600"}>{count}</span>
                      {badge && <span className="ml-1 text-amber-500/80 text-xs">· {badge}</span>}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Franchise filter chips (only when >1 franchise) */}
            {invFranchises.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {invFranchises.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFranchiseFilterInv((prev) => prev === f ? null : f)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      franchiseFilterInv === f
                        ? "bg-indigo-700 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >{f}</button>
                ))}
              </div>
            )}

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

                  {/* Sale fields — only shown when status = sold */}
                  {s.inv.form.status === "sold" && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg">
                      <div>
                        <label className="text-xs text-emerald-400 block mb-1">Sale Price ($)</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="bg-gray-800 border-gray-700"
                          value={s.inv.form.sell_price}
                          onChange={(e) => d({ t: "INV_FORM_PATCH", p: { sell_price: e.target.value } })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-emerald-400 block mb-1">Sold Date</label>
                        <Input
                          type="date"
                          className="bg-gray-800 border-gray-700"
                          value={s.inv.form.sold_at}
                          onChange={(e) => d({ t: "INV_FORM_PATCH", p: { sold_at: e.target.value } })}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Notes</label>
                    <Textarea
                      dir="rtl"
                      rows={2}
                      className="bg-gray-800 border-gray-700 resize-none"
                      value={s.inv.form.notes}
                      onChange={(e) => d({ t: "INV_FORM_PATCH", p: { notes: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Image</label>
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1.5">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImage}
                          className="text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600"
                        />
                        <Input
                          type="url"
                          className="bg-gray-800 border-gray-700 text-xs"
                          placeholder="…or paste image URL (https://…)"
                          value={s.inv.form.image_url.startsWith("data:") ? "" : s.inv.form.image_url}
                          onChange={(e) => d({ t: "INV_FORM_PATCH", p: { image_url: e.target.value } })}
                        />
                      </div>
                      {s.inv.form.image_url && (
                        <img
                          src={s.inv.form.image_url}
                          alt="preview"
                          className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                    </div>
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
                    onGrade={setGradingForItem}
                    arenaSlot={
                      s.arena.a === item.id ? "a" : s.arena.b === item.id ? "b" : null
                    }
                  />
                ))}
                {pagedItems.length === 0 && (
                  <div className="col-span-full text-center py-16 text-gray-600">
                    {s.inv.search ? (
                      <>
                        <div className="text-3xl mb-2">🔍</div>
                        <div>No cards match "{s.inv.search}"</div>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl mb-2">📦</div>
                        <div className="font-semibold mb-1">No cards yet</div>
                        <div className="text-sm text-gray-700">Click "Add" or use the 📸 Camera Scan to add your first card</div>
                      </>
                    )}
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
                            <button
                              type="button"
                              onClick={() => d({ t: "SET_MODAL", id: item.id })}
                              className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                            >
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  loading="lazy"
                                  className="w-9 h-9 rounded-md object-cover flex-shrink-0"
                                />
                              )}
                              <div>
                                <div className="font-semibold hover:text-blue-300 transition-colors">{item.name}</div>
                                <div className="text-xs text-gray-500">
                                  {[item.card_set, item.condition, item.psa_grade ? `PSA ${item.psa_grade}` : ""].filter(Boolean).join(" · ")}
                                </div>
                              </div>
                            </button>
                          </td>
                          <td className="px-3 py-2.5"><StatusBadge status={item.status} /></td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">
                            {item.buy_date}
                            {(() => {
                              const ageDays = Math.round((Date.now() - new Date(item.buy_date).getTime()) / 86400000);
                              if (item.status === "sold") return null;
                              const cls = ageDays <= 30 ? "text-gray-600" : ageDays <= 90 ? "text-amber-600" : "text-red-600";
                              return <div className={`font-mono text-xs mt-0.5 ${cls}`}>{ageDays}d old</div>;
                            })()}
                          </td>
                          <td className="px-3 py-2.5">{fmt$(item.buy_price)}</td>
                          <td className="px-3 py-2.5 text-amber-400">
                            {item.grading_cost ? fmt$(item.grading_cost) : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {inlineEditId === item.id ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                autoFocus
                                value={inlineEditVal}
                                onChange={e => setInlineEditVal(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") saveInlinePrice(item.id, inlineEditVal);
                                  if (e.key === "Escape") setInlineEditId(null);
                                }}
                                className="w-20 bg-gray-800 border border-blue-600 rounded px-2 py-0.5 text-xs text-blue-300 focus:outline-none"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setInlineEditId(item.id); setInlineEditVal(item.market_price != null ? String(item.market_price) : ""); }}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                                title="Click to edit market price"
                              >
                                {item.market_price != null ? fmt$(item.market_price) : <span className="text-gray-600 text-xs">+ price</span>}
                              </button>
                            )}
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
                              <button
                                onClick={() => setGradingForItem(item)}
                                className="text-xs px-2 py-1 bg-indigo-900/60 text-indigo-300 rounded hover:bg-indigo-800 transition-colors"
                                title="Pre-grade"
                              >🔬</button>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {([
                { label: "Total Invested", value: fmt$(stats.totalCost), cls: "text-amber-400" },
                { label: "Sale Revenue", value: fmt$(stats.realisedRevenue), cls: "text-blue-400" },
                { label: "Net Realised Profit", value: fmt$(stats.realisedProfit), cls: stats.realisedProfit >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Realised ROI", value: fmtPct(stats.roiPct), cls: stats.roiPct >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Avg Hold Time", value: avgHoldDays != null ? `${avgHoldDays}d` : "—", cls: "text-purple-400" },
              ] as const).map((st) => (
                <div key={st.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">{st.label}</div>
                  <div className={`text-lg font-bold ${st.cls}`}>{st.value}</div>
                </div>
              ))}
            </div>

            {/* ── Cumulative P&L Timeline ─────────────────────────────── */}
            {pnlTimeline.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Cumulative P&L Timeline</p>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={pnlTimeline} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pnl-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={fmt$} width={48} />
                    <Tooltip
                      formatter={(v: number) => [fmt$(v), "Cumulative Profit"]}
                      contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2}
                      fill="url(#pnl-grad)" dot={{ fill: "#10b981", r: 3, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Active Portfolio by Franchise ────────────────────────── */}
            {franchiseBreakdown.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-4">Active Portfolio by Franchise</p>
                <div className="space-y-3">
                  {franchiseBreakdown.map(({ name, value, count, pct }) => (
                    <div key={name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300 font-medium">
                          {name} <span className="text-gray-600 font-normal">({count} card{count !== 1 ? "s" : ""})</span>
                        </span>
                        <span className="text-blue-400 font-semibold">{fmt$(value)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Condition Distribution ────────────────────────────────── */}
            {conditionBreakdown.length > 1 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-4">Condition Distribution (active + grading)</p>
                <div className="space-y-2.5">
                  {conditionBreakdown.map(({ condition, count, pct }) => (
                    <div key={condition} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-8 text-right font-mono flex-shrink-0">{condition}</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-14 text-right flex-shrink-0">{count} ({pct.toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Top Performers ───────────────────────────────────────── */}
            {topPerformers.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800 text-sm font-semibold flex items-center gap-2">
                  <span>🏆 Top Performers</span>
                  <span className="text-xs text-gray-500 font-normal">by ROI (active + sold)</span>
                </div>
                {topPerformers.map(({ item, roi, profit }, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => d({ t: "SET_MODAL", id: item.id })}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-800/40 last:border-0 hover:bg-white/[0.04] transition-colors text-left"
                  >
                    <span className="text-gray-600 text-xs w-4 shrink-0 text-center">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.status === "sold" ? "✓ Sold" : item.condition}
                        {item.psa_grade ? ` · PSA ${item.psa_grade}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtPct(roi)}</p>
                      <p className="text-xs text-gray-500">{profit >= 0 ? "+" : ""}{fmt$(profit)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── Monthly Revenue Bar Chart ──────────────────────────────── */}
            {monthlyRevenue.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Monthly Sales Revenue</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={monthlyRevenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmt$} width={48} />
                    <Tooltip
                      formatter={(v: number, name: string) => [fmt$(v), name === "revenue" ? "Revenue" : "Net Profit"]}
                      contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <Bar dataKey="revenue" name="revenue" radius={[3, 3, 0, 0]}>
                      {monthlyRevenue.map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? "#3b82f6" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Worst Performers ─────────────────────────────────────── */}
            {worstPerformers.length > 0 && worstPerformers[0].roi < 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800 text-sm font-semibold flex items-center gap-2">
                  <span>📉 Worst Performers</span>
                  <span className="text-xs text-gray-500 font-normal">by ROI (active + sold)</span>
                </div>
                {worstPerformers.filter(p => p.roi < 0).map(({ item, roi, profit }, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => d({ t: "SET_MODAL", id: item.id })}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-800/40 last:border-0 hover:bg-white/[0.04] transition-colors text-left"
                  >
                    <span className="text-gray-600 text-xs w-4 shrink-0 text-center">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.status === "sold" ? "✓ Sold" : item.condition}
                        {item.psa_grade ? ` · PSA ${item.psa_grade}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-red-400">{fmtPct(roi)}</p>
                      <p className="text-xs text-gray-500">{fmt$(profit)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-auto">
              <div className="px-4 py-3 border-b border-gray-800 font-semibold text-sm flex items-center justify-between">
                <span>Sold Transactions</span>
                <span className="text-xs text-gray-500 font-normal">{s.items.filter(i => i.status === "sold").length} sales</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {["Item", "Sold Date", "Buy", "Grading", "Base Cost", "Sale", "Net Profit", "ROI", "Hold", "Partner"].map((h) => (
                      <th key={h} className="text-right px-3 py-2.5 text-xs font-semibold text-gray-400 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.items.filter((i) => i.status === "sold" && i.sell_price != null)
                    .sort((a, b) => new Date(b.sold_at ?? b.updated_at).getTime() - new Date(a.sold_at ?? a.updated_at).getTime())
                    .map((i) => {
                      const base     = +i.buy_price + +(i.grading_cost ?? 0);
                      const profit   = +(i.sell_price ?? 0) - base;
                      const roi      = base > 0 ? (profit / base) * 100 : 0;
                      const holdDays = i.sold_at
                        ? Math.round((new Date(i.sold_at).getTime() - new Date(i.buy_date).getTime()) / 86400000)
                        : null;
                      return (
                        <tr
                          key={i.id}
                          className={`border-b border-gray-800/40 hover:bg-white/[0.04] cursor-pointer ${profit < 0 ? "bg-red-950/10" : ""}`}
                          onClick={() => d({ t: "SET_MODAL", id: i.id })}
                        >
                          <td className="px-3 py-2.5 font-semibold">{i.name}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                            {i.sold_at ? new Date(i.sold_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right">{fmt$(i.buy_price)}</td>
                          <td className="px-3 py-2.5 text-right text-amber-400">{i.grading_cost ? fmt$(i.grading_cost) : "—"}</td>
                          <td className="px-3 py-2.5 text-right text-amber-300 font-medium">{fmt$(base)}</td>
                          <td className="px-3 py-2.5 text-right">{fmt$(i.sell_price!)}</td>
                          <td className={`px-3 py-2.5 text-right font-semibold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {profit >= 0 ? "+" : ""}{fmt$(profit)}
                          </td>
                          <td className={`px-3 py-2.5 text-right ${roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtPct(roi)}</td>
                          <td className="px-3 py-2.5 text-right text-xs text-gray-500">{holdDays != null ? `${holdDays}d` : "—"}</td>
                          <td className="px-3 py-2.5 text-right text-gray-400 text-xs">
                            {s.partners.find((p) => p.id === i.partner_id)?.name ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  {s.items.filter((i) => i.status === "sold").length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-gray-600">
                        <div className="text-2xl mb-2">📈</div>
                        <div>No sold transactions yet</div>
                        <div className="text-xs text-gray-700 mt-1">Mark a card as sold from the Inventory to see ROI here</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ ARENA ══════════════════════════════════════════════════════════ */}
        {s.tab === "arena" && (
          <ArenaTab
            items={s.items}
            arenaA={s.arena.a}
            arenaB={s.arena.b}
            partners={s.partners}
            dispatch={d}
            addToArena={addToArena}
          />
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
              <div className="flex items-center gap-3 mt-3 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span>Searching eBay, TCGPlayer, PSA Registry… (15–30s)</span>
              </div>
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
                  <div className="mt-4 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                      <span className="text-xs text-gray-500 font-medium">Scan Result</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(s.market.result);
                          toast.success("Copied to clipboard");
                        }}
                        className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700"
                      >
                        Copy ⎘
                      </button>
                    </div>
                    <div className="p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                      {s.market.result}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* ── Scan History ─────────────────────────────────────────── */}
            {scanHistory.length > 0 && (
              <div className="mt-4 border-t border-gray-800 pt-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Scans</div>
                <div className="space-y-1.5">
                  {scanHistory.map((h, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        d({ t: "MKT_QUERY", v: h.query });
                        d({ t: "MKT_RESULT", v: h.result });
                        d({ t: "MKT_MODE", v: h.mode as "market" | "arbitrage" });
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 text-xs transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-300 truncate group-hover:text-white">{h.query}</span>
                        <span className="text-gray-600 flex-shrink-0">{new Date(h.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className="text-gray-600 mt-0.5">{h.mode === "market" ? "🔍 Prices" : "⚡ Arbitrage"}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ PARTNERS ═══════════════════════════════════════════════════════ */}
        {s.tab === "partners" && (
          <div className="space-y-4">
            {s.isAdmin && <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
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
            </div>}

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
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportCSV(s.items.filter((i) => i.partner_id === partner.id), s.partners, `${partner.name}.csv`)}
                      title="Standard CSV"
                    >⬇ CSV</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportEbayCSV(s.items.filter((i) => i.partner_id === partner.id), `${partner.name}-ebay.csv`)}
                      title="eBay Bulk Upload CSV"
                    >eBay</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportCardmarketCSV(s.items.filter((i) => i.partner_id === partner.id), `${partner.name}-cm.csv`)}
                      title="Cardmarket CSV"
                    >CM</Button>
                  </div>
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

                {(() => {
                  const partnerItems = s.items.filter((i) => i.partner_id === partner.id);
                  const isExpanded   = expandedPartners.has(partner.id);
                  const PREVIEW      = 4;
                  const displayed    = isExpanded ? partnerItems : partnerItems.slice(0, PREVIEW);
                  return (
                    <>
                      {displayed.map((i) => {
                        const base   = +i.buy_price + +(i.grading_cost ?? 0);
                        const value  = i.status === "sold" ? +(i.sell_price ?? 0) : +(i.market_price ?? i.buy_price);
                        const profit = value - base;
                        return (
                          <div key={i.id} className="flex items-center justify-between py-1.5 border-t border-gray-800 text-sm gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium truncate">{i.name}</span>
                              <StatusBadge status={i.status} />
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-xs text-gray-500">{fmt$(base)}</span>
                              {i.market_price != null && (
                                <span className="text-xs text-blue-400">~{fmt$(i.market_price)}</span>
                              )}
                              <span className={`text-xs font-semibold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {profit >= 0 ? "+" : ""}{fmt$(profit)}
                              </span>
                              <button
                                onClick={() => d({ t: "SET_MODAL", id: i.id })}
                                className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-white transition-colors"
                                title="Detail"
                              >🔍</button>
                            </div>
                          </div>
                        );
                      })}
                      {partnerItems.length > PREVIEW && (
                        <button
                          onClick={() => setExpandedPartners((prev) => {
                            const next = new Set(prev);
                            isExpanded ? next.delete(partner.id) : next.add(partner.id);
                            return next;
                          })}
                          className="w-full text-center py-2 mt-1 text-xs text-gray-500 hover:text-gray-300 border-t border-gray-800 transition-colors"
                        >
                          {isExpanded ? "▲ Show less" : `▼ Show ${partnerItems.length - PREVIEW} more cards`}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            ))}

            {s.partners.length === 0 && (
              <div className="text-center py-16 text-gray-600">
                <div className="text-4xl mb-3">🤝</div>
                <div className="font-semibold mb-1">No portfolios yet</div>
                <div className="text-sm text-gray-700">
                  {s.isAdmin ? "Add the first portfolio above to get started." : "Ask your admin to add you to a portfolio."}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ GRADE ═══════════════════════════════════════════════════════════ */}
        {s.tab === "grade" && (
          <GradingStudio items={s.items} onClose={() => d({ t: "SET_TAB", tab: "brain" })} />
        )}

        {/* ══ ADMIN ═══════════════════════════════════════════════════════════ */}
        {s.tab === "admin" && s.isAdmin && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🔐</span>
              <div>
                <h2 className="font-bold">Admin — Access Control</h2>
                <p className="text-xs text-gray-500">Manage which users can see which portfolios.</p>
              </div>
            </div>
            <AdminPanel partners={s.partners} />
          </div>
        )}

      </div>

      {/* ── Batch bar ────────────────────────────────────────────────────────── */}
      {s.inv.selected.length > 0 && (
        <BatchBar
          count={s.inv.selected.length}
          onStatusUpdate={batchUpdateStatus}
          onPriceUpdate={batchUpdatePrice}
          onAIPriceRefresh={() =>
            setBatchPriceRefreshItems(s.items.filter((i) => s.inv.selected.includes(i.id)))
          }
          onPartnerReassign={batchPartnerReassign}
          onExport={() => exportCSV(s.items.filter((i) => s.inv.selected.includes(i.id)), s.partners)}
          onDelete={batchDelete}
          onClear={() => d({ t: "INV_SEL_CLEAR" })}
        />
      )}

      {/* ── Batch AI price refresh modal ──────────────────────────────────────── */}
      {batchPriceRefreshItems && (
        <BatchPriceRefreshModal
          items={batchPriceRefreshItems}
          onClose={() => setBatchPriceRefreshItems(null)}
        />
      )}

      {/* ── CSV Import modal ──────────────────────────────────────────────────── */}
      {showImportCSV && (
        <ImportCSVModal
          partners={s.partners}
          defaultPartnerId={s.partners[0]?.id ?? ""}
          onImport={executeImportCSV}
          onClose={() => setShowImportCSV(false)}
        />
      )}

      {/* ── Quick-grade overlay (opened from any inventory card/row) ────────── */}
      {gradingForItem && (
        <GradingStudio
          items={s.items}
          initialItem={gradingForItem}
          onClose={() => setGradingForItem(null)}
        />
      )}

      {/* ── Mobile bottom nav ────────────────────────────────────────────────── */}
      <BottomNav tab={s.tab} setTab={(tab) => d({ t: "SET_TAB", tab })} isAdmin={s.isAdmin} />

    </div>
  );
}
