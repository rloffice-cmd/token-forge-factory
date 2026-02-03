-- ============================================================
-- SECURITY FIX: Convert all service-role-only RLS policies
-- from USING (true) to explicit service_role check
-- This blocks anon/public access while allowing Edge Functions
-- ============================================================

-- ========== actor_lead_links ==========
DROP POLICY IF EXISTS "Service role full access to actor_lead_links" ON public.actor_lead_links;
CREATE POLICY "Service role full access to actor_lead_links" ON public.actor_lead_links
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== actor_profiles ==========
DROP POLICY IF EXISTS "Service role full access to actor_profiles" ON public.actor_profiles;
CREATE POLICY "Service role full access to actor_profiles" ON public.actor_profiles
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== affiliate_clicks ==========
DROP POLICY IF EXISTS "Service role full access to affiliate_clicks" ON public.affiliate_clicks;
CREATE POLICY "Service role full access to affiliate_clicks" ON public.affiliate_clicks
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== affiliate_content ==========
DROP POLICY IF EXISTS "Service role full access to affiliate_content" ON public.affiliate_content;
CREATE POLICY "Service role full access to affiliate_content" ON public.affiliate_content
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== affiliate_earnings ==========
DROP POLICY IF EXISTS "Service role full access to affiliate_earnings" ON public.affiliate_earnings;
CREATE POLICY "Service role full access to affiliate_earnings" ON public.affiliate_earnings
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== affiliate_programs ==========
DROP POLICY IF EXISTS "Service role full access to affiliate_programs" ON public.affiliate_programs;
CREATE POLICY "Service role full access to affiliate_programs" ON public.affiliate_programs
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== agent_catalog ==========
DROP POLICY IF EXISTS "Service role full access to agent_catalog" ON public.agent_catalog;
CREATE POLICY "Service role full access to agent_catalog" ON public.agent_catalog
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== agent_orders ==========
DROP POLICY IF EXISTS "Service role full access to agent_orders" ON public.agent_orders;
CREATE POLICY "Service role full access to agent_orders" ON public.agent_orders
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== api_key_deliveries ==========
DROP POLICY IF EXISTS "Service role full access to api_key_deliveries" ON public.api_key_deliveries;
CREATE POLICY "Service role full access to api_key_deliveries" ON public.api_key_deliveries
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== api_keys ==========
DROP POLICY IF EXISTS "Service role only access to api_keys" ON public.api_keys;
CREATE POLICY "Service role only access to api_keys" ON public.api_keys
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== api_requests ==========
DROP POLICY IF EXISTS "Service role full access to api_requests" ON public.api_requests;
CREATE POLICY "Service role full access to api_requests" ON public.api_requests
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== artifacts ==========
DROP POLICY IF EXISTS "Allow public insert artifacts" ON public.artifacts;
CREATE POLICY "Service role insert artifacts" ON public.artifacts
  FOR INSERT WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== audit_logs ==========
DROP POLICY IF EXISTS "Allow public insert audit_logs" ON public.audit_logs;
CREATE POLICY "Service role insert audit_logs" ON public.audit_logs
  FOR INSERT WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== auto_offer_rules ==========
DROP POLICY IF EXISTS "Service role full access to auto_offer_rules" ON public.auto_offer_rules;
CREATE POLICY "Service role full access to auto_offer_rules" ON public.auto_offer_rules
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== brain_metrics_daily ==========
DROP POLICY IF EXISTS "Service role full access brain_metrics_daily" ON public.brain_metrics_daily;
CREATE POLICY "Service role full access brain_metrics_daily" ON public.brain_metrics_daily
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== brain_settings ==========
DROP POLICY IF EXISTS "Service role full access to brain_settings" ON public.brain_settings;
CREATE POLICY "Service role full access to brain_settings" ON public.brain_settings
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== campaign_experiments ==========
DROP POLICY IF EXISTS "Service role full access to campaign_experiments" ON public.campaign_experiments;
CREATE POLICY "Service role full access to campaign_experiments" ON public.campaign_experiments
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== cashout_requests ==========
DROP POLICY IF EXISTS "Allow public insert cashout_requests" ON public.cashout_requests;
DROP POLICY IF EXISTS "Allow public update cashout_requests" ON public.cashout_requests;
CREATE POLICY "Service role insert cashout_requests" ON public.cashout_requests
  FOR INSERT WITH CHECK ((current_setting('role'::text) = 'service_role'::text));
