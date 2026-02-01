-- Content Queue table for AI-generated content
CREATE TABLE IF NOT EXISTS public.content_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  hashtags TEXT[],
  cta TEXT,
  product TEXT,
  context TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  published_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  performance_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_queue ENABLE ROW LEVEL SECURITY;

-- Service role access
CREATE POLICY "Service role full access to content_queue" 
  ON public.content_queue 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Add index for scheduled content
CREATE INDEX idx_content_queue_scheduled ON public.content_queue(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_content_queue_status ON public.content_queue(status);

-- Add missing columns to leads table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'title') THEN
    ALTER TABLE public.leads ADD COLUMN title TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'content') THEN
    ALTER TABLE public.leads ADD COLUMN content TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'source_type') THEN
    ALTER TABLE public.leads ADD COLUMN source_type TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'keywords_matched') THEN
    ALTER TABLE public.leads ADD COLUMN keywords_matched TEXT[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'author') THEN
    ALTER TABLE public.leads ADD COLUMN author TEXT;
  END IF;
END $$;

-- Add missing columns to outreach_queue table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outreach_queue' AND column_name = 'source_url') THEN
    ALTER TABLE public.outreach_queue ADD COLUMN source_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outreach_queue' AND column_name = 'message_content') THEN
    ALTER TABLE public.outreach_queue ADD COLUMN message_content TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outreach_queue' AND column_name = 'updated_at') THEN
    ALTER TABLE public.outreach_queue ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END $$;

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_content_queue_updated_at
  BEFORE UPDATE ON public.content_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();