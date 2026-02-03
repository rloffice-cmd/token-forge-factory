-- ============================================================
-- SECURITY FIX PART 2: Fix remaining permissive policies
-- Remove old public policies and replace with service role check
-- ============================================================

-- ========== failure_insights ==========
DROP POLICY IF EXISTS "Allow public insert failure_insights" ON public.failure_insights;

-- ========== growth_forecasts (old policy still exists) ==========
DROP POLICY IF EXISTS "Service role full access growth_forecasts" ON public.growth_forecasts;
DROP POLICY IF EXISTS "Service role full access to growth_forecasts" ON public.growth_forecasts;
CREATE POLICY "Service role full access to growth_forecasts" ON public.growth_forecasts
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== improvement_suggestions ==========
DROP POLICY IF EXISTS "Allow public insert improvement_suggestions" ON public.improvement_suggestions;
DROP POLICY IF EXISTS "Allow public update improvement_suggestions" ON public.improvement_suggestions;

-- ========== landing_variants (old policy) ==========
DROP POLICY IF EXISTS "Service role full access landing_variants" ON public.landing_variants;
DROP POLICY IF EXISTS "Service role full access to landing_variants" ON public.landing_variants;
CREATE POLICY "Service role full access to landing_variants" ON public.landing_variants
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== micro_consultations (old policy) ==========
DROP POLICY IF EXISTS "Service role full access micro_consultations" ON public.micro_consultations;
DROP POLICY IF EXISTS "Service role full access to micro_consultations" ON public.micro_consultations;
CREATE POLICY "Service role full access to micro_consultations" ON public.micro_consultations
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== notifications ==========
DROP POLICY IF EXISTS "Allow public insert notifications" ON public.notifications;

-- ========== optimization_events (old policy) ==========
DROP POLICY IF EXISTS "Service role full access optimization_events" ON public.optimization_events;
DROP POLICY IF EXISTS "Service role full access to optimization_events" ON public.optimization_events;
CREATE POLICY "Service role full access to optimization_events" ON public.optimization_events
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== outreach_jobs (lowercase naming) ==========
DROP POLICY IF EXISTS "service role full access outreach_jobs" ON public.outreach_jobs;
DROP POLICY IF EXISTS "Service role full access to outreach_jobs" ON public.outreach_jobs;
CREATE POLICY "Service role full access to outreach_jobs" ON public.outreach_jobs
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== outreach_limits (lowercase naming) ==========
DROP POLICY IF EXISTS "service role full access outreach_limits" ON public.outreach_limits;
DROP POLICY IF EXISTS "Service role full access to outreach_limits" ON public.outreach_limits;
CREATE POLICY "Service role full access to outreach_limits" ON public.outreach_limits
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== payments (old policy naming) ==========
DROP POLICY IF EXISTS "Service role full access to payments" ON public.payments;
DROP POLICY IF EXISTS "Service role only access to payments" ON public.payments;
CREATE POLICY "Service role only access to payments" ON public.payments
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== pricing_history (old policy) ==========
DROP POLICY IF EXISTS "Service role full access pricing_history" ON public.pricing_history;
DROP POLICY IF EXISTS "Service role full access to pricing_history" ON public.pricing_history;
CREATE POLICY "Service role full access to pricing_history" ON public.pricing_history
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== pricing_rules (old policy) ==========
DROP POLICY IF EXISTS "Service role full access pricing_rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Service role full access to pricing_rules" ON public.pricing_rules;
CREATE POLICY "Service role full access to pricing_rules" ON public.pricing_rules
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== scaling_rules ==========
DROP POLICY IF EXISTS "Allow public insert scaling_rules" ON public.scaling_rules;
DROP POLICY IF EXISTS "Allow public update scaling_rules" ON public.scaling_rules;

-- ========== service_catalog ==========
DROP POLICY IF EXISTS "Allow public insert service_catalog" ON public.service_catalog;
DROP POLICY IF EXISTS "Allow public update service_catalog" ON public.service_catalog;

-- ========== system_metrics ==========
DROP POLICY IF EXISTS "Allow public insert system_metrics" ON public.system_metrics;

-- ========== tasks ==========
DROP POLICY IF EXISTS "Allow public insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow public update tasks" ON public.tasks;

-- ========== treasury_ledger ==========
DROP POLICY IF EXISTS "Allow public insert treasury" ON public.treasury_ledger;

-- ========== treasury_wallet ==========
DROP POLICY IF EXISTS "Allow public insert treasury_wallet" ON public.treasury_wallet;