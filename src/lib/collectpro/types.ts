// ─────────────────────────────────────────────────────────────────────────────
// CollectPro — TypeScript types (Layer 1 & 2 contracts + UI)
// ─────────────────────────────────────────────────────────────────────────────

// ── Layer 2: Definitions ────────────────────────────────────────────────────

export interface Instruction {
  id: string;
  key: string;
  content: string;
  created_at: string;
}

export interface InstructionPatch {
  id: string;
  instruction_key: string;
  patch: string;
  version: number;
  active: boolean;
  author?: string;
  reason?: string;
  created_at: string;
}

// ── Layer 1: Knowledge ──────────────────────────────────────────────────────

export interface Knowledge {
  id: string;
  type: "market_scan" | "arbitrage" | "portfolio_insight";
  key: string;
  content: string;
  metadata: Record<string, unknown>;
  version: number;
  active: boolean;
  created_at: string;
}

// ── Layer 1: Core data ───────────────────────────────────────────────────────

export type ItemStatus = "active" | "grading" | "sold";
export type AIMode     = "brain" | "market" | "arbitrage";
export type SortDir    = "asc" | "desc";
export type Tab        = "brain" | "inventory" | "roi" | "arena" | "market" | "partners" | "admin" | "grade";
export type ViewMode   = "table" | "cards";

export interface Partner {
  id: string;
  name: string;
  email?: string;
  created_at: string;
}

export interface CollectionItem {
  id: string;
  name: string;
  card_set?: string;
  franchise?: string;
  condition: string;

  // Financial — three distinct fields, each with ONE meaning
  buy_price: number;
  grading_cost: number;
  market_price: number | null;  // estimate for active/grading items
  sell_price: number | null;    // confirmed sale price — only when status='sold'

  // Dates
  buy_date: string;
  sold_at?: string;

  status: ItemStatus;
  partner_id: string;
  image_url?: string;
  notes?: string;
  psa_grade?: number;
  created_at: string;
  updated_at: string;
}

// ── UI types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SortConfig {
  field: keyof CollectionItem | "__pnl__";
  dir: SortDir;
}

export interface ItemForm {
  name: string;
  card_set: string;
  franchise: string;
  condition: string;
  buy_price: string;
  grading_cost: string;
  market_price: string;
  sell_price: string;
  sold_at: string;
  buy_date: string;
  status: ItemStatus;
  partner_id: string;
  notes: string;
  image_url: string;
  psa_grade: string;
}

// ── Computed stats — honest definitions ──────────────────────────────────────

export interface PortfolioStats {
  /** Total spent = sum(buy_price + grading_cost) across ALL items */
  totalCost: number;
  /** Market estimate for ACTIVE items only (market_price ?? buy_price) */
  estimatedValue: number;
  /** estimatedValue - cost of active items */
  unrealisedPnL: number;
  /** Sum of sell_price for SOLD items */
  realisedRevenue: number;
  /** realisedRevenue - cost of SOLD items (incl. grading) */
  realisedProfit: number;
  /** realisedProfit / soldCost × 100 */
  roiPct: number;
  activeCount: number;
  gradingCount: number;
  soldCount: number;
}

// ── Price history point (for Evolution Chart) ────────────────────────────────

export interface PricePoint {
  month: string;
  value: number;
}

export interface UndoBuffer {
  item: CollectionItem;
  at: number;
}
