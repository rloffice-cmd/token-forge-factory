-- Create cashout_requests table for tracking withdrawal requests
CREATE TABLE IF NOT EXISTS public.cashout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_dtf numeric NOT NULL,
  amount_usd numeric NOT NULL,
  amount_eth numeric, -- Calculated ETH amount at time of request
  eth_price_usd numeric, -- ETH price at time of request
  wallet_address text NOT NULL,
  network text NOT NULL DEFAULT 'ethereum', -- ethereum, polygon, arbitrum, etc.
  status text NOT NULL DEFAULT 'pending', -- pending, signed, submitted, confirmed, failed
  tx_hash text, -- Transaction hash once submitted
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz,
  submitted_at timestamptz,
  confirmed_at timestamptz
);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS cashout_requests_status_idx ON public.cashout_requests(status);
CREATE INDEX IF NOT EXISTS cashout_requests_wallet_idx ON public.cashout_requests(wallet_address);

-- Enable RLS
ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies: public read and insert (no update/delete for audit trail)
CREATE POLICY "Allow public read cashout_requests"
ON public.cashout_requests
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert cashout_requests"
ON public.cashout_requests
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update cashout_requests"
ON public.cashout_requests
FOR UPDATE
USING (true);