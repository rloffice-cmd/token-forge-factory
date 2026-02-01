-- =============================================
-- SMART SYSTEM INFRASTRUCTURE
-- Continuous Improvement & Autonomous Expansion
-- =============================================

-- 1. SYSTEM METRICS - Time-series KPI tracking
CREATE TABLE public.system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'gauge', -- gauge, counter, histogram
  dimensions JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_metrics_name_time ON public.system_metrics(metric_name, recorded_at DESC);
CREATE INDEX idx_system_metrics_type ON public.system_metrics(metric_type);

ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read system_metrics" ON public.system_metrics
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert system_metrics" ON public.system_metrics
  FOR INSERT WITH CHECK (true);

-- 2. IMPROVEMENT SUGGESTIONS - AI-generated optimization proposals
CREATE TABLE public.improvement_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- 'failure_analysis', 'metrics_anomaly', 'feedback', 'meta_learning'
  category TEXT NOT NULL, -- 'prompt', 'code', 'config', 'scaling', 'ux'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB DEFAULT '{}',
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, implemented, rejected
  confidence NUMERIC DEFAULT 0.7,
  implemented_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_improvement_suggestions_status ON public.improvement_suggestions(status);
CREATE INDEX idx_improvement_suggestions_priority ON public.improvement_suggestions(priority);

ALTER TABLE public.improvement_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read improvement_suggestions" ON public.improvement_suggestions
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert improvement_suggestions" ON public.improvement_suggestions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update improvement_suggestions" ON public.improvement_suggestions
  FOR UPDATE USING (true);

-- 3. SERVICE CATALOG - Dynamic service registry
CREATE TABLE public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'ai', 'data', 'integration', 'analytics'
  status TEXT NOT NULL DEFAULT 'planned', -- planned, development, active, deprecated
  config JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}', -- usage stats, performance
  discovered_by TEXT, -- 'manual', 'ai_suggestion', 'market_analysis'
  launched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_catalog_status ON public.service_catalog(status);
CREATE INDEX idx_service_catalog_category ON public.service_catalog(category);

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read service_catalog" ON public.service_catalog
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert service_catalog" ON public.service_catalog
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update service_catalog" ON public.service_catalog
  FOR UPDATE USING (true);

-- 4. SCALING RULES - Automated resource adjustment
CREATE TABLE public.scaling_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  trigger_condition TEXT NOT NULL, -- e.g., 'job_queue_depth > 100'
  action_type TEXT NOT NULL, -- 'scale_up', 'scale_down', 'alert', 'optimize'
  action_config JSONB NOT NULL DEFAULT '{}',
  cooldown_minutes INTEGER DEFAULT 15,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scaling_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read scaling_rules" ON public.scaling_rules
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert scaling_rules" ON public.scaling_rules
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update scaling_rules" ON public.scaling_rules
  FOR UPDATE USING (true);

-- 5. Trigger for updated_at on service_catalog
CREATE TRIGGER update_service_catalog_updated_at
  BEFORE UPDATE ON public.service_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Seed initial services
INSERT INTO public.service_catalog (service_key, name, description, category, status, discovered_by) VALUES
  ('signal-wallet', 'Wallet Risk Analysis', 'Real-time wallet risk scoring API', 'ai', 'active', 'manual'),
  ('signal-contract', 'Contract Analysis', 'Smart contract security analysis', 'ai', 'active', 'manual'),
  ('lead-hunter', 'Lead Discovery', 'Automated prospect identification', 'data', 'active', 'manual');

-- 7. Seed initial scaling rules
INSERT INTO public.scaling_rules (rule_name, trigger_condition, action_type, action_config) VALUES
  ('high_queue_alert', 'job_queue_depth > 50', 'alert', '{"channel": "telegram", "message": "High queue depth detected"}'),
  ('error_rate_alert', 'error_rate_1h > 0.05', 'alert', '{"channel": "telegram", "message": "Error rate exceeded 5%"}');