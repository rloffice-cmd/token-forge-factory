-- Add throttle_activated_at to brain_settings for accurate throttle duration tracking
ALTER TABLE public.brain_settings 
ADD COLUMN IF NOT EXISTS throttle_activated_at TIMESTAMP WITH TIME ZONE;

-- Add last_throttle_activated_at for tracking consecutive throttle activations
COMMENT ON COLUMN public.brain_settings.throttle_activated_at IS 'When the current throttle was activated (for duration calculation)';