-- Fix 1: Recreate confirmed_payments view WITHOUT SECURITY DEFINER
-- This makes the view use SECURITY INVOKER (default) which respects caller's RLS policies

DROP VIEW IF EXISTS public.confirmed_payments;

CREATE VIEW public.confirmed_payments AS
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
  c.email AS customer_email
FROM payments p
LEFT JOIN users_customers c ON p.customer_id = c.id
WHERE p.status = 'confirmed';

-- No SECURITY DEFINER = uses SECURITY INVOKER (default, respects caller RLS)

-- Fix 2: Update users_customers RLS policy to restrict to service role only
-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Service role full access to customers" ON public.users_customers;

-- Create restrictive policy that only allows service_role access
CREATE POLICY "Service role only access to users_customers"
ON public.users_customers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix 3: Update api_keys RLS policy to restrict to service role only  
-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Service role full access to api_keys" ON public.api_keys;

-- Create restrictive policy that only allows service_role access
CREATE POLICY "Service role only access to api_keys"
ON public.api_keys
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);