CREATE POLICY "Service role update cashout_requests" ON public.cashout_requests
  FOR UPDATE USING ((current_setting('role'::text) = 'service_role'::text));

-- ========== closing_attempts ==========
DROP POLICY IF EXISTS "Service role full access to closing_attempts" ON public.closing_attempts;
CREATE POLICY "Service role full access to closing_attempts" ON public.closing_attempts
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== content_queue ==========
DROP POLICY IF EXISTS "Service role full access to content_queue" ON public.content_queue;
CREATE POLICY "Service role full access to content_queue" ON public.content_queue
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== credit_events ==========
DROP POLICY IF EXISTS "Service role full access to credit_events" ON public.credit_events;
CREATE POLICY "Service role full access to credit_events" ON public.credit_events
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== credit_wallets ==========
DROP POLICY IF EXISTS "Service role full access to credit_wallets" ON public.credit_wallets;
CREATE POLICY "Service role full access to credit_wallets" ON public.credit_wallets
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== customer_dna ==========
DROP POLICY IF EXISTS "Service role full access to customer_dna" ON public.customer_dna;
CREATE POLICY "Service role full access to customer_dna" ON public.customer_dna
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== decision_traces ==========
DROP POLICY IF EXISTS "Service role full access to decision_traces" ON public.decision_traces;
CREATE POLICY "Service role full access to decision_traces" ON public.decision_traces
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== demand_signals ==========
DROP POLICY IF EXISTS "Service role full access to demand_signals" ON public.demand_signals;
CREATE POLICY "Service role full access to demand_signals" ON public.demand_signals
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== denylist ==========
DROP POLICY IF EXISTS "Service role full access to denylist" ON public.denylist;
CREATE POLICY "Service role full access to denylist" ON public.denylist
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== digital_products ==========
DROP POLICY IF EXISTS "Service role full access digital_products" ON public.digital_products;
CREATE POLICY "Service role full access digital_products" ON public.digital_products
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== digital_purchases ==========
DROP POLICY IF EXISTS "Service role full access digital_purchases" ON public.digital_purchases;
CREATE POLICY "Service role full access digital_purchases" ON public.digital_purchases
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== engine_config ==========
DROP POLICY IF EXISTS "Service role full access to engine_config" ON public.engine_config;
CREATE POLICY "Service role full access to engine_config" ON public.engine_config
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== failure_insights ==========
DROP POLICY IF EXISTS "Service role full access to failure_insights" ON public.failure_insights;
CREATE POLICY "Service role full access to failure_insights" ON public.failure_insights
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== free_value_events ==========
DROP POLICY IF EXISTS "Service role full access to free_value_events" ON public.free_value_events;
CREATE POLICY "Service role full access to free_value_events" ON public.free_value_events
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== fulfillment_jobs ==========
DROP POLICY IF EXISTS "Service role full access to fulfillment_jobs" ON public.fulfillment_jobs;
CREATE POLICY "Service role full access to fulfillment_jobs" ON public.fulfillment_jobs
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== growth_forecasts ==========
DROP POLICY IF EXISTS "Service role full access to growth_forecasts" ON public.growth_forecasts;
CREATE POLICY "Service role full access to growth_forecasts" ON public.growth_forecasts
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== guardian_offers ==========
DROP POLICY IF EXISTS "Service role full access to guardian_offers" ON public.guardian_offers;
CREATE POLICY "Service role full access to guardian_offers" ON public.guardian_offers
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== improvement_suggestions ==========
DROP POLICY IF EXISTS "Service role full access to improvement_suggestions" ON public.improvement_suggestions;
CREATE POLICY "Service role full access to improvement_suggestions" ON public.improvement_suggestions
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== jobs ==========
DROP POLICY IF EXISTS "Allow public insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow public update jobs" ON public.jobs;
CREATE POLICY "Service role insert jobs" ON public.jobs
  FOR INSERT WITH CHECK ((current_setting('role'::text) = 'service_role'::text));
CREATE POLICY "Service role update jobs" ON public.jobs
  FOR UPDATE USING ((current_setting('role'::text) = 'service_role'::text));

