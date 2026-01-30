-- Add treasury_wallet table for Safe wallet management
CREATE TABLE IF NOT EXISTS public.treasury_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  network text NOT NULL DEFAULT 'ethereum',
  label text DEFAULT 'Main Treasury',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.treasury_wallet ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow public read treasury_wallet"
ON public.treasury_wallet
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert treasury_wallet"
ON public.treasury_wallet
FOR INSERT
WITH CHECK (true);

-- Add direction column to treasury_ledger for IN/OUT tracking
ALTER TABLE public.treasury_ledger 
ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'IN';

-- Add tx_hash column to treasury_ledger
ALTER TABLE public.treasury_ledger 
ADD COLUMN IF NOT EXISTS tx_hash text;

-- Create index for direction queries
CREATE INDEX IF NOT EXISTS treasury_ledger_direction_idx ON public.treasury_ledger(direction);

-- Insert default treasury wallet (Safe address placeholder - will be updated)
INSERT INTO public.treasury_wallet (address, network, label)
VALUES ('0x0000000000000000000000000000000000000000', 'ethereum', 'Main Treasury Safe')
ON CONFLICT DO NOTHING;