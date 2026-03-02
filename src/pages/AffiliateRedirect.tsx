/**
 * Client-side redirect page for /go/:partnerSlug/:leadId
 * Calls the affiliate-redirect edge function which logs the click and redirects
 */

import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AffiliateRedirect() {
  const { partnerSlug, leadId } = useParams();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('src') || 'direct';

  useEffect(() => {
    if (!partnerSlug) return;

    const redirect = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('affiliate-redirect', {
          body: null,
          headers: {},
        });
        // The edge function returns a 302 redirect, but supabase.functions.invoke 
        // won't follow it. We need to call the function URL directly.
      } catch {
        // Fallback: direct call
      }

      // Direct call to edge function for proper 302 redirect
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const redirectUrl = `${projectUrl}/functions/v1/affiliate-redirect?partner=${encodeURIComponent(partnerSlug)}&lead=${encodeURIComponent(leadId || 'direct')}&src=${encodeURIComponent(source)}`;
      window.location.href = redirectUrl;
    };

    redirect();
  }, [partnerSlug, leadId, source]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">מעביר...</p>
      </div>
    </div>
  );
}
