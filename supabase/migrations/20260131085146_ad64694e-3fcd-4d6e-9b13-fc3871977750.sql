-- Add on-chain payment tracking columns to treasury_ledger
ALTER TABLE public.treasury_ledger 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ETH',
ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id),
ADD COLUMN IF NOT EXISTS payer_email TEXT,
ADD COLUMN IF NOT EXISTS charge_code TEXT,
ADD COLUMN IF NOT EXISTS network TEXT DEFAULT 'ethereum';

-- Create a payments_confirmed view for dashboard
CREATE OR REPLACE VIEW public.confirmed_payments AS
SELECT 
  p.id,
  p.amount_eth,
  p.amount_usd,
  p.credits_purchased,
  p.charge_id,
  p.charge_code,
  p.provider,
  p.confirmed_at,
  p.created_at,
  c.email as customer_email
FROM public.payments p
LEFT JOIN public.users_customers c ON p.customer_id = c.id
WHERE p.status = 'confirmed';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_confirmed_at ON public.payments(confirmed_at);
CREATE INDEX IF NOT EXISTS idx_treasury_ledger_payment_id ON public.treasury_ledger(payment_id);

-- Add RLS policy for the view
GRANT SELECT ON public.confirmed_payments TO anon, authenticated;