-- ========== landing_variants ==========
DROP POLICY IF EXISTS "Service role full access to landing_variants" ON public.landing_variants;
CREATE POLICY "Service role full access to landing_variants" ON public.landing_variants
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== leads ==========
DROP POLICY IF EXISTS "Service role full access to leads" ON public.leads;
CREATE POLICY "Service role full access to leads" ON public.leads
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== learning_events ==========
DROP POLICY IF EXISTS "Service role full access to learning_events" ON public.learning_events;
CREATE POLICY "Service role full access to learning_events" ON public.learning_events
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== marketing_insights ==========
DROP POLICY IF EXISTS "Service role full access to marketing_insights" ON public.marketing_insights;
CREATE POLICY "Service role full access to marketing_insights" ON public.marketing_insights
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== message_performance ==========
DROP POLICY IF EXISTS "Service role full access to message_performance" ON public.message_performance;
CREATE POLICY "Service role full access to message_performance" ON public.message_performance
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== micro_consultations ==========
DROP POLICY IF EXISTS "Service role full access to micro_consultations" ON public.micro_consultations;
CREATE POLICY "Service role full access to micro_consultations" ON public.micro_consultations
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== micro_events ==========
DROP POLICY IF EXISTS "Service role full access to micro_events" ON public.micro_events;
CREATE POLICY "Service role full access to micro_events" ON public.micro_events
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== micro_pricing ==========
DROP POLICY IF EXISTS "Service role full access to micro_pricing" ON public.micro_pricing;
CREATE POLICY "Service role full access to micro_pricing" ON public.micro_pricing
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== micro_rate_limits ==========
DROP POLICY IF EXISTS "Service role full access to micro_rate_limits" ON public.micro_rate_limits;
CREATE POLICY "Service role full access to micro_rate_limits" ON public.micro_rate_limits
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== notifications ==========
DROP POLICY IF EXISTS "Service role full access to notifications" ON public.notifications;
CREATE POLICY "Service role full access to notifications" ON public.notifications
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== offer_sources ==========
DROP POLICY IF EXISTS "Service role full access to offer_sources" ON public.offer_sources;
CREATE POLICY "Service role full access to offer_sources" ON public.offer_sources
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== offers ==========
DROP POLICY IF EXISTS "Service role full access to offers" ON public.offers;
CREATE POLICY "Service role full access to offers" ON public.offers
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== opportunities ==========
DROP POLICY IF EXISTS "Service role full access to opportunities" ON public.opportunities;
CREATE POLICY "Service role full access to opportunities" ON public.opportunities
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== optimization_events ==========
DROP POLICY IF EXISTS "Service role full access to optimization_events" ON public.optimization_events;
CREATE POLICY "Service role full access to optimization_events" ON public.optimization_events
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== outreach_jobs ==========
DROP POLICY IF EXISTS "Service role full access to outreach_jobs" ON public.outreach_jobs;
CREATE POLICY "Service role full access to outreach_jobs" ON public.outreach_jobs
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== outreach_limits ==========
DROP POLICY IF EXISTS "Service role full access to outreach_limits" ON public.outreach_limits;
CREATE POLICY "Service role full access to outreach_limits" ON public.outreach_limits
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== outreach_queue ==========
DROP POLICY IF EXISTS "Service role full access to outreach_queue" ON public.outreach_queue;
CREATE POLICY "Service role full access to outreach_queue" ON public.outreach_queue
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== pain_scores ==========
DROP POLICY IF EXISTS "Service role full access to pain_scores" ON public.pain_scores;
CREATE POLICY "Service role full access to pain_scores" ON public.pain_scores
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== patch_proposals ==========
DROP POLICY IF EXISTS "Service role full access to patch_proposals" ON public.patch_proposals;
CREATE POLICY "Service role full access to patch_proposals" ON public.patch_proposals
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== payments ==========
DROP POLICY IF EXISTS "Service role only access to payments" ON public.payments;
CREATE POLICY "Service role only access to payments" ON public.payments
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== pricing_history ==========
DROP POLICY IF EXISTS "Service role full access to pricing_history" ON public.pricing_history;
CREATE POLICY "Service role full access to pricing_history" ON public.pricing_history
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== pricing_rules ==========
DROP POLICY IF EXISTS "Service role full access to pricing_rules" ON public.pricing_rules;
CREATE POLICY "Service role full access to pricing_rules" ON public.pricing_rules
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== rate_limits ==========
DROP POLICY IF EXISTS "Service role full access to rate_limits" ON public.rate_limits;
CREATE POLICY "Service role full access to rate_limits" ON public.rate_limits
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== scaling_rules ==========
DROP POLICY IF EXISTS "Service role full access to scaling_rules" ON public.scaling_rules;
CREATE POLICY "Service role full access to scaling_rules" ON public.scaling_rules
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== self_audit_runs ==========
DROP POLICY IF EXISTS "Service role full access to self_audit_runs" ON public.self_audit_runs;
CREATE POLICY "Service role full access to self_audit_runs" ON public.self_audit_runs
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== self_heal_flags ==========
DROP POLICY IF EXISTS "Service role full access to self_heal_flags" ON public.self_heal_flags;
CREATE POLICY "Service role full access to self_heal_flags" ON public.self_heal_flags
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== self_heal_patches ==========
DROP POLICY IF EXISTS "Service role full access to self_heal_patches" ON public.self_heal_patches;
CREATE POLICY "Service role full access to self_heal_patches" ON public.self_heal_patches
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== self_heal_policies ==========
DROP POLICY IF EXISTS "Service role full access to self_heal_policies" ON public.self_heal_policies;
CREATE POLICY "Service role full access to self_heal_policies" ON public.self_heal_policies
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== self_heal_runs ==========
DROP POLICY IF EXISTS "Service role full access to self_heal_runs" ON public.self_heal_runs;
CREATE POLICY "Service role full access to self_heal_runs" ON public.self_heal_runs
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== service_catalog ==========
DROP POLICY IF EXISTS "Service role full access to service_catalog" ON public.service_catalog;
CREATE POLICY "Service role full access to service_catalog" ON public.service_catalog
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== session_events ==========
DROP POLICY IF EXISTS "Service role full access to session_events" ON public.session_events;
CREATE POLICY "Service role full access to session_events" ON public.session_events
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== source_discovery_queue ==========
DROP POLICY IF EXISTS "Service role full access to source_discovery_queue" ON public.source_discovery_queue;
CREATE POLICY "Service role full access to source_discovery_queue" ON public.source_discovery_queue
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== swap_orders ==========
DROP POLICY IF EXISTS "Service role full access to swap_orders" ON public.swap_orders;
CREATE POLICY "Service role full access to swap_orders" ON public.swap_orders
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== system_metrics ==========
DROP POLICY IF EXISTS "Service role full access to system_metrics" ON public.system_metrics;
CREATE POLICY "Service role full access to system_metrics" ON public.system_metrics
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== tasks ==========
DROP POLICY IF EXISTS "Service role full access to tasks" ON public.tasks;
CREATE POLICY "Service role full access to tasks" ON public.tasks
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== treasury_balances ==========
DROP POLICY IF EXISTS "Service role full access to treasury_balances" ON public.treasury_balances;
CREATE POLICY "Service role full access to treasury_balances" ON public.treasury_balances
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== treasury_ledger ==========
DROP POLICY IF EXISTS "Service role full access to treasury_ledger" ON public.treasury_ledger;
CREATE POLICY "Service role full access to treasury_ledger" ON public.treasury_ledger
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== treasury_routes ==========
DROP POLICY IF EXISTS "Service role full access to treasury_routes" ON public.treasury_routes;
CREATE POLICY "Service role full access to treasury_routes" ON public.treasury_routes
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== treasury_settings ==========
DROP POLICY IF EXISTS "Service role full access to treasury_settings" ON public.treasury_settings;
CREATE POLICY "Service role full access to treasury_settings" ON public.treasury_settings
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== treasury_wallet ==========
DROP POLICY IF EXISTS "Service role full access to treasury_wallet" ON public.treasury_wallet;
CREATE POLICY "Service role full access to treasury_wallet" ON public.treasury_wallet
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== users_customers ==========
DROP POLICY IF EXISTS "Service role only access to users_customers" ON public.users_customers;
CREATE POLICY "Service role only access to users_customers" ON public.users_customers
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== webhook_endpoints ==========
DROP POLICY IF EXISTS "Service role full access to webhook_endpoints" ON public.webhook_endpoints;
CREATE POLICY "Service role full access to webhook_endpoints" ON public.webhook_endpoints
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== webhook_events ==========
DROP POLICY IF EXISTS "Service role full access to webhook_events" ON public.webhook_events;
CREATE POLICY "Service role full access to webhook_events" ON public.webhook_events
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));

-- ========== zerodev_sessions ==========
DROP POLICY IF EXISTS "Service role full access to zerodev_sessions" ON public.zerodev_sessions;
CREATE POLICY "Service role full access to zerodev_sessions" ON public.zerodev_sessions
  FOR ALL USING ((current_setting('role'::text) = 'service_role'::text)) 
  WITH CHECK ((current_setting('role'::text) = 'service_role'::text));