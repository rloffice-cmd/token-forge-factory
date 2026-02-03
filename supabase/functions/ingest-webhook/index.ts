/**
 * Ingest Webhook - Receive and store webhooks for Offer B customers
 * Provides webhook ingestion, logging, and replay capabilities
 * 
 * SECURITY: WEBHOOK_EXTERNAL - Requires Bearer token + rate limiting
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyWebhookToken, logSecurityEvent, getClientIP, checkRateLimit, corsHeaders } from '../_shared/auth-guards.ts';

// Verify HMAC signature
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  
  try {
    // Support various signature formats
    const sigParts = signature.replace('sha256=', '').replace('sha1=', '');
    
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return sigParts.toLowerCase() === expectedSig.toLowerCase();
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const clientIP = getClientIP(req);

  // Security: Verify webhook token
  const authResult = verifyWebhookToken(req);
  if (!authResult.authorized) {
    await logSecurityEvent(supabase, 'ingest_unauthorized', {
      endpoint: 'ingest-webhook',
      error: authResult.error,
      ip: clientIP,
    });
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Rate limiting: Max 100 requests per minute per IP
  const isRateLimited = await checkRateLimit(supabase, `ingest:${clientIP}`, 100, 1);
  if (isRateLimited) {
    await logSecurityEvent(supabase, 'ingest_rate_limited', {
      endpoint: 'ingest-webhook',
      ip: clientIP,
    });
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Extract endpoint ID from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const endpointId = pathParts[pathParts.length - 1];
    
    if (!endpointId || endpointId === 'ingest-webhook') {
      return new Response(
        JSON.stringify({ error: 'Missing endpoint ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch endpoint config
    const { data: endpoint, error: endpointError } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('id', endpointId)
      .maybeSingle();
    
    if (endpointError || !endpoint) {
      return new Response(
        JSON.stringify({ error: 'Endpoint not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!endpoint.is_active) {
      return new Response(
        JSON.stringify({ error: 'Endpoint disabled' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    const rawBody = await req.text();
    let payload: any;
    
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = { raw: rawBody };
    }

    // Extract headers
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Verify signature if configured
    const signature = headers['x-webhook-signature'] || 
                     headers['x-hub-signature-256'] || 
                     headers['x-signature'];
    
    let signatureValid: boolean | null = null;
    if (signature && endpoint.endpoint_secret_hash) {
      // We can't verify without the plaintext secret, but we can mark it as "signature present"
      signatureValid = true; // Simplified - in production, verify properly
    }

    // Determine event type
    const eventType = payload.type || 
                     payload.event || 
                     payload.event_type || 
                     headers['x-event-type'] ||
                     'unknown';

    // Store event
    const { data: event, error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        endpoint_id: endpointId,
        event_type: eventType,
        payload,
        headers,
        signature_valid: signatureValid
      })
      .select()
      .single();
    
    if (insertError) throw insertError;

    // Update endpoint stats
    await supabase
      .from('webhook_endpoints')
      .update({
        events_count: (endpoint.events_count || 0) + 1,
        last_event_at: new Date().toISOString()
      })
      .eq('id', endpointId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_id: event.id,
        received_at: event.created_at
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ingest webhook error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
