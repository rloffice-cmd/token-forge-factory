-- =============================================
-- AI Proof Service Payment System - Complete Schema
-- =============================================

-- 1) CUSTOMERS TABLE
CREATE TABLE public.users_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users_customers ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access to customers"
  ON public.users_customers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2) CREDIT WALLETS - Customer credit balance
CREATE TABLE public.credit_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.users_customers(id) ON DELETE CASCADE,
  credits_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT positive_balance CHECK (credits_balance >= 0)
);

-- Enable RLS
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to credit_wallets"
  ON public.credit_wallets
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_credit_wallets_updated_at
  BEFORE UPDATE ON public.credit_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3) PAYMENTS - Coinbase Commerce payments
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.users_customers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'coinbase_commerce',
  charge_id TEXT UNIQUE,
  charge_code TEXT,
  hosted_url TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  amount_usd NUMERIC NOT NULL,
  amount_eth NUMERIC,
  credits_purchased NUMERIC NOT NULL DEFAULT 0,
  pack_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_payment_status CHECK (status IN ('created', 'pending', 'confirmed', 'failed', 'expired'))
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to payments"
  ON public.payments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4) TREASURY SETTINGS - Separate Safe and Payout addresses
CREATE TABLE public.treasury_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treasury_safe_address TEXT,
  payout_wallet_address TEXT,
  network TEXT NOT NULL DEFAULT 'ethereum',
  min_withdrawal_eth NUMERIC NOT NULL DEFAULT 0.01,
  alert_threshold_dtf NUMERIC DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- CRITICAL: Safe and Payout cannot be the same address
  CONSTRAINT different_addresses CHECK (
    treasury_safe_address IS NULL OR 
    payout_wallet_address IS NULL OR 
    LOWER(treasury_safe_address) != LOWER(payout_wallet_address)
  )
);

-- Enable RLS
ALTER TABLE public.treasury_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to treasury_settings"
  ON public.treasury_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_treasury_settings_updated_at
  BEFORE UPDATE ON public.treasury_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5) CREDIT PACKS - Available purchase options
CREATE TABLE public.credit_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_he TEXT NOT NULL,
  credits NUMERIC NOT NULL,
  price_usd NUMERIC NOT NULL,
  description TEXT,
  description_he TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read credit_packs"
  ON public.credit_packs
  FOR SELECT
  USING (true);

-- Insert default packs
INSERT INTO public.credit_packs (id, name, name_he, credits, price_usd, description_he, features, is_popular) VALUES
  ('starter', 'Starter', 'התחלה', 100, 29, 'חבילת ניסיון לשירות ה-Proof', '["100 קרדיטים", "תמיכה במייל", "תוקף 30 יום"]'::jsonb, false),
  ('pro', 'Pro', 'מקצועי', 500, 99, 'החבילה הפופולרית ביותר', '["500 קרדיטים", "תמיכה בעדיפות", "תוקף 90 יום", "API גישה"]'::jsonb, true),
  ('business', 'Business', 'עסקי', 2000, 299, 'לעסקים עם נפח גבוה', '["2000 קרדיטים", "תמיכה 24/7", "תוקף שנה", "API גישה", "דוחות מתקדמים"]'::jsonb, false);

-- 6) Add customer_id to jobs table for tracking
ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.users_customers(id),
  ADD COLUMN IF NOT EXISTS cost_credits NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id);

-- 7) Update cashout_requests with more fields
ALTER TABLE public.cashout_requests
  ADD COLUMN IF NOT EXISTS to_wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS safe_address TEXT,
  ADD COLUMN IF NOT EXISTS safe_tx_hash TEXT;

-- 8) Create index for performance
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_charge_id ON public.payments(charge_id);
CREATE INDEX IF NOT EXISTS idx_credit_wallets_customer_id ON public.credit_wallets(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON public.jobs(customer_id);