-- Create notifications table for logging all alerts
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  charge_id TEXT,
  amount NUMERIC,
  currency TEXT,
  message TEXT NOT NULL,
  was_sent BOOLEAN NOT NULL DEFAULT false,
  is_test BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'webhook',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow public read
CREATE POLICY "Allow public read notifications" 
ON public.notifications 
FOR SELECT 
USING (true);

-- Allow insert (from edge functions)
CREATE POLICY "Allow public insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Create zerodev_sessions table for Account Abstraction
CREATE TABLE IF NOT EXISTS public.zerodev_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE,
  permissions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  network TEXT NOT NULL DEFAULT 'base',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zerodev_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to zerodev_sessions" 
ON public.zerodev_sessions 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_zerodev_sessions_updated_at
BEFORE UPDATE ON public.zerodev_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for status queries
CREATE INDEX idx_zerodev_sessions_status ON public.zerodev_sessions(status);
CREATE INDEX idx_notifications_event_type ON public.notifications(event_type);
CREATE INDEX idx_notifications_was_sent ON public.notifications(was_sent);