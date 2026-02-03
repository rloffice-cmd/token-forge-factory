-- ============================================================
-- SECURITY FIX PART 3: Remove remaining public SELECT policies
-- ============================================================

-- ========== cashout_requests (remove public read) ==========
DROP POLICY IF EXISTS "Allow public read cashout_requests" ON public.cashout_requests;
CREATE POLICY "Service role read cashout_requests" ON public.cashout_requests
  FOR SELECT USING ((current_setting('role'::text) = 'service_role'::text));

-- ========== treasury_ledger (remove public read) ==========
DROP POLICY IF EXISTS "Allow public read treasury" ON public.treasury_ledger;
CREATE POLICY "Service role read treasury_ledger" ON public.treasury_ledger
  FOR SELECT USING ((current_setting('role'::text) = 'service_role'::text));

-- ========== jobs (restrict to service role) ==========
DROP POLICY IF EXISTS "Allow public read jobs" ON public.jobs;
CREATE POLICY "Service role read jobs" ON public.jobs
  FOR SELECT USING ((current_setting('role'::text) = 'service_role'::text));

-- ========== audit_logs (restrict to service role) ==========
DROP POLICY IF EXISTS "Allow public read audit_logs" ON public.audit_logs;
CREATE POLICY "Service role read audit_logs" ON public.audit_logs
  FOR SELECT USING ((current_setting('role'::text) = 'service_role'::text));

-- ========== artifacts (restrict to service role) ==========
DROP POLICY IF EXISTS "Allow public read artifacts" ON public.artifacts;
CREATE POLICY "Service role read artifacts" ON public.artifacts
  FOR SELECT USING ((current_setting('role'::text) = 'service_role'::text));