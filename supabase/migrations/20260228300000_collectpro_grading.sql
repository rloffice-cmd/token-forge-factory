-- =============================================================================
-- CollectPro — Professional Pre-Grading Assessment System
-- =============================================================================
--
-- cp_grading_assessments: stores AI-generated pre-grading reports per item.
--   • ai_grade        — predicted PSA-scale score (1.0–10.0)
--   • ai_subgrades    — centering, corners, edges, surfaces breakdown
--   • authenticity    — genuine | suspect | counterfeit
--   • actual_grade    — filled in when item returns from grading company
--   • grade_delta     — (actual_grade - ai_grade) — accuracy metric
-- =============================================================================

CREATE TABLE IF NOT EXISTS cp_grading_assessments (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id               uuid        REFERENCES coll_items(id) ON DELETE SET NULL,

  -- What was assessed
  item_type             text        NOT NULL DEFAULT 'card',   -- card | box | sealed | case | other
  item_name             text        NOT NULL DEFAULT '',

  -- AI prediction
  ai_grade              numeric(4,1),                          -- e.g. 9.5
  ai_grade_label        text,                                  -- e.g. 'Mint', 'Near Mint'
  ai_subgrades          jsonb,                                 -- { centering, corners, edges, surfaces }
  centering_analysis    jsonb,                                 -- { left_right, top_bottom, score }
  authenticity          text        DEFAULT 'genuine',         -- genuine | suspect | counterfeit
  authenticity_confidence numeric(5,2),                       -- 0–100 %
  authenticity_notes    text,
  issues                jsonb,                                 -- [{ category, severity, location, description }]
  summary               text,
  recommendations       text,

  -- Ground-truth (filled after item returns from PSA/BGS/CGC)
  actual_grade          numeric(4,1),
  actual_grader         text,                                  -- PSA | BGS | CGC | SGC | other
  grade_delta           numeric(4,1) GENERATED ALWAYS AS (actual_grade - ai_grade) STORED,

  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS cp_grading_item_id   ON cp_grading_assessments(item_id);
CREATE INDEX IF NOT EXISTS cp_grading_user_id   ON cp_grading_assessments(user_id);
CREATE INDEX IF NOT EXISTS cp_grading_created   ON cp_grading_assessments(created_at DESC);

-- RLS: users see only their own assessments; admins see all
ALTER TABLE cp_grading_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cp_grading_select"
  ON cp_grading_assessments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR cp_is_admin());

CREATE POLICY "cp_grading_insert"
  ON cp_grading_assessments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cp_grading_update"
  ON cp_grading_assessments FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR cp_is_admin());

CREATE POLICY "cp_grading_delete"
  ON cp_grading_assessments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR cp_is_admin());
