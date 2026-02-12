
-- Add linkedin_url column to users_customers table
ALTER TABLE public.users_customers
ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
