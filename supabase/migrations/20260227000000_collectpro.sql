-- =============================================================================
-- CollectPro — 3-Layer Architecture Schema
-- =============================================================================
--
-- Layer 1: Knowledge     → coll_items, coll_partners, cp_knowledge
-- Layer 2: Definitions   → cp_instructions (immutable), cp_instruction_patches
-- Layer 3: Logic         → Edge functions + React frontend (not in DB)
--
-- Design rules:
--   • Definitions layer: base rows are insert-only — a trigger blocks UPDATE/DELETE
--   • Patches layer: append-only — only active flag can flip, never deleted
--   • Knowledge layer: new rows deactivate old rows for the same key (no overwrite)
--   • Items: sell_price is ONLY set on sold items. market_price is estimate only.
--   • All PK values use gen_random_uuid() — no Math.random()
-- =============================================================================

-- ─── Layer 2: Definitions ────────────────────────────────────────────────────

-- Base instructions — inserted once at seed time, never modified
CREATE TABLE IF NOT EXISTS cp_instructions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text UNIQUE NOT NULL,   -- e.g. 'collectpro_brain'
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent any UPDATE or DELETE on base instructions (immutable core)
CREATE OR REPLACE FUNCTION cp_instructions_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'cp_instructions rows are immutable. Use cp_instruction_patches to extend behavior.';
END;
$$;

DROP TRIGGER IF EXISTS cp_instructions_no_update ON cp_instructions;
CREATE TRIGGER cp_instructions_no_update
  BEFORE UPDATE OR DELETE ON cp_instructions
  FOR EACH ROW EXECUTE FUNCTION cp_instructions_immutable();

-- Append-only patches — applied on top of base in version ASC order
CREATE TABLE IF NOT EXISTS cp_instruction_patches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_key text NOT NULL REFERENCES cp_instructions(key) ON DELETE RESTRICT,
  patch           text NOT NULL,
  version         int NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  author          text,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instruction_key, version)
);

-- ─── Layer 1: Knowledge ──────────────────────────────────────────────────────

-- Append-only market knowledge cache
-- Inserting a new row for an existing (type, key) auto-deactivates old rows
CREATE TABLE IF NOT EXISTS cp_knowledge (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL,     -- 'market_scan' | 'arbitrage' | 'portfolio_insight'
  key        text NOT NULL,     -- search term or card identifier
  content    text NOT NULL,
  metadata   jsonb NOT NULL DEFAULT '{}',
  version    int NOT NULL DEFAULT 1,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION cp_knowledge_deactivate_previous()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE cp_knowledge
  SET    active = false
  WHERE  type = NEW.type
    AND  key   = NEW.key
    AND  id   != NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cp_knowledge_append_only ON cp_knowledge;
CREATE TRIGGER cp_knowledge_append_only
  AFTER INSERT ON cp_knowledge
  FOR EACH ROW EXECUTE FUNCTION cp_knowledge_deactivate_previous();

-- ─── Layer 1: Items ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coll_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  card_set     text,
  franchise    text,
  condition    text NOT NULL DEFAULT 'NM',
  -- Financial: three distinct fields, no dual purpose
  buy_price    numeric(10,2) NOT NULL,
  grading_cost numeric(10,2) NOT NULL DEFAULT 0,
  market_price numeric(10,2),          -- market estimate for active items only
  sell_price   numeric(10,2),          -- confirmed sale price — only set when sold
  -- Dates
  buy_date     date NOT NULL DEFAULT CURRENT_DATE,
  sold_at      timestamptz,
  -- Status
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'grading', 'sold')),
  partner_id   uuid NOT NULL,
  -- Optional metadata
  image_url    text,
  notes        text,
  psa_grade    numeric(3,1),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION coll_items_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS coll_items_updated_at ON coll_items;
CREATE TRIGGER coll_items_updated_at
  BEFORE UPDATE ON coll_items
  FOR EACH ROW EXECUTE FUNCTION coll_items_set_updated_at();

-- ─── Layer 1: Partners ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coll_partners (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE cp_instructions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_instruction_patches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_knowledge            ENABLE ROW LEVEL SECURITY;
ALTER TABLE coll_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE coll_partners           ENABLE ROW LEVEL SECURITY;

-- Definitions layer: read-only from client; writes only via service role (edge fn)
CREATE POLICY "cp_instructions_read"
  ON cp_instructions FOR SELECT TO authenticated USING (true);

CREATE POLICY "cp_patches_read"
  ON cp_instruction_patches FOR SELECT TO authenticated USING (true);

-- Knowledge layer: read from client, insert via edge function (service role)
CREATE POLICY "cp_knowledge_read"
  ON cp_knowledge FOR SELECT TO authenticated USING (true);

-- Items + partners: full CRUD for authenticated users
CREATE POLICY "coll_items_crud"
  ON coll_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "coll_partners_crud"
  ON coll_partners FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Realtime on knowledge layer (event bus for market cache)
ALTER PUBLICATION supabase_realtime ADD TABLE coll_items;
ALTER PUBLICATION supabase_realtime ADD TABLE coll_partners;
ALTER PUBLICATION supabase_realtime ADD TABLE cp_knowledge;
