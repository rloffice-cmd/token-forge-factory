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
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, ComposedChart, Line, ReferenceLine } from "recharts";

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
  const [watchlistFilter,     setWatchlistFilter]     = useState(false);
  const [compactTable,        setCompactTable]        = useState(false);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "/" || e.key === "s") {
        e.preventDefault();
        d({ t: "SET_TAB", tab: "inventory" });
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === "n") {
        d({ t: "SET_TAB", tab: "inventory" });
        d({ t: "INV_FORM_SHOW", show: true });
      } else if (e.key === "Escape") {
        if (s.modal) d({ t: "SET_MODAL", id: null });
        else if (s.inv.showForm) d({ t: "INV_FORM_SHOW", show: false });
      } else if (e.key === "b") {
        d({ t: "SET_TAB", tab: "brain" });
      } else if (e.key === "r") {
        d({ t: "SET_TAB", tab: "roi" });
      } else if (e.key === "m") {
        d({ t: "SET_TAB", tab: "market" });
      } else if (e.key === "t") {
        if (s.tab === "inventory") d({ t: "SET_VIEW", mode: s.viewMode === "table" ? "cards" : "table" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.inv.showForm, s.modal, s.tab, s.viewMode]);

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
    const sorted = [...map.entries()]
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([month, data]) => ({ month, ...data, ma3: null as number | null }));
    // Compute 3-month moving average for profit
    for (let i = 2; i < sorted.length; i++) {
      sorted[i].ma3 = (sorted[i - 2].profit + sorted[i - 1].profit + sorted[i].profit) / 3;
    }
    return sorted;
  }, [s.items]);

  // Quarterly performance: profit and sales count per calendar quarter
  const quarterlyPerformance = useMemo(() => {
    const map = new Map<string, { profit: number; count: number }>();
    s.items.filter(i => i.status === "sold" && i.sell_price != null && i.sold_at).forEach(i => {
      const dt = new Date(i.sold_at!);
      const q = `Q${Math.ceil((dt.getMonth() + 1) / 3)} ${dt.getFullYear()}`;
      const cost = +i.buy_price + +(i.grading_cost ?? 0);
      const profit = +(i.sell_price!) - cost;
      const entry = map.get(q) ?? { profit: 0, count: 0 };
      map.set(q, { profit: entry.profit + profit, count: entry.count + 1 });
    });
    return [...map.entries()]
      .sort(([a], [b]) => {
        const [qa, ya] = a.split(" "), [qb, yb] = b.split(" ");
        return +ya !== +yb ? +ya - +yb : +qa[1] - +qb[1];
      })
      .map(([quarter, { profit, count }]) => ({ quarter, profit, count }));
  }, [s.items]);

  // Cumulative P&L: running total of realized profit sorted by sold_at date
  const cumulativePnL = useMemo(() => {
    const sold = s.items
      .filter(i => i.status === "sold" && i.sell_price != null && i.sold_at)
      .sort((a, b) => new Date(a.sold_at!).getTime() - new Date(b.sold_at!).getTime());
    if (sold.length < 2) return [];
    let running = 0;
    return sold.map(i => {
      const cost = +i.buy_price + +(i.grading_cost ?? 0);
      running += +(i.sell_price!) - cost;
      return {
        date: new Date(i.sold_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        cumulative: running,
      };
    });
  }, [s.items]);

  // Annual profit projection: extrapolate from trailing 90-day profit
  const annualProjection = useMemo(() => {
    const now = Date.now();
    const since90d = now - 90 * 86400000;
    const recent = s.items
      .filter(i => i.status === "sold" && i.sell_price != null && i.sold_at && new Date(i.sold_at).getTime() >= since90d);
    if (recent.length < 2) return null;
    const profit90d = recent.reduce((acc, i) => {
      const cost = +i.buy_price + +(i.grading_cost ?? 0);
      return acc + +(i.sell_price!) - cost;
    }, 0);
    const projAnnual = (profit90d / 90) * 365;
    return { recent90d: profit90d, projAnnual, salesIn90d: recent.length };
  }, [s.items]);

  // New this week: items bought in the last 7 days
  const newThisWeek = useMemo(() =>
    s.items
      .filter(i => (Date.now() - new Date(i.buy_date).getTime()) < 7 * 86400000)
      .sort((a, b) => new Date(b.buy_date).getTime() - new Date(a.buy_date).getTime()),
  [s.items]);

  // Purchase frequency: items bought per month (for velocity/trend insight)
  const purchaseFrequency = useMemo(() => {
    const map = new Map<string, number>();
    s.items.forEach(i => {
      const key = new Date(i.buy_date).toLocaleDateString("en-US", { year: "numeric", month: "short" });
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return [...map.entries()]
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .slice(-8) // last 8 months
      .map(([month, count]) => ({ month, count }));
  }, [s.items]);

  // Sell streak: longest and current consecutive profitable sale runs
  const sellStreak = useMemo(() => {
    const sold = s.items
      .filter(i => i.status === "sold" && i.sell_price != null && i.sold_at)
      .sort((a, b) => new Date(a.sold_at!).getTime() - new Date(b.sold_at!).getTime())
      .map(i => {
        const cost = +i.buy_price + +(i.grading_cost ?? 0);
        return +(i.sell_price!) - cost > 0;
      });
    if (sold.length === 0) return null;
    let current = 0, best = 0, tmp = 0;
    for (let i = 0; i < sold.length; i++) {
      if (sold[i]) { tmp++; best = Math.max(best, tmp); }
      else { tmp = 0; }
    }
    // current streak from end
    for (let i = sold.length - 1; i >= 0; i--) {
      if (sold[i]) current++;
      else break;
    }
    return { current, best, total: sold.length };
  }, [s.items]);

  // Partner P&L comparison data for bar chart
  const partnerPnL = useMemo(() =>
    s.partners
      .map(p => {
        const ps = computeStats(s.items.filter(i => i.partner_id === p.id));
        return { name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name, profit: ps.realisedProfit, roi: ps.roiPct, count: ps.activeCount + ps.gradingCount + ps.soldCount };
      })
      .filter(p => p.count > 0)
      .sort((a, b) => b.profit - a.profit),
  [s.partners, s.items]);

  // Win rate: % of sales that turned a profit
  const winRate = useMemo(() => {
    const sold = s.items.filter(i => i.status === "sold" && i.sell_price != null);
    if (sold.length === 0) return null;
    const wins = sold.filter(i => +(i.sell_price!) > +i.buy_price + +(i.grading_cost ?? 0)).length;
    return { wins, total: sold.length, pct: (wins / sold.length) * 100 };
  }, [s.items]);

  // Monthly profit scoreboard: how many calendar months were profitable vs loss-making
  const monthlyScoreboard = useMemo(() => {
    const map = new Map<string, number>();
    s.items.filter(i => i.status === "sold" && i.sell_price != null && i.sold_at).forEach(i => {
      const key = new Date(i.sold_at!).toLocaleDateString("en-US", { year: "numeric", month: "short" });
      const cost = +i.buy_price + +(i.grading_cost ?? 0);
      map.set(key, (map.get(key) ?? 0) + +(i.sell_price!) - cost);
    });
    const values = [...map.values()];
    if (values.length < 2) return null;
    const green = values.filter(p => p >= 0).length;
    const red = values.filter(p => p < 0).length;
    return { green, red, total: values.length };
  }, [s.items]);

  // This month: sales and purchases since calendar month start
  const thisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const sold = s.items.filter(i => i.status === "sold" && i.sell_price != null && i.sold_at && new Date(i.sold_at).getTime() >= monthStart);
    const bought = s.items.filter(i => new Date(i.buy_date).getTime() >= monthStart).length;
    if (sold.length === 0 && bought === 0) return null;
    const profit = sold.reduce((acc, i) => acc + +(i.sell_price!) - (+i.buy_price + +(i.grading_cost ?? 0)), 0);
    return { sold: sold.length, profit, bought };
  }, [s.items]);

  // Needs re-pricing: active items with a market price not updated in > 30 days
  const needsRepricing = useMemo(() => {
    const now = Date.now();
    return s.items
      .filter(i => i.status === "active" && i.market_price != null)
      .filter(i => Math.round((now - new Date(i.updated_at).getTime()) / 86400000) > 30)
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(0, 6);
  }, [s.items]);

  // Sales velocity: avg days between sales, and days since last sale
  const salesVelocity = useMemo(() => {
    const sold = s.items
      .filter(i => i.status === "sold" && i.sold_at)
      .map(i => new Date(i.sold_at!).getTime())
      .sort((a, b) => a - b);
    if (sold.length < 2) return null;
    const gaps: number[] = [];
    for (let i = 1; i < sold.length; i++) gaps.push((sold[i] - sold[i - 1]) / 86400000);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const daysSinceLast = Math.round((Date.now() - sold[sold.length - 1]) / 86400000);
    return { avgGapDays: Math.round(avgGap), daysSinceLast };
  }, [s.items]);

  // Best sale month by average ROI
  const bestSaleMonth = useMemo(() => {
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const map = new Map<number, { profit: number; cost: number; count: number }>();
    s.items
      .filter(i => i.status === "sold" && i.sell_price != null && i.sold_at)
      .forEach(i => {
        const mo   = new Date(i.sold_at!).getMonth(); // 0-11
        const cost = +i.buy_price + +(i.grading_cost ?? 0);
        const profit = +(i.sell_price!) - cost;
        const entry = map.get(mo) ?? { profit: 0, cost: 0, count: 0 };
        map.set(mo, { profit: entry.profit + profit, cost: entry.cost + cost, count: entry.count + 1 });
      });
    if (map.size === 0) return null;
    const months = [...map.entries()]
      .map(([mo, { profit, cost, count }]) => ({
        month: MONTHS[mo],
        roi: cost > 0 ? (profit / cost) * 100 : 0,
        count,
        profit,
      }))
      .sort((a, b) => b.roi - a.roi);
    return months[0];
  }, [s.items]);

  // Day-of-week ROI: which weekday yields the best realized profit
  const dayOfWeekROI = useMemo(() => {
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const map = new Map<number, { profit: number; cost: number; count: number }>();
    s.items
      .filter(i => i.status === "sold" && i.sell_price != null && i.sold_at)
      .forEach(i => {
        const dow = new Date(i.sold_at!).getDay();
        const cost = +i.buy_price + +(i.grading_cost ?? 0);
        const profit = +(i.sell_price!) - cost;
        const entry = map.get(dow) ?? { profit: 0, cost: 0, count: 0 };
        map.set(dow, { profit: entry.profit + profit, cost: entry.cost + cost, count: entry.count + 1 });
      });
    return DAYS.map((day, idx) => {
      const dow = map.get(idx);
      if (!dow) return { day, profit: 0, count: 0, roi: 0 };
      return { day, profit: dow.profit, count: dow.count, roi: dow.cost > 0 ? (dow.profit / dow.cost) * 100 : 0 };
    });
  }, [s.items]);

  // Hold-time histogram: distribution of hold durations for sold items
  const holdTimeHistogram = useMemo(() => {
    const buckets = [
      { label: "≤30d",    min: 0,   max: 30,       count: 0, profit: 0 },
      { label: "31-60d",  min: 31,  max: 60,        count: 0, profit: 0 },
      { label: "61-90d",  min: 61,  max: 90,        count: 0, profit: 0 },
      { label: "91-180d", min: 91,  max: 180,       count: 0, profit: 0 },
      { label: "180d+",   min: 181, max: Infinity,  count: 0, profit: 0 },
    ];
    s.items
      .filter(i => i.status === "sold" && i.sell_price != null && i.sold_at)
      .forEach(i => {
        const holdDays = Math.round((new Date(i.sold_at!).getTime() - new Date(i.buy_date).getTime()) / 86400000);
        const cost = +i.buy_price + +(i.grading_cost ?? 0);
        const profit = +(i.sell_price!) - cost;
        const bucket = buckets.find(b => holdDays >= b.min && holdDays <= b.max);
        if (bucket) { bucket.count++; bucket.profit += profit; }
      });
    return buckets.filter(b => b.count > 0);
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
        (i.franchise ?? "").toLowerCase().includes(q) ||
        (i.notes ?? "").toLowerCase().includes(q) ||
        (i.condition).toLowerCase().includes(q) ||
        (i.psa_grade != null && `psa ${i.psa_grade}`.includes(q))) &&
      (!s.franchise || !!i.franchise) &&
      (statusFilter === "all" || i.status === statusFilter) &&
      (!franchiseFilterInv || i.franchise === franchiseFilterInv) &&
      (!watchlistFilter || (i.notes ?? "").toLowerCase().includes("[watch]"))
    );
  }, [s.items, s.inv.search, s.franchise, statusFilter, franchiseFilterInv, watchlistFilter]);

  const invFranchises = useMemo(
    () => [...new Set(s.items.map((i) => i.franchise).filter(Boolean) as string[])].sort(),
    [s.items]
  );

  // Grading pipeline: items in grading with days in queue + PSA expected profit
  const gradingPipeline = useMemo(() => {
    const now = Date.now();
    const EST_FEE  = 25;   // fallback PSA fee if grading_cost not set
    const EST_MULT = 2.5;  // conservative PSA 10 premium over raw market price
    return s.items
      .filter(i => i.status === "grading")
      .map(i => {
        const daysIn = Math.round((now - new Date(i.buy_date).getTime()) / 86400000);
        const cost   = +i.buy_price + +(i.grading_cost ?? EST_FEE);
        const psaEstValue  = i.market_price != null ? i.market_price * EST_MULT : null;
        const psaEstProfit = psaEstValue != null ? psaEstValue - cost : null;
        return { item: i, daysIn, cost, isStale: daysIn > 60, psaEstValue, psaEstProfit };
      })
      .sort((a, b) => b.daysIn - a.daysIn);
  }, [s.items]);

  // Per-franchise realized ROI (sold items only)
  const franchiseROI = useMemo(() => {
    const map = new Map<string, { profit: number; cost: number; count: number }>();
    s.items
      .filter(i => i.status === "sold" && i.sell_price != null)
      .forEach(i => {
        const key    = i.franchise ?? "Other";
        const cost   = +i.buy_price + +(i.grading_cost ?? 0);
        const profit = +(i.sell_price!) - cost;
        const entry  = map.get(key) ?? { profit: 0, cost: 0, count: 0 };
        map.set(key, { profit: entry.profit + profit, cost: entry.cost + cost, count: entry.count + 1 });
      });
    return [...map.entries()]
      .map(([name, { profit, cost, count }]) => ({
        name, profit, count,
        roi: cost > 0 ? (profit / cost) * 100 : 0,
      }))
      .sort((a, b) => b.roi - a.roi);
  }, [s.items]);

  // Cost composition: buy vs grading split across all items
  const costComposition = useMemo(() => {
    const totalBuy     = s.items.reduce((acc, i) => acc + +i.buy_price, 0);
    const totalGrading = s.items.reduce((acc, i) => acc + +(i.grading_cost ?? 0), 0);
    const total        = totalBuy + totalGrading;
    const gradedItems  = s.items.filter(i => +(i.grading_cost ?? 0) > 0);
    return {
      total, totalBuy, totalGrading,
      buyPct:     total > 0 ? (totalBuy     / total) * 100 : 100,
      gradingPct: total > 0 ? (totalGrading / total) * 100 : 0,
      avgBuy:     s.items.length > 0 ? totalBuy / s.items.length : 0,
      avgGrading: gradedItems.length > 0 ? totalGrading / gradedItems.length : 0,
      gradedCount: gradedItems.length,
    };
  }, [s.items]);

  // Buy-price distribution buckets
  const priceDistribution = useMemo(() => {
    const BUCKETS = [
      { label: "< $10",    min: 0,   max: 10  },
      { label: "$10–50",   min: 10,  max: 50  },
      { label: "$50–200",  min: 50,  max: 200 },
      { label: "$200+",    min: 200, max: Infinity },
    ];
    const maxCount = Math.max(1, ...BUCKETS.map(b =>
      s.items.filter(i => +i.buy_price >= b.min && +i.buy_price < b.max).length
    ));
    return BUCKETS.map(b => {
      const items = s.items.filter(i => +i.buy_price >= b.min && +i.buy_price < b.max);
      return { label: b.label, count: items.length, pct: (items.length / maxCount) * 100 };
    });
  }, [s.items]);

  // Recent activity feed — last 8 changes sorted by updated_at
  const recentActivity = useMemo(() => {
    return [...s.items]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8)
      .map(i => {
        const isNew       = new Date(i.created_at).getTime() === new Date(i.updated_at).getTime();
        const isSold      = i.status === "sold";
        const isGrading   = i.status === "grading";
        const cost        = +i.buy_price + +(i.grading_cost ?? 0);
        const profit      = isSold && i.sell_price != null ? +(i.sell_price) - cost : null;
        const hoursAgo    = (Date.now() - new Date(i.updated_at).getTime()) / 3600000;
        const timeLabel   = hoursAgo < 1 ? "just now"
          : hoursAgo < 24 ? `${Math.round(hoursAgo)}h ago`
          : `${Math.round(hoursAgo / 24)}d ago`;
        const badge       = isNew ? "Added" : isSold ? "Sold" : isGrading ? "→ Grading" : "Updated";
        const badgeCls    = isNew ? "bg-blue-900/60 text-blue-300"
          : isSold ? "bg-emerald-900/60 text-emerald-300"
          : isGrading ? "bg-amber-900/60 text-amber-300"
          : "bg-gray-800 text-gray-400";
        return { item: i, profit, timeLabel, badge, badgeCls };
      });
  }, [s.items]);

  const holdTimeBreakdown = useMemo(() => {
    const BUCKETS = [
      { label: "< 30d",   min: 0,   max: 30   },
      { label: "1–3 mo",  min: 30,  max: 90   },
      { label: "3–6 mo",  min: 90,  max: 180  },
      { label: "6–12 mo", min: 180, max: 365  },
      { label: "1y+",     min: 365, max: Infinity },
    ];
    const sold = s.items.filter(i => i.status === "sold" && i.sell_price != null && i.sold_at);
    return BUCKETS.map(b => {
      const items = sold.filter(i => {
        const days = (new Date(i.sold_at!).getTime() - new Date(i.buy_date).getTime()) / 86400000;
        return days >= b.min && days < b.max;
      });
      const totalProfit = items.reduce((acc, i) => {
        return acc + (+(i.sell_price!) - +i.buy_price - +(i.grading_cost ?? 0));
      }, 0);
      return { label: b.label, count: items.length, avgProfit: items.length > 0 ? totalProfit / items.length : 0 };
    }).filter(b => b.count > 0);
  }, [s.items]);

  // Condition ROI: realized ROI grouped by condition (raw sold cards only)
  const conditionROI = useMemo(() => {
    const ORDER = ["M", "NM", "LP", "MP", "HP", "D"];
    const map = new Map<string, { profit: number; cost: number; count: number }>();
    s.items
      .filter(i => i.status === "sold" && i.sell_price != null && !i.psa_grade)
      .forEach(i => {
        const key    = i.condition;
        const cost   = +i.buy_price + +(i.grading_cost ?? 0);
        const profit = +(i.sell_price!) - cost;
        const entry  = map.get(key) ?? { profit: 0, cost: 0, count: 0 };
        map.set(key, { profit: entry.profit + profit, cost: entry.cost + cost, count: entry.count + 1 });
      });
    return ORDER
      .filter(c => map.has(c))
      .map(c => {
        const { profit, cost, count } = map.get(c)!;
        return { condition: c, profit, count, roi: cost > 0 ? (profit / cost) * 100 : 0 };
      });
  }, [s.items]);

  // Action Required: items needing attention, sorted high→medium priority
  const actionItems = useMemo(() => {
    const now = Date.now();
    const actions: Array<{
      priority: "high" | "medium";
      action: string;
      item: CollectionItem;
      detail: string;
      tab?: Tab;
      query?: string;
    }> = [];
    s.items.forEach(i => {
      if (i.status === "sold") return;
      const ageDays = Math.round((now - new Date(i.buy_date).getTime()) / 86400000);
      const cost = +i.buy_price + +(i.grading_cost ?? 0);
      // High: stale grading (>60d)
      if (i.status === "grading" && ageDays > 60) {
        actions.push({ priority: "high", action: "Check grading status", item: i, detail: `${ageDays}d in queue` });
      }
      // High: big upside + long hold — strong sell candidate
      if (i.status === "active" && i.market_price != null && i.market_price > cost * 2 && ageDays > 60) {
        const profit = i.market_price - cost;
        actions.push({ priority: "high", action: "Consider selling", item: i, detail: `${ageDays}d hold · +${fmt$(profit)} est.` });
      }
      // Medium: expensive card with no price
      if (i.status === "active" && i.market_price == null && cost >= 20) {
        const q = `What is the current market price of "${i.name}"${i.card_set ? ` from ${i.card_set}` : ""} ${i.condition} TCG card? Search eBay sold listings.`;
        actions.push({ priority: "medium", action: "Price missing", item: i, detail: `Cost: ${fmt$(cost)}`, tab: "market", query: q });
      }
      // Medium: underwater item held >90d
      if (i.status === "active" && ageDays > 90 && i.market_price != null && i.market_price < cost) {
        actions.push({ priority: "medium", action: "Underwater >90d", item: i, detail: `${ageDays}d · mkt ${fmt$(i.market_price)} < cost ${fmt$(cost)}` });
      }
    });
    return actions
      .sort((a, b) => (a.priority === "high" ? 0 : 1) - (b.priority === "high" ? 0 : 1))
      .slice(0, 8);
  }, [s.items]);

  // Card set ROI: realized ROI grouped by card_set (sold items)
  const cardSetROI = useMemo(() => {
    const map = new Map<string, { profit: number; cost: number; count: number }>();
    s.items
      .filter(i => i.status === "sold" && i.sell_price != null && i.card_set)
      .forEach(i => {
        const key    = i.card_set!;
        const cost   = +i.buy_price + +(i.grading_cost ?? 0);
        const profit = +(i.sell_price!) - cost;
        const entry  = map.get(key) ?? { profit: 0, cost: 0, count: 0 };
        map.set(key, { profit: entry.profit + profit, cost: entry.cost + cost, count: entry.count + 1 });
      });
    return [...map.entries()]
      .map(([name, { profit, cost, count }]) => ({
        name, profit, count,
        roi: cost > 0 ? (profit / cost) * 100 : 0,
      }))
      .filter(x => x.count >= 2) // only sets with ≥2 sales (enough data)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 8);
  }, [s.items]);

  // Watchlist: items tagged with [watch] in notes
  const watchlistItems = useMemo(() =>
    s.items.filter(i => i.status !== "sold" && (i.notes ?? "").toLowerCase().includes("[watch]")),
  [s.items]);

  // Sell score: composite 0-100 score for active items — higher = stronger sell signal
  const sellScores = useMemo(() => {
    const now = Date.now();
    return s.items
      .filter(i => i.status === "active" && i.market_price != null && +i.buy_price > 0)
      .map(i => {
        const cost    = +i.buy_price + +(i.grading_cost ?? 0);
        const mkt     = i.market_price!;
        const ageDays = Math.round((now - new Date(i.buy_date).getTime()) / 86400000);
        const roi     = (mkt - cost) / cost;

        // 5 factors, each 0-20 pts
        // 1. ROI magnitude: 20 pts for roi ≥ 100%, scaled linearly
        const roiScore    = Math.min(20, Math.max(0, roi * 20));
        // 2. Hold time: 20 pts for >90d, 10 pts for >30d, 0 for <30d
        const ageScore    = ageDays > 90 ? 20 : ageDays > 30 ? 10 : 0;
        // 3. Upside multiple: 20 pts for mkt/cost ≥ 3, scaled
        const multScore   = Math.min(20, Math.max(0, ((mkt / cost) - 1) * 10));
        // 4. Condition bonus: NM/M cards sell easier
        const condScore   = ["M", "NM"].includes(i.condition) ? 20 : ["LP"].includes(i.condition) ? 10 : 0;
        // 5. Franchise popularity (Pokemon/One Piece sell fastest)
        const franScore   = i.franchise?.toLowerCase().includes("pokemon") || i.franchise?.toLowerCase().includes("one piece") ? 20 : 10;

        const total = Math.round(roiScore + ageScore + multScore + condScore + franScore);
        return { item: i, score: Math.min(100, total), cost, mkt, roi, ageDays };
      })
      .filter(x => x.score >= 40 && x.roi > 0) // only genuine opportunities
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [s.items]);

  // Concentration risk: top items by portfolio weight
  const concentrationRisk = useMemo(() => {
    const active = s.items.filter(i => i.status === "active");
    const totalVal = active.reduce((acc, i) => acc + (i.market_price ?? +i.buy_price), 0);
    if (totalVal <= 0 || active.length < 3) return [];
    return active
      .map(i => {
        const val = i.market_price ?? +i.buy_price;
        return { item: i, val, pct: (val / totalVal) * 100 };
      })
      .filter(x => x.pct >= 5) // only items that are ≥5% of portfolio
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [s.items]);

  // Franchise breakdown: active portfolio distribution + realized profit per franchise
  const franchiseBreakdown = useMemo(() => {
    const map = new Map<string, { cost: number; value: number; count: number; sold: number; profit: number }>();
    s.items.filter(i => i.status !== "sold").forEach(i => {
      const key = i.franchise ?? "Other";
      const cost = +i.buy_price + +(i.grading_cost ?? 0);
      const val = i.market_price ?? +i.buy_price;
      const entry = map.get(key) ?? { cost: 0, value: 0, count: 0, sold: 0, profit: 0 };
      map.set(key, { ...entry, cost: entry.cost + cost, value: entry.value + val, count: entry.count + 1 });
    });
    s.items.filter(i => i.status === "sold" && i.sell_price != null).forEach(i => {
      const key = i.franchise ?? "Other";
      const cost = +i.buy_price + +(i.grading_cost ?? 0);
      const profit = +(i.sell_price!) - cost;
      const entry = map.get(key) ?? { cost: 0, value: 0, count: 0, sold: 0, profit: 0 };
      map.set(key, { ...entry, sold: entry.sold + 1, profit: entry.profit + profit });
    });
    return [...map.entries()]
      .map(([name, data]) => ({
        name: name.length > 14 ? name.slice(0, 13) + "…" : name,
        fullName: name,
        cost: data.cost, value: data.value, count: data.count, sold: data.sold, profit: data.profit,
        pnl: data.value - data.cost,
      }))
      .filter(x => x.count > 0 || x.sold > 0)
      .sort((a, b) => b.count - a.count);
  }, [s.items]);

  // Quick-flip detector: sold items held ≤30 days with profit
  const quickFlips = useMemo(() =>
    s.items
      .filter(i => i.status === "sold" && i.sell_price != null && i.sold_at)
      .map(i => {
        const holdDays = Math.round((new Date(i.sold_at!).getTime() - new Date(i.buy_date).getTime()) / 86400000);
        const cost = +i.buy_price + +(i.grading_cost ?? 0);
        const profit = +(i.sell_price!) - cost;
        return { item: i, holdDays, cost, profit, roi: cost > 0 ? (profit / cost) * 100 : 0 };
      })
      .filter(x => x.holdDays <= 30 && x.profit > 0)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 5),
  [s.items]);

  // Profit-per-hold-day: capital efficiency across all sold items
  const profitPerDay = useMemo(() => {
    const sold = s.items.filter(i => i.status === "sold" && i.sell_price != null && i.sold_at && i.buy_date);
    if (sold.length === 0) return null;
    const totalProfit = sold.reduce((acc, i) => acc + +(i.sell_price!) - (+i.buy_price + +(i.grading_cost ?? 0)), 0);
    const totalDays = sold.reduce((acc, i) => {
      const holdDays = Math.round((new Date(i.sold_at!).getTime() - new Date(i.buy_date).getTime()) / 86400000);
      return acc + Math.max(1, holdDays);
    }, 0);
    return totalDays > 0 ? totalProfit / totalDays : null;
  }, [s.items]);

  // Inventory aging: active/grading items bucketed by age (capital tied up in each bucket)
  const inventoryAging = useMemo(() => {
    const now = Date.now();
    const buckets = [
      { label: "Fresh (≤30d)",    min: 0,   max: 30,       count: 0, cost: 0, cls: "bg-emerald-600/70" as const },
      { label: "Active (31-90d)", min: 31,  max: 90,        count: 0, cost: 0, cls: "bg-blue-600/70" as const },
      { label: "Stale (91-180d)", min: 91,  max: 180,       count: 0, cost: 0, cls: "bg-amber-600/70" as const },
      { label: "Old (180d+)",     min: 181, max: Infinity,  count: 0, cost: 0, cls: "bg-red-600/70" as const },
    ];
    s.items.filter(i => i.status !== "sold").forEach(i => {
      const ageDays = Math.round((now - new Date(i.buy_date).getTime()) / 86400000);
      const cost = +i.buy_price + +(i.grading_cost ?? 0);
      const bucket = buckets.find(b => ageDays >= b.min && ageDays <= b.max);
      if (bucket) { bucket.count++; bucket.cost += cost; }
    });
    return buckets.filter(b => b.count > 0);
  }, [s.items]);

  // Underwater items: active items where market_price < cost (currently losing)
  const underwaterItems = useMemo(() =>
    s.items
      .filter(i => i.status === "active" && i.market_price != null)
      .map(i => {
        const cost = +i.buy_price + +(i.grading_cost ?? 0);
        const loss = i.market_price! - cost;
        const ageDays = Math.round((Date.now() - new Date(i.buy_date).getTime()) / 86400000);
        return { item: i, cost, loss, ageDays, lossRatio: cost > 0 ? loss / cost : 0 };
      })
      .filter(x => x.loss < 0)
      .sort((a, b) => a.loss - b.loss)
      .slice(0, 5),
  [s.items]);

  // ROI distribution: sold items bucketed by realized ROI range
  const roiDistribution = useMemo(() => {
    const buckets = [
      { label: "< 0%",    min: -Infinity, max: 0,        count: 0 },
      { label: "0–25%",   min: 0,         max: 25,       count: 0 },
      { label: "25–50%",  min: 25,        max: 50,       count: 0 },
      { label: "50–100%", min: 50,        max: 100,      count: 0 },
      { label: "100%+",   min: 100,       max: Infinity, count: 0 },
    ];
    s.items.filter(i => i.status === "sold" && i.sell_price != null).forEach(i => {
      const cost = +i.buy_price + +(i.grading_cost ?? 0);
      const roi = cost > 0 ? ((+(i.sell_price!) - cost) / cost) * 100 : 0;
      const bucket = buckets.find(b => roi >= b.min && roi < b.max);
      if (bucket) bucket.count++;
    });
    return buckets;
  }, [s.items]);

  // PSA vs Raw ROI: compare realized ROI between PSA-graded and raw sold items
  const psaVsRaw = useMemo(() => {
    const calc = (items: CollectionItem[]) => {
      if (items.length === 0) return null;
      const profit = items.reduce((acc, i) => acc + +(i.sell_price!) - (+i.buy_price + +(i.grading_cost ?? 0)), 0);
      const cost   = items.reduce((acc, i) => acc + +i.buy_price + +(i.grading_cost ?? 0), 0);
      return { count: items.length, profit, roi: cost > 0 ? (profit / cost) * 100 : 0 };
    };
    const sold = s.items.filter(i => i.status === "sold" && i.sell_price != null);
    const psa  = calc(sold.filter(i => i.psa_grade != null));
    const raw  = calc(sold.filter(i => i.psa_grade == null));
    if (!psa || !raw) return null;
    return { psa, raw };
  }, [s.items]);

  // Breakout cards: active items with unrealised gain ≥100% (2× or better)
  const breakoutCards = useMemo(() =>
    s.items
      .filter(i => i.status !== "sold" && i.market_price != null)
      .map(i => {
        const cost    = +i.buy_price + +(i.grading_cost ?? 0);
        const gain    = i.market_price! - cost;
        const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
        return { item: i, cost, gain, gainPct };
      })
      .filter(x => x.gainPct >= 100)
      .sort((a, b) => b.gainPct - a.gainPct)
      .slice(0, 5),
  [s.items]);

  // Flip-speed leaderboard: avg hold days per franchise (franchises with ≥2 sales)
  const flipSpeedByFranchise = useMemo(() => {
    const map = new Map<string, { totalDays: number; count: number; profit: number }>();
    s.items
      .filter(i => i.status === "sold" && i.sell_price != null && i.sold_at)
      .forEach(i => {
        const key = i.franchise ?? "Other";
        const holdDays = Math.round((new Date(i.sold_at!).getTime() - new Date(i.buy_date).getTime()) / 86400000);
        const cost = +i.buy_price + +(i.grading_cost ?? 0);
        const profit = +(i.sell_price!) - cost;
        const entry = map.get(key) ?? { totalDays: 0, count: 0, profit: 0 };
        map.set(key, { totalDays: entry.totalDays + holdDays, count: entry.count + 1, profit: entry.profit + profit });
      });
    return [...map.entries()]
      .filter(([, v]) => v.count >= 2)
      .map(([name, v]) => ({
        name: name.length > 16 ? name.slice(0, 15) + "…" : name,
        avgHold: Math.round(v.totalDays / v.count),
        count: v.count,
        profit: v.profit,
      }))
      .sort((a, b) => a.avgHold - b.avgHold);
  }, [s.items]);

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
    // Compute unrealised P&L for sorting purposes
    const pnl = (i: CollectionItem) => {
      const c = +i.buy_price + +(i.grading_cost ?? 0);
      if (i.status === "sold") return +(i.sell_price ?? 0) - c;
      return (i.market_price ?? +i.buy_price) - c;
    };
    const age = (i: CollectionItem) => new Date(i.buy_date).getTime();
    arr.sort((a, b) => {
      let cmp = 0;
      if ((field as string) === "__pnl__") {
        cmp = pnl(a) - pnl(b);
      } else if ((field as string) === "__age__") {
        cmp = age(a) - age(b); // older items have smaller timestamps = lower value
      } else {
        const av = a[field] ?? "";
        const bv = b[field] ?? "";
        cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "he");
      }
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

  const duplicateItem = useCallback((item: CollectionItem) => {
    d({
      t: "INV_FORM_EDIT",
      id: null, // new item
      form: {
        name: `${item.name} (copy)`,
        card_set: item.card_set ?? "",
        franchise: item.franchise ?? "",
        condition: item.condition,
        buy_price: String(item.buy_price),
        grading_cost: String(item.grading_cost ?? 0),
        market_price: item.market_price != null ? String(item.market_price) : "",
        sell_price: "",
        sold_at: "",
        buy_date: today(),
        status: "active",
        partner_id: item.partner_id,
        notes: item.notes ?? "",
        image_url: item.image_url ?? "",
        psa_grade: "",
      },
    });
    toast.success(`Duplicated "${item.name}" — edit and save to add`);
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

  const quickStatusChange = useCallback(async (item: CollectionItem, newStatus: ItemStatus) => {
    d({ t: "RT_ITEM", event: "UPDATE", item: { ...item, status: newStatus, updated_at: new Date().toISOString() } });
    const { error } = await supabase.from("coll_items").update({ status: newStatus }).eq("id", item.id);
    if (error) {
      d({ t: "RT_ITEM", event: "UPDATE", item }); // rollback
      toast.error(error.message);
    } else {
      const labels: Record<ItemStatus, string> = { active: "Active", grading: "Grading", sold: "Sold" };
      toast.success(`${item.name} → ${labels[newStatus]}`);
    }
  }, []);

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
          <button
            onClick={() => {
              const health = portfolioHealth ? `${portfolioHealth.grade} (${portfolioHealth.total}/100)` : "N/A";
              const text = [
                "📊 CollectPro Portfolio Summary",
                "─".repeat(32),
                `Total Invested:    ${fmt$(stats.totalCost)}`,
                `Active Mkt Est.:   ${fmt$(stats.estimatedValue)} (estimate)`,
                `Unrealized P&L:    ${stats.unrealisedPnL >= 0 ? "+" : ""}${fmt$(stats.unrealisedPnL)}`,
                `Realized Profit:   ${stats.realisedProfit >= 0 ? "+" : ""}${fmt$(stats.realisedProfit)} (${fmtPct(stats.roiPct)} ROI)`,
                `Sales:             ${stats.soldCount} transactions`,
                `Portfolio Health:  ${health}`,
                `Cards:             ${s.items.length} total (${s.items.filter(i => i.status === "active").length} active)`,
                "─".repeat(32),
                `Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
              ].join("\n");
              navigator.clipboard.writeText(text);
              toast.success("Portfolio summary copied to clipboard");
            }}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-500 hover:text-gray-300 hover:border-white/20 transition-colors text-xs flex flex-col items-center justify-center gap-1 min-w-[52px]"
            title="Copy portfolio summary to clipboard"
          >
            <span className="text-base">⎘</span>
            <span>Share</span>
          </button>
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
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
                s.tab === tab
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-500 hover:text-gray-200"
              }`}
            >
              {labels[tab]}
              {tab === "brain" && actionItems.filter(a => a.priority === "high").length > 0 && (
                <span className="absolute top-1.5 right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {actionItems.filter(a => a.priority === "high").length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-3 py-4 pb-20 md:pb-5">

        {/* ══ BRAIN ══════════════════════════════════════════════════════════ */}
        {s.tab === "brain" && (
          <div className="space-y-3">

            {/* ── Portfolio Snapshot ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Active", value: stats.activeCount.toString(), cls: "text-blue-400", sub: `${fmt$(stats.estimatedValue)} market` },
                { label: "Grading", value: stats.gradingCount.toString(), cls: "text-amber-400", sub: `${fmt$(stats.totalCost - stats.realisedRevenue + stats.realisedRevenue === 0 ? 0 : 0)} invested` },
                { label: "Sold", value: stats.soldCount.toString(), cls: stats.realisedProfit >= 0 ? "text-emerald-400" : "text-red-400", sub: `${fmt$(stats.realisedProfit)} profit` },
                { label: "Portfolio", value: fmtPct(stats.roiPct), cls: stats.roiPct >= 0 ? "text-emerald-400" : "text-red-400", sub: `${fmt$(stats.totalCost)} invested` },
                ...(thisMonth ? [{ label: "This Month", value: `${fmt$(thisMonth.profit)}`, cls: thisMonth.profit >= 0 ? "text-emerald-400" : "text-red-400", sub: `${thisMonth.sold} sold · ${thisMonth.bought} bought` }] : []),
              ].map(({ label, value, cls, sub }) => (
                <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5">
                  <div className="text-xs text-gray-500 mb-0.5">{label}</div>
                  <div className={`text-base font-bold ${cls}`}>{value}</div>
                  <div className="text-xs text-gray-700 truncate">{sub}</div>
                </div>
              ))}
            </div>

            {/* ── Quick-Action Toolbar ──────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: "📦 Inventory",
                  action: () => d({ t: "SET_TAB", tab: "inventory" }),
                  badge: s.items.filter(i => i.status === "active").length.toString(),
                },
                {
                  label: "📈 ROI",
                  action: () => d({ t: "SET_TAB", tab: "roi" }),
                  badge: null,
                },
                {
                  label: "🌐 Market Scan",
                  action: () => d({ t: "SET_TAB", tab: "market" }),
                  badge: s.items.filter(i => i.status === "active" && i.market_price == null).length > 0
                    ? `${s.items.filter(i => i.status === "active" && i.market_price == null).length} unpriced`
                    : null,
                },
                {
                  label: "⬇ Export CSV",
                  action: () => exportCSV(s.items, s.partners),
                  badge: null,
                },
              ].map(({ label, action, badge }) => (
                <button
                  key={label}
                  onClick={action}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs border border-gray-700 hover:border-gray-500 transition-colors flex items-center gap-1.5"
                >
                  {label}
                  {badge && <span className="text-amber-400 text-xs">{badge}</span>}
                </button>
              ))}
            </div>

            {/* ── New This Week ─────────────────────────────────────────────────── */}
            {newThisWeek.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>🆕 New This Week</span>
                  <span className="text-xs font-normal normal-case text-gray-600">{newThisWeek.length} item{newThisWeek.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-1.5">
                  {newThisWeek.map(item => {
                    const cost = +item.buy_price + +(item.grading_cost ?? 0);
                    const ageDays = Math.round((Date.now() - new Date(item.buy_date).getTime()) / 86400000);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => d({ t: "SET_MODAL", id: item.id })}
                        className="w-full flex items-center gap-3 py-1.5 px-3 bg-gray-800/40 rounded-lg hover:bg-gray-800 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.condition}{item.card_set ? ` · ${item.card_set}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-amber-400">{fmt$(cost)}</span>
                          <span className="text-xs text-gray-700">{ageDays === 0 ? "today" : `${ageDays}d ago`}</span>
                          {item.market_price == null && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const q = `What is the current market price of "${item.name}"${item.card_set ? ` from ${item.card_set}` : ""} ${item.condition} TCG card? Search eBay sold listings.`;
                                d({ t: "SET_TAB", tab: "market" });
                                d({ t: "MKT_QUERY", v: q });
                              }}
                              className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 hover:bg-blue-800 transition-colors"
                              title="Quick price scan"
                            >Scan</button>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Next Action Banner ────────────────────────────────────────────── */}
            {(() => {
              // Determine single most important action for the user right now
              const highAction = actionItems[0];
              if (!highAction && sellScores.length === 0 && s.items.filter(i => i.status === "active" && i.market_price == null).length === 0) return null;
              let msg = "";
              let color = "from-blue-900/60 to-indigo-900/60 border-blue-700/40 text-blue-200";
              let onClick: (() => void) | null = null;
              if (highAction?.priority === "high") {
                msg = `⚡ ${highAction.action}: "${highAction.item.name}" · ${highAction.detail}`;
                color = "from-red-900/50 to-rose-900/50 border-red-700/40 text-red-200";
                onClick = () => d({ t: "SET_MODAL", id: highAction.item.id });
              } else if (sellScores.length > 0) {
                const top = sellScores[0];
                msg = `💰 Strong sell candidate: "${top.item.name}" — score ${top.score}/100, ${top.ageDays}d hold, ${fmtPct(top.roi * 100)} ROI`;
                color = "from-emerald-900/50 to-teal-900/50 border-emerald-700/40 text-emerald-200";
                onClick = () => d({ t: "SET_MODAL", id: top.item.id });
              } else if (actionItems[0]) {
                msg = `💡 ${actionItems[0].action}: "${actionItems[0].item.name}" · ${actionItems[0].detail}`;
                onClick = () => d({ t: "SET_MODAL", id: actionItems[0].item.id });
              }
              if (!msg) return null;
              return (
                <button
                  type="button"
                  onClick={onClick ?? undefined}
                  className={`w-full text-left px-4 py-3 rounded-xl bg-gradient-to-r ${color} border text-sm font-medium leading-snug transition-opacity hover:opacity-90`}
                >
                  {msg}
                </button>
              );
            })()}

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
                    <div key={item.id} className="flex items-center justify-between gap-3 py-1.5 px-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
                      <button
                        type="button"
                        onClick={() => d({ t: "SET_MODAL", id: item.id })}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      >
                        <span className="text-gray-600 text-xs w-4 text-center flex-shrink-0">{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.condition}{item.psa_grade ? ` · PSA ${item.psa_grade}` : ""}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-emerald-400">+{fmt$(profit)}</span>
                        <span className="text-sm font-bold text-emerald-400">{upside.toFixed(2)}×</span>
                        <button
                          onClick={() => markSold(item)}
                          className="text-xs px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800 transition-colors"
                          title="Mark sold"
                        >✓ Sell</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Sell Score ───────────────────────────────────────────────────── */}
            {sellScores.length > 0 && (
              <div className="bg-gray-900 border border-emerald-800/30 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>💰 Top Sell Candidates</span>
                  <span className="text-xs font-normal normal-case text-gray-600">composite score: ROI + age + upside + condition</span>
                </div>
                <div className="space-y-2">
                  {sellScores.map(({ item, score, cost, mkt, roi, ageDays }) => {
                    const profit = mkt - cost;
                    const scoreColor = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-blue-400" : "text-gray-400";
                    const barColor   = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-blue-500" : "bg-gray-600";
                    return (
                      <div key={item.id} className="flex items-center gap-3 py-1.5 px-3 bg-gray-800/50 rounded-lg">
                        <button
                          type="button"
                          onClick={() => d({ t: "SET_MODAL", id: item.id })}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-sm font-medium truncate">{item.name}</span>
                            <span className={`text-xs font-bold ml-2 flex-shrink-0 ${scoreColor}`}>{score}</span>
                          </div>
                          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {ageDays}d · cost {fmt$(cost)} · mkt {fmt$(mkt)} · {roi >= 0 ? "+" : ""}{fmtPct(roi * 100)}
                          </p>
                        </button>
                        <button
                          onClick={() => markSold(item)}
                          className="text-xs px-2 py-1 rounded bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800 transition-colors flex-shrink-0"
                          title="Mark sold"
                        >✓ Sell</button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-700 mt-2">Score = ROI 20 + hold time 20 + upside multiple 20 + condition 20 + franchise 20. Higher = stronger sell signal.</p>
              </div>
            )}

            {/* ── Breakout Cards ───────────────────────────────────────────────── */}
            {breakoutCards.length > 0 && (
              <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>🚀 Breakout Cards</span>
                  <span className="text-xs font-normal normal-case text-gray-600">unrealised gain ≥100%</span>
                </div>
                <div className="space-y-1.5">
                  {breakoutCards.map(({ item, cost, gain, gainPct }) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => d({ t: "SET_MODAL", id: item.id })}
                      className="w-full flex items-center gap-3 py-1.5 px-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.condition}{item.card_set ? ` · ${item.card_set}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                        <span className="text-gray-500">{fmt$(cost)}</span>
                        <span className="text-emerald-400">→ {fmt$(item.market_price!)}</span>
                        <span className="font-bold text-emerald-300">+{gainPct.toFixed(0)}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Needs Re-Pricing ─────────────────────────────────────────────── */}
            {needsRepricing.length > 0 && (
              <div className="bg-gray-900 border border-amber-800/30 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>⏱ Needs Re-Pricing</span>
                  <span className="text-xs font-normal normal-case text-gray-600">price not updated in &gt;30d</span>
                </div>
                <div className="space-y-1.5">
                  {needsRepricing.map(item => {
                    const daysSince = Math.round((Date.now() - new Date(item.updated_at).getTime()) / 86400000);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { d({ t: "SET_TAB", tab: "market" }); d({ t: "MARKET_QUERY", q: `What is the current market price of "${item.name}" ${item.condition} ${item.card_set ?? ""}?` }); }}
                        className="w-full flex items-center gap-3 py-1.5 px-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.condition}{item.card_set ? ` · ${item.card_set}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                          <span className="text-blue-400">{fmt$(item.market_price!)}</span>
                          <span className="text-amber-600 font-mono">{daysSince}d old</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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

            {/* ── Grading Pipeline ─────────────────────────────────────────────── */}
            {gradingPipeline.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>⚗ Grading Pipeline</span>
                  <span className="text-gray-600 font-normal normal-case">{gradingPipeline.length} card{gradingPipeline.length !== 1 ? "s" : ""} in queue</span>
                </div>
                <div className="space-y-2">
                  {gradingPipeline.map(({ item, daysIn, cost, isStale }) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => d({ t: "SET_MODAL", id: item.id })}
                      className={`w-full flex items-center justify-between gap-3 py-1.5 px-3 rounded-lg hover:bg-gray-800 transition-colors text-left ${isStale ? "bg-red-950/20 border border-red-900/30" : "bg-gray-800/40"}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {item.image_url && (
                          <img src={item.image_url} alt={item.name} loading="lazy" className="w-6 h-8 object-cover rounded flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.condition}{item.card_set ? ` · ${item.card_set}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-right">
                        <span className="text-xs text-gray-500">{fmt$(cost)}</span>
                        {psaEstProfit != null && (
                          <span className={`text-xs font-semibold ${psaEstProfit >= 0 ? "text-emerald-500" : "text-red-400"}`}
                            title={`Est. PSA value: ${fmt$(psaEstValue!)} · Est. profit: ${fmt$(psaEstProfit)}`}>
                            est.{psaEstProfit >= 0 ? "+" : ""}{fmt$(psaEstProfit)}
                          </span>
                        )}
                        <span className={`text-xs font-mono font-semibold ${isStale ? "text-red-400" : daysIn > 30 ? "text-amber-400" : "text-gray-400"}`}>
                          {daysIn}d
                        </span>
                        {isStale && <span className="text-xs text-red-500">⚠ stale</span>}
                      </div>
                    </button>
                  ))}
                </div>
                {gradingPipeline.some(x => x.isStale) && (
                  <p className="text-xs text-red-600 mt-2">Items marked ⚠ have been in grading for over 60 days.</p>
                )}
              </div>
            )}

            {/* ── Watchlist ────────────────────────────────────────────────────── */}
            {watchlistItems.length > 0 && (
              <div className="bg-gray-900 border border-blue-800/40 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>👁 Watchlist</span>
                  <span className="text-xs font-normal normal-case text-gray-600">
                    {watchlistItems.length} item{watchlistItems.length !== 1 ? "s" : ""} tagged [watch]
                  </span>
                </div>
                <div className="space-y-2">
                  {watchlistItems.map(item => {
                    const cost  = +item.buy_price + +(item.grading_cost ?? 0);
                    const mkt   = item.market_price;
                    const pnl   = mkt != null ? mkt - cost : null;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => d({ t: "SET_MODAL", id: item.id })}
                        className="w-full flex items-center gap-3 py-1.5 px-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.condition}{item.card_set ? ` · ${item.card_set}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500">{fmt$(cost)}</span>
                          {mkt != null && (
                            <span className={`text-xs font-semibold ${pnl! >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {fmt$(mkt)} ({pnl! >= 0 ? "+" : ""}{fmt$(pnl!)})
                            </span>
                          )}
                          <span className="text-xs bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded">watch</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-700 mt-2">Add <code className="bg-gray-800 px-1 rounded">[watch]</code> to an item's notes to track it here.</p>
              </div>
            )}

            {/* ── Franchise Breakdown ──────────────────────────────────────────── */}
            {franchiseBreakdown.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  📊 Franchise Breakdown
                </div>
                <div className="space-y-2">
                  {franchiseBreakdown.map(f => {
                    const totalActive = franchiseBreakdown.reduce((a, b) => a + b.count, 0);
                    const pct = totalActive > 0 ? (f.count / totalActive) * 100 : 0;
                    return (
                      <div key={f.fullName} className="flex items-center gap-2">
                        <div className="w-20 flex-shrink-0 text-xs text-gray-400 truncate" title={f.fullName}>{f.name}</div>
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-600/70"
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 w-8 text-right flex-shrink-0">{f.count}</div>
                        {f.sold > 0 && (
                          <div className={`text-xs font-semibold w-16 text-right flex-shrink-0 ${f.profit >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {f.profit >= 0 ? "+" : ""}{fmt$(f.profit)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Quick-Flip Wins ───────────────────────────────────────────────── */}
            {quickFlips.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>⚡ Quick-Flip Wins</span>
                  <span className="text-xs font-normal normal-case text-gray-600">sold ≤30d · profitable</span>
                </div>
                <div className="space-y-1.5">
                  {quickFlips.map(({ item, holdDays, profit, roi }) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => d({ t: "SET_MODAL", id: item.id })}
                      className="w-full flex items-center gap-3 py-1.5 px-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{holdDays}d hold</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                        <span className="text-emerald-400 font-semibold">+{fmt$(profit)}</span>
                        <span className="text-emerald-600">{fmtPct(roi)}</span>
                      </div>
                    </button>
                  ))}
                </div>
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

            {/* ── Concentration Risk ───────────────────────────────────────────── */}
            {concentrationRisk.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>🏦 Concentration Risk</span>
                  <span className="text-xs font-normal normal-case text-gray-600">items ≥5% of active portfolio</span>
                </div>
                <div className="space-y-2">
                  {concentrationRisk.map(({ item, val, pct }) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => d({ t: "SET_MODAL", id: item.id })}
                      className="w-full flex items-center gap-3 py-1.5 px-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <div className="h-1 bg-gray-800 rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full ${pct >= 20 ? "bg-red-500" : pct >= 10 ? "bg-amber-500" : "bg-blue-600"}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-bold ${pct >= 20 ? "text-red-400" : pct >= 10 ? "text-amber-400" : "text-blue-400"}`}>
                          {pct.toFixed(0)}%
                        </span>
                        <span className="text-xs text-gray-500">{fmt$(val)}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {concentrationRisk[0]?.pct >= 20 && (
                  <p className="text-xs text-amber-600 mt-2">⚠ High concentration — single item represents {concentrationRisk[0].pct.toFixed(0)}% of active portfolio value.</p>
                )}
              </div>
            )}

            {/* ── Inventory Aging ──────────────────────────────────────────────── */}
            {inventoryAging.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>⏳ Inventory Age</span>
                  <span className="text-xs font-normal normal-case text-gray-600">capital tied up by age bucket</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {inventoryAging.map(b => (
                    <div key={b.label} className="bg-gray-800 rounded-lg p-3 flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${b.cls}`} />
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 leading-tight">{b.label}</div>
                        <div className="font-bold text-sm text-white mt-0.5">{b.count} card{b.count !== 1 ? "s" : ""}</div>
                        <div className="text-xs text-amber-400 font-mono">{fmt$(b.cost)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Underwater Items ─────────────────────────────────────────────── */}
            {underwaterItems.length > 0 && (
              <div className="bg-gray-900 border border-red-900/30 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>📉 Underwater Items</span>
                  <span className="text-xs font-normal normal-case text-gray-600">market &lt; cost · consider action</span>
                </div>
                <div className="space-y-1.5">
                  {underwaterItems.map(({ item, cost, loss, ageDays }) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => d({ t: "SET_MODAL", id: item.id })}
                      className="w-full flex items-center gap-3 py-1.5 px-3 bg-red-950/20 rounded-lg hover:bg-red-950/40 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{ageDays}d held · cost {fmt$(cost)}</p>
                      </div>
                      <div className="text-xs font-semibold text-red-400 flex-shrink-0">{fmt$(loss)}</div>
                    </button>
                  ))}
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

            {/* ── Action Required ──────────────────────────────────────────────── */}
            {actionItems.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>⚡ Action Required</span>
                  <span className="text-xs font-normal normal-case text-gray-600">{actionItems.length} item{actionItems.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-2">
                  {actionItems.map(({ priority, action, item, detail, tab: actionTab, query }) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 py-1.5 px-3 rounded-lg ${
                        priority === "high"
                          ? "bg-red-950/30 border border-red-900/30"
                          : "bg-amber-950/20 border border-amber-900/20"
                      }`}
                    >
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${
                        priority === "high" ? "bg-red-900/60 text-red-300" : "bg-amber-900/60 text-amber-300"
                      }`}>{priority === "high" ? "!" : "·"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-300 truncate">{item.name}</div>
                        <div className="text-xs text-gray-500">{action} · {detail}</div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => d({ t: "SET_MODAL", id: item.id })}
                          className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-white transition-colors"
                        >🔍</button>
                        {actionTab && query && (
                          <button
                            onClick={() => { d({ t: "SET_TAB", tab: actionTab }); d({ t: "MKT_QUERY", v: query }); }}
                            className="text-xs px-2 py-1 rounded bg-blue-900/60 text-blue-300 hover:bg-blue-800 transition-colors"
                            title="Open Market Scan for this card"
                          >Scan</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Partner Profit Leaderboard ────────────────────────────────── */}
            {partnerPnL.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">🏆 Partner Leaderboard</div>
                <div className="space-y-2">
                  {partnerPnL.map((p, i) => {
                    const maxProfit = Math.max(1, ...partnerPnL.map(x => Math.abs(x.profit)));
                    return (
                      <div key={p.name} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-4 flex-shrink-0">{i + 1}.</span>
                        <span className="text-xs text-gray-400 w-20 flex-shrink-0 truncate">{p.name}</span>
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.profit >= 0 ? "bg-emerald-500/70" : "bg-red-500/70"}`}
                            style={{ width: `${(Math.abs(p.profit) / maxProfit) * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold w-16 text-right flex-shrink-0 ${p.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {p.profit >= 0 ? "+" : ""}{fmt$(p.profit)}
                        </span>
                        <span className={`text-xs w-10 text-right flex-shrink-0 ${p.roi >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {fmtPct(p.roi)}
                        </span>
                      </div>
                    );
                  })}
                </div>
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
                    // Dynamic: context-aware suggestions
                    ...(needsRepricing.length > 0 ? [`עדכן מחיר עבור ${needsRepricing[0].name}`] : []),
                    ...(sellScores.length > 0 ? [`מה הציון מכירה של ${sellScores[0].item.name}?`] : []),
                    ...(concentrationRisk.length > 0 ? ["ניתוח ריכוז פורטפוליו"] : []),
                    ...(gradingPipeline.some(x => x.isStale) ? ["אילו קלפים תקועים בגריידינג?"] : []),
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

            {/* ── Recent Activity ──────────────────────────────────────── */}
            {recentActivity.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Recent Activity</div>
                <div className="space-y-1.5">
                  {recentActivity.map(({ item, profit, timeLabel, badge, badgeCls }) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => d({ t: "SET_MODAL", id: item.id })}
                      className="w-full flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-800/60 transition-colors text-left"
                    >
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} loading="lazy" className="w-7 h-9 object-cover rounded flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-gray-600">{item.condition}{item.card_set ? ` · ${item.card_set}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {profit != null && (
                          <span className={`text-xs font-semibold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {profit >= 0 ? "+" : ""}{fmt$(profit)}
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${badgeCls}`}>{badge}</span>
                        <span className="text-xs text-gray-700">{timeLabel}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ══ INVENTORY ══════════════════════════════════════════════════════ */}
        {s.tab === "inventory" && (
          <div>
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 mb-3 items-center">
              <div className="relative flex-1 min-w-[160px]">
                <Input
                  dir="rtl"
                  ref={searchInputRef}
                  className="bg-gray-800 border-gray-700 pr-8 w-full"
                  value={s.inv.search}
                  onChange={(e) => d({ t: "INV_SEARCH", v: e.target.value })}
                  placeholder="🔍 Search name, set, notes… ( / )"
                />
                {s.inv.search && (
                  <button
                    onClick={() => { d({ t: "INV_SEARCH", v: "" }); searchInputRef.current?.focus(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-sm leading-none"
                    title="Clear search"
                  >✕</button>
                )}
              </div>
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
                {s.viewMode === "table" && (
                  <button
                    onClick={() => setCompactTable(v => !v)}
                    className={`px-3 py-2 text-xs transition-colors border-l border-gray-700 ${compactTable ? "bg-indigo-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                    title="Compact rows"
                  >⊟</button>
                )}
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
                    <div><kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">t</kbd> — Toggle table/cards</div>
                    <div><kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">b</kbd> — Brain tab</div>
                    <div><kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">r</kbd> — ROI tab</div>
                    <div><kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">m</kbd> — Market tab</div>
                    <div><kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">Esc</kbd> — Close modal/form</div>
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
                      onClick={() => { setStatusFilter(key); setWatchlistFilter(false); d({ t: "INV_PAGE", n: 1 }); }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        statusFilter === key && !watchlistFilter
                          ? "bg-blue-700 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                      }`}
                    >
                      {label} <span className={statusFilter === key && !watchlistFilter ? "text-blue-200" : "text-gray-600"}>{count}</span>
                      {badge && <span className="ml-1 text-amber-500/80 text-xs">· {badge}</span>}
                    </button>
                  ))}
                  {watchlistItems.length > 0 && (
                    <button
                      onClick={() => { setWatchlistFilter(v => !v); d({ t: "INV_PAGE", n: 1 }); }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        watchlistFilter
                          ? "bg-blue-900 text-blue-200 border border-blue-700"
                          : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                      }`}
                    >
                      👁 Watchlist <span className={watchlistFilter ? "text-blue-300" : "text-gray-600"}>{watchlistItems.length}</span>
                    </button>
                  )}
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
                    sellScore={sellScores.find(x => x.item.id === item.id)?.score ?? null}
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
                <table className={`w-full ${compactTable ? "text-xs" : "text-sm"}`}>
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
                        { label: "Age ↕", field: "__age__" as const },
                        { label: "Buy", field: "buy_price" as const },
                        { label: "Grading", field: "grading_cost" as const },
                        { label: "Market", field: "market_price" as const },
                        { label: "P&L", field: "__pnl__" as const },
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
                        <tr key={item.id} className={`border-b border-gray-800/50 hover:bg-white/[0.02] ${compactTable ? "text-xs" : ""}`}>
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
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold hover:text-blue-300 transition-colors">{item.name}</span>
                                  {item.notes && (item.notes.toLowerCase().includes("[watch]")
                                    ? <span className="text-blue-400 text-xs" title={item.notes}>👁</span>
                                    : <span className="text-gray-600 text-xs" title={item.notes}>📝</span>
                                  )}
                                  {(() => {
                                    const sc = sellScores.find(x => x.item.id === item.id);
                                    if (!sc || sc.score < 60) return null;
                                    return (
                                      <span
                                        className={`text-[9px] font-bold px-1 py-0.5 rounded-full leading-none ${sc.score >= 80 ? "bg-emerald-700/80 text-emerald-100" : "bg-blue-700/80 text-blue-100"}`}
                                        title={`Sell score: ${sc.score}/100`}
                                      >{sc.score}</span>
                                    );
                                  })()}
                                </div>
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
                              <div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => { setInlineEditId(item.id); setInlineEditVal(item.market_price != null ? String(item.market_price) : ""); }}
                                    className="text-blue-400 hover:text-blue-300 transition-colors"
                                    title="Click to edit market price"
                                  >
                                    {item.market_price != null ? fmt$(item.market_price) : <span className="text-gray-600 text-xs">+ price</span>}
                                  </button>
                                  {item.market_price != null && item.status !== "sold" && (() => {
                                    const daysSinceUpdate = Math.round((Date.now() - new Date(item.updated_at).getTime()) / 86400000);
                                    if (daysSinceUpdate < 30) return null;
                                    return (
                                      <span className="text-amber-700 text-xs" title={`Price not updated in ${daysSinceUpdate}d`}>⏱</span>
                                    );
                                  })()}
                                </div>
                                {item.status !== "sold" && (() => {
                                  const breakeven = Math.ceil((cost * 1.13) * 100) / 100; // 13% platform fees
                                  const isAbove = item.market_price != null && item.market_price > breakeven;
                                  return (
                                    <div className={`text-xs font-mono mt-0.5 ${isAbove ? "text-emerald-700" : "text-gray-700"}`}
                                      title="Break-even incl. ~13% fees">
                                      BE {fmt$(breakeven)}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </td>
                          {/* P&L column */}
                          <td className="px-3 py-2.5 text-right">
                            {(() => {
                              const unrealPnL = item.status !== "sold"
                                ? (item.market_price ?? +item.buy_price) - cost
                                : null;
                              if (unrealPnL == null) return <span className="text-gray-600">—</span>;
                              return (
                                <span className={`text-xs font-semibold ${unrealPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {unrealPnL >= 0 ? "+" : ""}{fmt$(unrealPnL)}
                                </span>
                              );
                            })()}
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
                            <div className="flex gap-1.5 flex-wrap">
                              {item.status === "active" && (
                                <button
                                  onClick={() => quickStatusChange(item, "grading")}
                                  className="text-xs px-2 py-1 bg-amber-900/60 text-amber-300 rounded hover:bg-amber-800 transition-colors"
                                  title="Send to grading"
                                >⚗</button>
                              )}
                              {item.status === "grading" && (
                                <button
                                  onClick={() => quickStatusChange(item, "active")}
                                  className="text-xs px-2 py-1 bg-blue-900/60 text-blue-300 rounded hover:bg-blue-800 transition-colors"
                                  title="Return to active"
                                >↩</button>
                              )}
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
                                onClick={() => duplicateItem(item)}
                                className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 transition-colors"
                                title="Duplicate item"
                              >⧉</button>
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
                        <td colSpan={10} className="text-center py-10 text-gray-600">
                          {s.inv.search ? "No results" : "No items — click Add"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {/* Summary row: totals for visible filtered items */}
                  {sortedItems.length > 0 && (() => {
                    const totalBuy     = sortedItems.reduce((acc, i) => acc + +i.buy_price, 0);
                    const totalGrading = sortedItems.reduce((acc, i) => acc + +(i.grading_cost ?? 0), 0);
                    const totalCost    = totalBuy + totalGrading;
                    const totalMarket  = sortedItems.reduce((acc, i) => acc + (i.market_price ?? +i.buy_price), 0);
                    const totalPnL     = totalMarket - totalCost;
                    return (
                      <tfoot>
                        <tr className="border-t-2 border-gray-700 bg-gray-900/80 text-xs">
                          <td /> {/* checkbox */}
                          <td className="px-3 py-2 text-gray-500 font-semibold">
                            {sortedItems.length} item{sortedItems.length !== 1 ? "s" : ""}
                          </td>
                          <td /> {/* Status */}
                          <td /> {/* Date */}
                          <td className="px-3 py-2 text-right text-amber-400 font-semibold">{fmt$(totalBuy)}</td>
                          <td className="px-3 py-2 text-right text-indigo-400">{totalGrading > 0 ? fmt$(totalGrading) : "—"}</td>
                          <td className="px-3 py-2 text-right text-blue-400 font-semibold">{fmt$(totalMarket)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {totalPnL >= 0 ? "+" : ""}{fmt$(totalPnL)}
                          </td>
                          <td /> {/* Sale */}
                          <td /> {/* Actions */}
                        </tr>
                      </tfoot>
                    );
                  })()}
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
                ...(salesVelocity ? [
                  { label: "Avg Days Between Sales", value: `${salesVelocity.avgGapDays}d`, cls: "text-indigo-400" as const },
                  { label: "Days Since Last Sale",   value: `${salesVelocity.daysSinceLast}d`, cls: salesVelocity.daysSinceLast > salesVelocity.avgGapDays * 1.5 ? "text-amber-400" as const : "text-gray-300" as const },
                ] : []),
                ...(bestSaleMonth ? [
                  { label: "Best Sale Month", value: bestSaleMonth.month, cls: "text-emerald-400" as const },
                ] : []),
                ...(sellStreak && sellStreak.current > 1 ? [
                  { label: "🔥 Profit Streak", value: `${sellStreak.current} sales`, cls: "text-orange-400" as const },
                ] : []),
                ...(annualProjection ? [
                  { label: "📅 90d Profit", value: fmt$(annualProjection.recent90d), cls: annualProjection.recent90d >= 0 ? "text-emerald-400" as const : "text-red-400" as const },
                  { label: "📈 Projected Annual", value: fmt$(annualProjection.projAnnual), cls: annualProjection.projAnnual >= 0 ? "text-emerald-400" as const : "text-red-400" as const },
                ] : []),
                ...(profitPerDay != null ? [
                  { label: "💵 Profit / Hold-Day", value: fmt$(profitPerDay), cls: profitPerDay >= 0 ? "text-emerald-400" as const : "text-red-400" as const },
                ] : []),
                ...(winRate ? [
                  { label: "🎯 Win Rate", value: `${winRate.wins}/${winRate.total} (${winRate.pct.toFixed(0)}%)`, cls: winRate.pct >= 50 ? "text-emerald-400" as const : "text-amber-400" as const },
                ] : []),
                ...(monthlyScoreboard ? [
                  { label: "📅 Green Months", value: `${monthlyScoreboard.green}/${monthlyScoreboard.total}`, cls: monthlyScoreboard.green >= monthlyScoreboard.red ? "text-emerald-400" as const : "text-amber-400" as const },
                ] : []),
              ]).map((st) => (
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

            {/* ── Best/Worst Deals (by absolute $ profit) ─────────────── */}
            {(() => {
              const sold = s.items
                .filter(i => i.status === "sold" && i.sell_price != null)
                .map(i => {
                  const cost = +i.buy_price + +(i.grading_cost ?? 0);
                  return { item: i, profit: +(i.sell_price!) - cost };
                })
                .sort((a, b) => b.profit - a.profit);
              if (sold.length < 2) return null;
              const best  = sold[0];
              const worst = sold[sold.length - 1];
              if (worst.profit >= 0) return null; // no losses to show
              return (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900 border border-emerald-800/40 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-2 font-semibold">🏆 Best Deal</div>
                    <div className="font-medium text-sm truncate">{best.item.name}</div>
                    <div className="text-emerald-400 font-bold text-lg">+{fmt$(best.profit)}</div>
                    <div className="text-xs text-gray-600">{best.item.condition}{best.item.psa_grade ? ` PSA ${best.item.psa_grade}` : ""}</div>
                  </div>
                  <div className="bg-gray-900 border border-red-800/40 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-2 font-semibold">📉 Worst Deal</div>
                    <div className="font-medium text-sm truncate">{worst.item.name}</div>
                    <div className="text-red-400 font-bold text-lg">{fmt$(worst.profit)}</div>
                    <div className="text-xs text-gray-600">{worst.item.condition}{worst.item.psa_grade ? ` PSA ${worst.item.psa_grade}` : ""}</div>
                  </div>
                </div>
              );
            })()}

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

            {/* ── Partner P&L Comparison ───────────────────────────────── */}
            {partnerPnL.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Partner Realized Profit Comparison</p>
                <ResponsiveContainer width="100%" height={Math.max(80, partnerPnL.length * 44)}>
                  <BarChart data={partnerPnL} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmt$} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} width={88} />
                    <Tooltip
                      formatter={(v: number) => [fmt$(v), "Net Profit"]}
                      contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <Bar dataKey="profit" name="profit" radius={[0, 3, 3, 0]}>
                      {partnerPnL.map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Monthly Revenue Bar Chart ──────────────────────────────── */}
            {monthlyRevenue.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Monthly Revenue & Net Profit</p>
                <ResponsiveContainer width="100%" height={190}>
                  <ComposedChart data={monthlyRevenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
                    <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmt$} width={48} />
                    <Tooltip
                      formatter={(v: number, name: string) => [fmt$(v), name === "revenue" ? "Revenue" : name === "profit" ? "Net Profit" : "3-mo avg profit"]}
                      contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <Legend
                      iconSize={8}
                      formatter={(value) => <span style={{ color: "#9ca3af", fontSize: 10 }}>{value === "revenue" ? "Revenue" : value === "profit" ? "Net Profit" : "3-mo avg"}</span>}
                    />
                    <Bar dataKey="revenue" name="revenue" radius={[3, 3, 0, 0]}>
                      {monthlyRevenue.map((_, i) => (
                        <Cell key={i} fill="#3b82f6" />
                      ))}
                    </Bar>
                    <Bar dataKey="profit" name="profit" radius={[3, 3, 0, 0]}>
                      {monthlyRevenue.map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.85} />
                      ))}
                    </Bar>
                    {monthlyRevenue.length >= 4 && (
                      <Line type="monotone" dataKey="ma3" name="ma3" stroke="#f59e0b" strokeWidth={2}
                        dot={false} strokeDasharray="4 2" connectNulls={false} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Cumulative P&L Curve ─────────────────────────────────── */}
            {cumulativePnL.length >= 3 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Cumulative Realized P&L</p>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={cumulativePnL} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmt$} width={48} />
                    <Tooltip
                      formatter={(v: number) => [fmt$(v), "Cumulative profit"]}
                      contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <Area type="monotone" dataKey="cumulative" stroke="#10b981" strokeWidth={2} fill="url(#pnlGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Quarterly Performance ───────────────────────────────────── */}
            {quarterlyPerformance.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Quarterly Performance</p>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={quarterlyPerformance} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="quarter" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmt$} width={48} />
                    <Tooltip
                      formatter={(v: number, name: string) => [name === "count" ? `${v} sales` : fmt$(v), name === "count" ? "Sales" : "Profit"]}
                      contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
                    <Bar dataKey="profit" name="profit" radius={[3, 3, 0, 0]}>
                      {quarterlyPerformance.map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Franchise ROI ─────────────────────────────────────────── */}
            {franchiseBreakdown.filter(f => f.sold > 0).length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Realized Profit by Franchise</p>
                <ResponsiveContainer width="100%" height={Math.max(100, franchiseBreakdown.filter(f => f.sold > 0).length * 30)}>
                  <BarChart
                    data={franchiseBreakdown.filter(f => f.sold > 0).sort((a, b) => b.profit - a.profit)}
                    layout="vertical"
                    margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmt$} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
                    <Tooltip
                      formatter={(v: number) => [fmt$(v), "Profit"]}
                      contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                    />
                    <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                      {franchiseBreakdown.filter(f => f.sold > 0).sort((a, b) => b.profit - a.profit).map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.8} />
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

            {/* ── Condition ROI Analysis ───────────────────────────────── */}
            {conditionROI.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">
                  Realized ROI by Condition
                  <span className="ml-1 font-normal normal-case">raw sold cards</span>
                </p>
                <div className="space-y-2.5">
                  {(() => {
                    const maxAbs = Math.max(1, ...conditionROI.map(c => Math.abs(c.roi)));
                    return conditionROI.map(({ condition, profit, count, roi }) => (
                      <div key={condition} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-8 text-right font-mono flex-shrink-0">{condition}</span>
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${roi >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                            style={{ width: `${(Math.abs(roi) / maxAbs) * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold w-14 text-right flex-shrink-0 ${roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {roi >= 0 ? "+" : ""}{fmtPct(roi)}
                        </span>
                        <span className={`text-xs w-16 text-right flex-shrink-0 ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {profit >= 0 ? "+" : ""}{fmt$(profit)}
                        </span>
                        <span className="text-xs text-gray-700 w-8 text-right flex-shrink-0">({count})</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* ── Franchise ROI Breakdown ───────────────────────────────── */}
            {franchiseROI.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Realized ROI by Franchise</p>
                <div className="space-y-2.5">
                  {franchiseROI.map(({ name, profit, roi, count }) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 truncate min-w-0 flex-1">{name}
                        <span className="text-gray-600 ml-1">({count})</span>
                      </span>
                      <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden flex-shrink-0">
                        <div
                          className={`h-full rounded-full ${roi >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, Math.abs(roi))}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold w-14 text-right flex-shrink-0 ${roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {roi >= 0 ? "+" : ""}{fmtPct(roi)}
                      </span>
                      <span className={`text-xs w-16 text-right flex-shrink-0 ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {profit >= 0 ? "+" : ""}{fmt$(profit)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Card Set ROI ─────────────────────────────────────────── */}
            {cardSetROI.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">
                  Realized ROI by Card Set
                  <span className="ml-1 font-normal normal-case">(≥2 sales)</span>
                </p>
                <div className="space-y-2.5">
                  {(() => {
                    const maxAbs = Math.max(1, ...cardSetROI.map(c => Math.abs(c.roi)));
                    return cardSetROI.map(({ name, profit, roi, count }) => (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 truncate min-w-0 flex-1">{name}
                          <span className="text-gray-600 ml-1">({count})</span>
                        </span>
                        <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden flex-shrink-0">
                          <div
                            className={`h-full rounded-full ${roi >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                            style={{ width: `${(Math.abs(roi) / maxAbs) * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold w-14 text-right flex-shrink-0 ${roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {roi >= 0 ? "+" : ""}{fmtPct(roi)}
                        </span>
                        <span className={`text-xs w-16 text-right flex-shrink-0 ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {profit >= 0 ? "+" : ""}{fmt$(profit)}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* ── Flip-Speed Leaderboard ───────────────────────────────── */}
            {flipSpeedByFranchise.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">
                  ⚡ Flip Speed by Franchise
                  <span className="ml-1 font-normal normal-case">(≥2 sales · lower = faster)</span>
                </p>
                <div className="space-y-2.5">
                  {(() => {
                    const maxHold = Math.max(1, ...flipSpeedByFranchise.map(f => f.avgHold));
                    return flipSpeedByFranchise.map((f, i) => (
                      <div key={f.name} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-4 flex-shrink-0">{i + 1}.</span>
                        <span className="text-xs text-gray-400 w-24 flex-shrink-0 truncate">{f.name}</span>
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500/70"
                            style={{ width: `${(f.avgHold / maxHold) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-indigo-400 font-semibold w-12 text-right flex-shrink-0">{f.avgHold}d avg</span>
                        <span className={`text-xs w-14 text-right flex-shrink-0 ${f.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {f.profit >= 0 ? "+" : ""}{fmt$(f.profit)}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* ── Cost Composition ─────────────────────────────────────── */}
            {costComposition.total > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Cost Composition</p>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">Buy cost <span className="text-gray-600">({costComposition.buyPct.toFixed(0)}%)</span></span>
                    <span className="text-amber-400 font-semibold">{fmt$(costComposition.totalBuy)}</span>
                  </div>
                  <div className="h-4 bg-gray-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-amber-600 transition-all" style={{ width: `${costComposition.buyPct}%` }} />
                    <div className="h-full bg-indigo-600 transition-all" style={{ width: `${costComposition.gradingPct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-gray-400">Grading cost <span className="text-gray-600">({costComposition.gradingPct.toFixed(0)}%)</span></span>
                    <span className="text-indigo-400 font-semibold">{fmt$(costComposition.totalGrading)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                    <div className="text-amber-400 font-bold">{fmt$(costComposition.avgBuy)}</div>
                    <div className="text-gray-600 mt-0.5">avg buy</div>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                    <div className="text-indigo-400 font-bold">{fmt$(costComposition.avgGrading)}</div>
                    <div className="text-gray-600 mt-0.5">avg grading ({costComposition.gradedCount})</div>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                    <div className="text-gray-300 font-bold">{fmt$(costComposition.total / Math.max(1, s.items.length))}</div>
                    <div className="text-gray-600 mt-0.5">avg total cost</div>
                  </div>
                </div>

                {/* Buy-price distribution */}
                <div className="mt-3 space-y-1.5">
                  {priceDistribution.filter(b => b.count > 0).map(b => (
                    <div key={b.label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-16 text-right font-mono flex-shrink-0">{b.label}</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-700/70 rounded-full" style={{ width: `${b.pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">{b.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── PSA vs Raw ROI ─────────────────────────────────────────── */}
            {psaVsRaw && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">PSA Graded vs Raw ROI</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "🏅 PSA Graded", stats: psaVsRaw.psa! },
                    { label: "📄 Raw",         stats: psaVsRaw.raw! },
                  ].map(({ label, stats }) => (
                    <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500 mb-1">{label}</div>
                      <div className={`text-lg font-bold ${stats.roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {fmtPct(stats.roi)}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">{stats.count} sales · {fmt$(stats.profit)} profit</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ROI Distribution ─────────────────────────────────────── */}
            {roiDistribution.some(b => b.count > 0) && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Sale ROI Distribution</p>
                <div className="flex gap-1 items-end h-16">
                  {roiDistribution.map((b) => {
                    const maxCount = Math.max(1, ...roiDistribution.map(x => x.count));
                    const barH = b.count > 0 ? Math.max(6, (b.count / maxCount) * 52) : 3;
                    const isPositive = !b.label.startsWith("<");
                    return (
                      <div key={b.label} className="flex-1 flex flex-col items-center gap-1" title={`${b.label}: ${b.count} sales`}>
                        {b.count > 0 && <span className="text-[9px] text-gray-500">{b.count}</span>}
                        <div
                          className={`w-full rounded-t transition-all ${b.count === 0 ? "bg-gray-800/30" : isPositive ? "bg-emerald-600/80" : "bg-red-600/80"}`}
                          style={{ height: barH }}
                        />
                        <span className="text-[9px] text-gray-600 text-center leading-tight">{b.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Hold-Time Distribution ────────────────────────────────── */}
            {holdTimeBreakdown.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-4">Hold-Time Distribution</p>
                <div className="space-y-2.5">
                  {(() => {
                    const maxCount = Math.max(...holdTimeBreakdown.map(b => b.count));
                    return holdTimeBreakdown.map(b => (
                      <div key={b.label} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-14 text-right font-mono flex-shrink-0">{b.label}</span>
                        <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden relative">
                          <div
                            className={`h-full rounded transition-all ${b.avgProfit >= 0 ? "bg-blue-600/70" : "bg-red-600/70"}`}
                            style={{ width: `${(b.count / maxCount) * 100}%` }}
                          />
                          <span className="absolute inset-0 flex items-center px-2 text-xs text-gray-300">
                            {b.count} sale{b.count !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <span className={`text-xs font-semibold w-18 text-right flex-shrink-0 ${b.avgProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          avg {b.avgProfit >= 0 ? "+" : ""}{fmt$(b.avgProfit)}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
                <p className="text-xs text-gray-700 mt-2">Hold time = sold date − buy date. Avg profit shown per bucket.</p>
              </div>
            )}

            {/* ── Purchase Activity ────────────────────────────────────────── */}
            {purchaseFrequency.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Purchase Activity (last 8 months)</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={purchaseFrequency} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={24} />
                    <Tooltip
                      formatter={(v: number) => [v, "Cards bought"]}
                      contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="#6366f1" fillOpacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Day-of-Week Sales Heatmap ─────────────────────────────── */}
            {dayOfWeekROI.some(d => d.count > 0) && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Sales by Day of Week</p>
                <div className="flex gap-1 items-end h-20">
                  {dayOfWeekROI.map((d) => {
                    const maxProfit = Math.max(...dayOfWeekROI.map(x => x.profit), 0.01);
                    const barH = d.count > 0 ? Math.max(8, (d.profit / maxProfit) * 64) : 4;
                    const isPositive = d.profit >= 0;
                    return (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.count} sales · ${fmt$(d.profit)} profit · ROI ${fmtPct(d.roi)}`}>
                        <span className={`text-[9px] font-mono ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                          {d.count > 0 ? fmtPct(d.roi) : ""}
                        </span>
                        <div
                          className={`w-full rounded-t transition-all ${d.count === 0 ? "bg-gray-800/40" : isPositive ? "bg-emerald-600/80" : "bg-red-600/80"}`}
                          style={{ height: barH }}
                        />
                        <span className="text-[9px] text-gray-600">{d.day}</span>
                        {d.count > 0 && <span className="text-[8px] text-gray-700">{d.count}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Hold-Time Distribution ────────────────────────────────── */}
            {holdTimeHistogram.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Hold-Time Distribution</p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={holdTimeHistogram} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={24} />
                    <Tooltip
                      formatter={(v: number, name: string) => [name === "count" ? `${v} sales` : fmt$(v as number), name === "count" ? "Sales" : "Profit"]}
                      contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <Bar dataKey="count" name="count" radius={[3, 3, 0, 0]}>
                      {holdTimeHistogram.map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? "#6366f1" : "#ef4444"} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-auto">
              <div className="px-4 py-3 border-b border-gray-800 font-semibold text-sm flex items-center justify-between">
                <span>Sold Transactions</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-normal">{s.items.filter(i => i.status === "sold").length} sales</span>
                  <button
                    onClick={() => exportCSV(s.items.filter(i => i.status === "sold"), s.partners, "sold-transactions.csv")}
                    className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    title="Export sold transactions to CSV"
                  >⬇ CSV</button>
                </div>
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
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold">🌐 Market Scan — Forensic Truth</h2>
              {s.items.filter(i => i.status === "active" && i.market_price == null).length > 0 && (
                <button
                  onClick={() => {
                    const unpriced = s.items
                      .filter(i => i.status === "active" && i.market_price == null)
                      .slice(0, 1); // Start with first unpriced item
                    if (unpriced.length > 0) {
                      const item = unpriced[0];
                      const q = `What is the current market price of "${item.name}"${item.card_set ? ` from ${item.card_set}` : ""} ${item.condition} TCG card? Search eBay sold listings and give me the exact current price.`;
                      d({ t: "MKT_QUERY", v: q });
                      d({ t: "MKT_MODE", v: "market" });
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-900/60 text-blue-300 hover:bg-blue-800 border border-blue-700/40 transition-colors"
                >
                  ⚡ Auto-scan next unpriced ({s.items.filter(i => i.status === "active" && i.market_price == null).length})
                </button>
              )}
            </div>
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

            {/* Suggested scans based on unpriced inventory */}
            {s.market.mode === "market" && (() => {
              const unpriced = s.items
                .filter(i => i.status === "active" && i.market_price == null)
                .sort((a, b) => +b.buy_price - +a.buy_price)
                .slice(0, 8);
              if (unpriced.length === 0) return null;
              return (
                <div className="mb-3">
                  <div className="text-xs text-gray-600 mb-1.5">💡 Quick-scan (active, no price):</div>
                  <div className="flex flex-wrap gap-1.5">
                    {unpriced.map(item => {
                      const q = `What is the current market price of "${item.name}"${item.card_set ? ` from ${item.card_set}` : ""} ${item.psa_grade ? `PSA ${item.psa_grade}` : item.condition} TCG card? Search eBay sold listings.`;
                      return (
                        <button
                          key={item.id}
                          onClick={() => d({ t: "MKT_QUERY", v: q })}
                          className="px-2.5 py-1 rounded-lg text-xs bg-gray-800 hover:bg-blue-900/60 text-gray-300 hover:text-blue-300 border border-gray-700 hover:border-blue-700 transition-colors"
                        >
                          {item.name}{item.psa_grade ? ` PSA ${item.psa_grade}` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

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

            {partnerStats.map(({ partner, stats: ps }) => {
              const partnerItems  = s.items.filter(i => i.partner_id === partner.id);
              const activeItems   = partnerItems.filter(i => i.status !== "sold");
              const soldItems     = partnerItems
                .filter(i => i.status === "sold" && i.sell_price != null)
                .sort((a, b) => new Date(b.sold_at ?? b.updated_at).getTime() - new Date(a.sold_at ?? a.updated_at).getTime());
              const isExpanded    = expandedPartners.has(partner.id);
              const PREVIEW       = 4;
              const displayed     = isExpanded ? activeItems : activeItems.slice(0, PREVIEW);

              return (
                <div key={partner.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  {/* Header row */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-base">{partner.name}</div>
                      {partner.email && <div className="text-xs text-gray-500">{partner.email}</div>}
                      <div className="text-xs text-gray-600 mt-0.5">
                        {ps.activeCount} active · {ps.gradingCount} grading · {ps.soldCount} sold
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline"
                        onClick={() => exportCSV(partnerItems, s.partners, `${partner.name}.csv`)}
                        title="Standard CSV">⬇ CSV</Button>
                      <Button size="sm" variant="outline"
                        onClick={() => exportEbayCSV(partnerItems, `${partner.name}-ebay.csv`)}
                        title="eBay Bulk Upload CSV">eBay</Button>
                      <Button size="sm" variant="outline"
                        onClick={() => exportCardmarketCSV(partnerItems, `${partner.name}-cm.csv`)}
                        title="Cardmarket CSV">CM</Button>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    {([
                      { label: "Total Invested",     value: fmt$(ps.totalCost),        cls: "text-amber-400" },
                      { label: "Active Market Est.", value: fmt$(ps.estimatedValue),   cls: "text-blue-400" },
                      { label: "Sale Revenue",       value: fmt$(ps.realisedRevenue),  cls: "text-emerald-400" },
                      { label: "Net Profit + ROI",   value: `${fmt$(ps.realisedProfit)} (${fmtPct(ps.roiPct)})`,
                        cls: ps.realisedProfit >= 0 ? "text-emerald-400" : "text-red-400" },
                      ...(ps.soldCount > 0 ? (() => {
                        const totalHold = soldItems.reduce((acc, i) => {
                          if (!i.sold_at) return acc;
                          return acc + Math.round((new Date(i.sold_at).getTime() - new Date(i.buy_date).getTime()) / 86400000);
                        }, 0);
                        const avgHold = soldItems.length > 0 ? Math.round(totalHold / soldItems.length) : 0;
                        const margin = ps.realisedRevenue > 0 ? (ps.realisedProfit / ps.realisedRevenue) * 100 : 0;
                        return [
                          { label: "Avg Sale Margin", value: fmtPct(margin), cls: ps.realisedProfit >= 0 ? "text-emerald-400" : "text-red-400" },
                          { label: "Avg Hold Time", value: `${avgHold}d`, cls: "text-indigo-400" },
                        ];
                      })() : []),
                    ] as { label: string; value: string; cls: string }[]).map(st => (
                      <div key={st.label} className="bg-gray-800 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">{st.label}</div>
                        <div className={`text-sm font-bold ${st.cls}`}>{st.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Realized ROI bar */}
                  {ps.soldCount > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600">Realized ROI</span>
                        <span className={ps.roiPct >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>{fmtPct(ps.roiPct)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${ps.roiPct >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, Math.abs(ps.roiPct))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Active / Grading items */}
                  {displayed.map(i => {
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
                          >🔍</button>
                        </div>
                      </div>
                    );
                  })}
                  {activeItems.length > PREVIEW && (
                    <button
                      onClick={() => setExpandedPartners(prev => {
                        const next = new Set(prev);
                        isExpanded ? next.delete(partner.id) : next.add(partner.id);
                        return next;
                      })}
                      className="w-full text-center py-2 mt-1 text-xs text-gray-500 hover:text-gray-300 border-t border-gray-800 transition-colors"
                    >
                      {isExpanded ? "▲ Show less" : `▼ Show ${activeItems.length - PREVIEW} more cards`}
                    </button>
                  )}

                  {/* Sold transactions mini table */}
                  {soldItems.length > 0 && (
                    <div className="mt-4 border-t border-gray-800 pt-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                        <span>Sold Transactions</span>
                        <span className="text-gray-600 font-normal">{soldItems.length} sales</span>
                      </div>
                      <div className="space-y-1">
                        {soldItems.slice(0, 5).map(i => {
                          const base   = +i.buy_price + +(i.grading_cost ?? 0);
                          const profit = +(i.sell_price!) - base;
                          const roi    = base > 0 ? (profit / base) * 100 : 0;
                          return (
                            <button
                              key={i.id}
                              type="button"
                              onClick={() => d({ t: "SET_MODAL", id: i.id })}
                              className="w-full flex items-center justify-between text-xs py-1.5 px-2 bg-gray-800/40 rounded-lg hover:bg-gray-800 transition-colors text-left gap-2"
                            >
                              <div className="flex-1 min-w-0 flex items-center gap-2">
                                <span className="font-medium truncate">{i.name}</span>
                                {i.sold_at && (
                                  <span className="text-gray-600 flex-shrink-0">
                                    {new Date(i.sold_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-gray-400">{fmt$(i.sell_price!)}</span>
                                <span className={`font-semibold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {profit >= 0 ? "+" : ""}{fmt$(profit)}
                                </span>
                                <span className={`${roi >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                  {fmtPct(roi)}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                        {soldItems.length > 5 && (
                          <div className="text-xs text-gray-700 text-center py-1">
                            … and {soldItems.length - 5} more sold items
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

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
