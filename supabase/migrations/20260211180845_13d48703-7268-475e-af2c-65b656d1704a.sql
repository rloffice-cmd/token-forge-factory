
-- Update Woodpecker partner record (or insert if not exists)
UPDATE public.m2m_partners
SET
  affiliate_base_url = 'https://woodpecker.co/?red=ram9a0bca',
  is_active = true,
  commission_rate = 20.0
WHERE name = 'Woodpecker';

-- If no rows were updated, insert the record
INSERT INTO public.m2m_partners (name, affiliate_base_url, is_active, commission_rate, category_tags, keyword_triggers)
SELECT
  'Woodpecker',
  'https://woodpecker.co/?red=ram9a0bca',
  true,
  20.0,
  ARRAY['email', 'outreach', 'sales', 'cold-email'],
  ARRAY['cold email', 'deliverability', 'emails landing in spam', 'low reply rates', 'scaling outbound', 'email warmup', 'follow-up sequences', 'inbox placement']
WHERE NOT EXISTS (SELECT 1 FROM public.m2m_partners WHERE name = 'Woodpecker');

-- Configure brain settings for selective automation
UPDATE public.brain_settings
SET
  scan_enabled = true,
  brain_enabled = true,
  outreach_enabled = false
WHERE id = true;
