// CollectPro — type definitions
// Fix Bug 5: sell_price now has ONE meaning only (actual sale price for sold items).
//            market_price is the separate field for market value estimates on active items.

export type ItemStatus = "active" | "grading" | "sold";
export type AIMode = "brain" | "market" | "arbitrage";
export type SortDirection = "asc" | "desc";

export interface Partner {
  id: string;
  name: string; // single canonical field — no עברית/אנגלית inconsistency
  email?: string;
  created_at: string;
}

export interface CollectionItem {
  id: string;
  name: string;
  card_set?: string;
  franchise?: string;
  condition?: string;

  // ── Financial fields ─────────────────────────────────────────────────────────
  buy_price: number;
  grading_cost: number;       // Bug fix: grading cost is now tracked → proper ROI
  market_price: number | null; // Bug fix: market estimate for active items (separate from sell_price)
  sell_price: number | null;   // Bug fix: ONLY set when status = 'sold'. Never used for estimates.

  // ── Dates ────────────────────────────────────────────────────────────────────
  buy_date: string;           // Bug fix: actual purchase date (not created_at)
  sold_at?: string;           // Bug fix: actual sale date

  // ── Status & ownership ───────────────────────────────────────────────────────
  status: ItemStatus;
  partner_id: string;

  // ── Optional metadata ────────────────────────────────────────────────────────
  image_url?: string;         // stored compressed (max ~100KB)
  notes?: string;
  psa_grade?: number;
  psa_submission_id?: string;

  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SortConfig {
  field: keyof CollectionItem;
  direction: SortDirection;
}

// Computed portfolio statistics — Bug fix: clear, honest definitions for each metric
export interface PortfolioStats {
  /** Sum of all buy_price + grading_cost across ALL items */
  totalInvestment: number;
  /** Sum of market_price (or buy_price fallback) for ACTIVE items only — labeled as estimate */
  portfolioEstimatedValue: number;
  /** Unrealised gain = portfolioEstimatedValue − cost of active items */
  unrealisedGain: number;
  /** Total sell_price received for SOLD items */
  realisedRevenue: number;
  /** Actual profit = realisedRevenue − (buy_price + grading_cost) of SOLD items */
  realisedProfit: number;
  /** ROI on sold items, including grading cost in denominator */
  realisedROI: number;
  activeCount: number;
  gradingCount: number;
  soldCount: number;
}

// Partner-scoped view of stats
export interface PartnerStats {
  partner: Partner;
  items: CollectionItem[];
  stats: PortfolioStats;
}

// Deleted item held in memory for undo (30 s window)
export interface DeletedItem {
  item: CollectionItem;
  deletedAt: number; // timestamp
}

export interface ItemFormData {
  name: string;
  card_set: string;
  franchise: string;
  condition: string;
  buy_price: string;
  grading_cost: string;
  market_price: string;
  buy_date: string;
  status: ItemStatus;
  partner_id: string;
  notes: string;
  image_url: string;
  psa_grade: string;
}
