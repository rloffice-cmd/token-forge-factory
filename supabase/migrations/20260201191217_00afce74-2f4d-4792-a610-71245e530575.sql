-- Pricing optimization history table
CREATE TABLE public.pricing_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_type TEXT NOT NULL, -- 'credit_pack', 'agent', 'digital_product', 'micro_sensor'
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  old_price_usd NUMERIC NOT NULL,
  new_price_usd NUMERIC NOT NULL,
  change_percent NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  ai_confidence NUMERIC DEFAULT 0.7,
  metrics_snapshot JSONB DEFAULT '{}'::jsonb,
  performance_after JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  measured_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_successful BOOLEAN DEFAULT NULL
);

-- Pricing rules and constraints
CREATE TABLE public.pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_type TEXT NOT NULL,
  min_price_usd NUMERIC NOT NULL DEFAULT 1,
  max_price_usd NUMERIC NOT NULL DEFAULT 10000,
  max_change_percent NUMERIC NOT NULL DEFAULT 25,
  optimization_goal TEXT NOT NULL DEFAULT 'revenue', -- 'revenue', 'volume', 'margin'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- Service role access
CREATE POLICY "Service role full access pricing_history" ON public.pricing_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access pricing_rules" ON public.pricing_rules FOR ALL USING (true) WITH CHECK (true);

-- Insert default pricing rules
INSERT INTO public.pricing_rules (product_type, min_price_usd, max_price_usd, max_change_percent, optimization_goal) VALUES
  ('credit_pack', 9, 999, 20, 'revenue'),
  ('agent', 49, 499, 15, 'revenue'),
  ('digital_product', 5, 299, 20, 'volume'),
  ('micro_sensor', 0.01, 10, 30, 'volume');

-- Add trigger for updated_at
CREATE TRIGGER update_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();