-- Create a direct monetization model: Micro-consulting via AI
-- Users pay per question/analysis - no affiliate registration needed

-- Table for paid consultations
CREATE TABLE IF NOT EXISTS micro_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL,
  question TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  ai_response TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  price_usd NUMERIC NOT NULL DEFAULT 5,
  payment_id UUID REFERENCES payments(id),
  charge_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5)
);

-- Enable RLS
ALTER TABLE micro_consultations ENABLE ROW LEVEL SECURITY;

-- Service role access
CREATE POLICY "Service role full access micro_consultations" ON micro_consultations
  FOR ALL USING (true) WITH CHECK (true);

-- Table for instant digital products (templates, guides)
CREATE TABLE IF NOT EXISTS digital_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_he TEXT NOT NULL,
  description TEXT NOT NULL,
  description_he TEXT NOT NULL,
  category TEXT NOT NULL,
  price_usd NUMERIC NOT NULL,
  content_url TEXT, -- The actual product (generated on purchase)
  preview_content TEXT,
  is_active BOOLEAN DEFAULT true,
  sales_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE digital_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read digital_products" ON digital_products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role full access digital_products" ON digital_products
  FOR ALL USING (true) WITH CHECK (true);

-- Table for digital product purchases
CREATE TABLE IF NOT EXISTS digital_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES digital_products(id),
  customer_email TEXT NOT NULL,
  payment_id UUID REFERENCES payments(id),
  charge_id TEXT,
  download_url TEXT,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')
);

ALTER TABLE digital_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access digital_purchases" ON digital_purchases
  FOR ALL USING (true) WITH CHECK (true);

-- Seed instant digital products
INSERT INTO digital_products (name, name_he, description, description_he, category, price_usd, preview_content) VALUES
('Startup Tech Stack Guide 2025', 'מדריך Tech Stack לסטארטאפים 2025', 
 'Complete guide to choosing the right technologies for your startup. Includes cost analysis, scaling considerations, and real-world examples.',
 'מדריך מלא לבחירת הטכנולוגיות הנכונות לסטארטאפ שלך. כולל ניתוח עלויות, שיקולי סקייל ודוגמאות מהעולם האמיתי.',
 'guide', 19, 'Preview: Chapter 1 - Why Your Tech Stack Matters...'),

('AI Prompt Engineering Masterclass', 'מאסטרקלאס הנדסת פרומפטים', 
 'Learn to write prompts that get results. 50+ templates for development, marketing, and business automation.',
 'למד לכתוב פרומפטים שמביאים תוצאות. 50+ תבניות לפיתוח, שיווק ואוטומציה עסקית.',
 'course', 29, 'Preview: Lesson 1 - The Anatomy of a Perfect Prompt...'),

('SaaS Launch Checklist', 'צ׳קליסט השקת SaaS', 
 'Step-by-step checklist for launching your SaaS. From MVP to first 100 customers.',
 'צ׳קליסט צעד-אחר-צעד להשקת ה-SaaS שלך. מ-MVP ועד 100 הלקוחות הראשונים.',
 'template', 9, 'Preview: Phase 1 - Pre-Launch (21 items)...'),

('Crypto Security Audit Template', 'תבנית ביקורת אבטחת קריפטו', 
 'Professional security audit template for Web3 projects. Used by leading auditors.',
 'תבנית ביקורת אבטחה מקצועית לפרויקטי Web3. בשימוש מבקרים מובילים.',
 'template', 49, 'Preview: Section 1 - Smart Contract Vulnerabilities...');

-- Update cron to run engines more frequently
SELECT cron.unschedule('affiliate-automation-engine-hourly');
SELECT cron.unschedule('agent-marketplace-engine-hourly');

-- Run full autonomous engine every 30 minutes
SELECT cron.schedule(
  'full-autonomous-engine-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://flsdahpijdvkohwiinqm.supabase.co/functions/v1/full-autonomous-engine',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2RhaHBpamR2a29od2lpbnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTkxNDQsImV4cCI6MjA4NTM3NTE0NH0.iz5z9K3Nq1J-Vfr8QNNxS1-jdIfs26LrpmjvsQYNAhs"}'::jsonb,
    body:='{"action": "full_cycle", "aggressive": true}'::jsonb
  );
  $$
);