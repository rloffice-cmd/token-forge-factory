-- =============================================================================
-- CollectPro — Storage bucket + Price history table
-- =============================================================================

-- ─── Storage: card images bucket ─────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'collectpro-images',
  'collectpro-images',
  true,
  131072,  -- 128 KB hard limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload/update/delete their own images
CREATE POLICY "collectpro_images_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'collectpro-images');

CREATE POLICY "collectpro_images_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'collectpro-images');

CREATE POLICY "collectpro_images_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'collectpro-images');

-- Public read (bucket is public so URLs work without auth)
CREATE POLICY "collectpro_images_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'collectpro-images');

-- ─── Layer 1: Price history ───────────────────────────────────────────────────
-- Append-only price data points per item.
-- Populated by:
--   • Market AI results (edge function writes when a price is found)
--   • Manual price updates from the client (sell / market estimate changes)

CREATE TABLE IF NOT EXISTS cp_price_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid NOT NULL REFERENCES coll_items(id) ON DELETE CASCADE,
  price      numeric(12, 2) NOT NULL,
  source     text NOT NULL DEFAULT 'manual', -- 'manual' | 'market_ai' | 'sell'
  note       text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup per item ordered by time
CREATE INDEX IF NOT EXISTS cp_price_history_item_time
  ON cp_price_history (item_id, recorded_at DESC);

-- RLS
ALTER TABLE cp_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cp_price_history_crud"
  ON cp_price_history FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Realtime for live chart updates
ALTER PUBLICATION supabase_realtime ADD TABLE cp_price_history;
