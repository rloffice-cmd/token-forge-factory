-- =============================================================================
-- CollectPro — Multi-user access control
-- =============================================================================
--
-- Architecture:
--   cp_users_public        — cache of known users (populated on first login)
--   cp_admins              — admin registry (insert first admin via SQL)
--   cp_user_partner_access — user ↔ partner mapping (admin grants/revokes)
--
-- RLS design:
--   • Admin sees EVERYTHING (items, partners, users, access rows)
--   • Regular user sees ONLY items/partners they're mapped to
--   • Trigger auto-grants creator access when a partner is created
--
-- To add the first admin after deployment:
--   1. User signs up / logs in at your app
--   2. In Supabase Dashboard → Authentication → Users → copy their UUID
--   3. Run: INSERT INTO cp_admins (user_id) VALUES ('<uuid>');
-- =============================================================================

-- ─── Public user registry ────────────────────────────────────────────────────
-- Populated by the client on each login. Allows admin to look up users by email.

CREATE TABLE IF NOT EXISTS cp_users_public (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  display_name text,
  last_seen    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cp_users_public ENABLE ROW LEVEL SECURITY;

-- Users can upsert their own row; admin can read all
CREATE POLICY "cp_users_public_self"
  ON cp_users_public FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "cp_users_public_admin_read"
  ON cp_users_public FOR SELECT TO authenticated
  USING (cp_is_admin());

-- ─── Admin registry ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cp_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cp_admins ENABLE ROW LEVEL SECURITY;

-- ─── Admin check function (SECURITY DEFINER bypasses RLS) ────────────────────

CREATE OR REPLACE FUNCTION cp_is_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM cp_admins WHERE user_id = uid);
$$;

-- Admins can read + manage the admin table
CREATE POLICY "cp_admins_read"
  ON cp_admins FOR SELECT TO authenticated USING (cp_is_admin());

CREATE POLICY "cp_admins_write"
  ON cp_admins FOR ALL TO authenticated
  USING (cp_is_admin()) WITH CHECK (cp_is_admin());

-- ─── User ↔ Partner access mapping ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cp_user_partner_access (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES coll_partners(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner_id)
);

ALTER TABLE cp_user_partner_access ENABLE ROW LEVEL SECURITY;

-- Users see their own access rows; admins see all
CREATE POLICY "cp_access_read"
  ON cp_user_partner_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR cp_is_admin());

-- Only admins can grant or revoke access
CREATE POLICY "cp_access_write"
  ON cp_user_partner_access FOR ALL TO authenticated
  USING (cp_is_admin()) WITH CHECK (cp_is_admin());

-- ─── Auto-grant creator access when a partner is created ─────────────────────

CREATE OR REPLACE FUNCTION cp_auto_grant_creator_access()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO cp_user_partner_access (user_id, partner_id, granted_by)
  VALUES (auth.uid(), NEW.id, auth.uid())
  ON CONFLICT (user_id, partner_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cp_partner_creator_access ON coll_partners;
CREATE TRIGGER cp_partner_creator_access
  AFTER INSERT ON coll_partners
  FOR EACH ROW EXECUTE FUNCTION cp_auto_grant_creator_access();

-- ─── Harden coll_partners RLS ────────────────────────────────────────────────

DROP POLICY IF EXISTS "coll_partners_crud" ON coll_partners;

-- Admin sees all; user sees only assigned partners
CREATE POLICY "coll_partners_select"
  ON coll_partners FOR SELECT TO authenticated
  USING (
    cp_is_admin() OR
    EXISTS (
      SELECT 1 FROM cp_user_partner_access
      WHERE partner_id = coll_partners.id AND user_id = auth.uid()
    )
  );

-- Only admin can create partners (trigger auto-grants them access)
CREATE POLICY "coll_partners_insert"
  ON coll_partners FOR INSERT TO authenticated
  WITH CHECK (cp_is_admin());

-- Admin or assigned user can update partner metadata
CREATE POLICY "coll_partners_update"
  ON coll_partners FOR UPDATE TO authenticated
  USING (
    cp_is_admin() OR
    EXISTS (
      SELECT 1 FROM cp_user_partner_access
      WHERE partner_id = coll_partners.id AND user_id = auth.uid()
    )
  );

-- Only admin can delete partners
CREATE POLICY "coll_partners_delete"
  ON coll_partners FOR DELETE TO authenticated
  USING (cp_is_admin());

-- ─── Harden coll_items RLS ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "coll_items_crud" ON coll_items;

CREATE POLICY "coll_items_select"
  ON coll_items FOR SELECT TO authenticated
  USING (
    cp_is_admin() OR
    EXISTS (
      SELECT 1 FROM cp_user_partner_access
      WHERE partner_id = coll_items.partner_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "coll_items_insert"
  ON coll_items FOR INSERT TO authenticated
  WITH CHECK (
    cp_is_admin() OR
    EXISTS (
      SELECT 1 FROM cp_user_partner_access
      WHERE partner_id = coll_items.partner_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "coll_items_update"
  ON coll_items FOR UPDATE TO authenticated
  USING (
    cp_is_admin() OR
    EXISTS (
      SELECT 1 FROM cp_user_partner_access
      WHERE partner_id = coll_items.partner_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "coll_items_delete"
  ON coll_items FOR DELETE TO authenticated
  USING (
    cp_is_admin() OR
    EXISTS (
      SELECT 1 FROM cp_user_partner_access
      WHERE partner_id = coll_items.partner_id AND user_id = auth.uid()
    )
  );
