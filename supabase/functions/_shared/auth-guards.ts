/**
 * Shared Authentication Guards
 * Security utilities for Edge Functions
 * 
 * SECURITY HARDENING v2 - Fixed Issues:
 * - verifyOrigin uses strict URL hostname matching
 * - All comparisons use === (no includes())
 * - Rate limit uses consistent identifier format
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-admin-token, x-webhook-token',
};

export interface AuthResult {
  authorized: boolean;
  error?: string;
  userId?: string;
}

/**
 * Verify CRON_SECRET for scheduled/internal functions
 * MUST be used for all cron-triggered endpoints
 */
export function verifyCronSecret(req: Request): AuthResult {
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  
  if (!expectedSecret) {
    console.error('CRON_SECRET not configured');
    return { authorized: false, error: 'Server configuration error' };
  }
  
  // STRICT equality - no includes()
  if (!cronSecret || cronSecret !== expectedSecret) {
    return { authorized: false, error: 'Invalid or missing cron secret' };
  }
  
  return { authorized: true };
}

/**
 * Verify ADMIN_API_TOKEN for admin-only functions
 * Uses x-admin-token header ONLY (not Authorization)
 */
export function verifyAdminToken(req: Request): AuthResult {
  const adminToken = req.headers.get('x-admin-token');
  const expectedToken = Deno.env.get('ADMIN_API_TOKEN');
  
  if (!expectedToken) {
    console.error('ADMIN_API_TOKEN not configured');
    return { authorized: false, error: 'Server configuration error' };
  }
  
  // STRICT equality - no includes()
  if (!adminToken || adminToken !== expectedToken) {
    return { authorized: false, error: 'Invalid or missing admin token' };
  }
  
  return { authorized: true };
}

/**
 * Verify webhook token for ingest endpoints
 * Authorization: Bearer <TOKEN>
 */
export function verifyWebhookToken(req: Request): AuthResult {
  const authHeader = req.headers.get('authorization');
  const expectedToken = Deno.env.get('INGEST_WEBHOOK_TOKEN');
  
  if (!expectedToken) {
    console.error('INGEST_WEBHOOK_TOKEN not configured');
    return { authorized: false, error: 'Server configuration error' };
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing authorization header' };
  }
  
  // Extract token and do STRICT equality
  const token = authHeader.replace('Bearer ', '');
  if (token !== expectedToken) {
    return { authorized: false, error: 'Invalid webhook token' };
  }
  
  return { authorized: true };
}

/**
 * Create unauthorized response with proper CORS headers
 */
export function unauthorizedResponse(error: string, eventType: string): Response {
  console.warn(`Unauthorized access attempt: ${eventType} - ${error}`);
  return new Response(
    JSON.stringify({ success: false, error }),
    { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Log security event to audit_logs table
 * Always includes identifier for rate limiting queries
 */
export async function logSecurityEvent(
  supabase: any,
  eventType: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    // Build consistent identifier for rate limiting
    const identifier = metadata.identifier || 
      `${eventType}:${metadata.ip || metadata.endpoint || 'unknown'}`;
    
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000001', // Security sentinel
      action: eventType,
      metadata: {
        ...metadata,
        identifier, // Always include for rate limit queries
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Failed to log security event:', err);
  }
}

/**
 * Simple IP-based rate limiting check
 * Returns true if rate limited (should block)
 * 
 * Uses identifier format: "type:value" (e.g., "ingest:192.168.1.1")
 */
export async function checkRateLimit(
  supabase: any,
  identifier: string,
  maxRequests: number,
  windowMinutes: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  
  try {
    // Query by identifier in metadata using containment operator
    const { count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', windowStart)
      .contains('metadata', { identifier });
    
    return (count || 0) >= maxRequests;
  } catch (err) {
    console.error('Rate limit check failed:', err);
    // Fail open for now, but log the error
    return false;
  }
}

/**
 * Extract client IP from request
 */
export function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

/**
 * Verify allowed origins for public endpoints
 * Uses STRICT hostname matching (not includes())
 * 
 * @param allowedOrigins - Array of allowed hostnames (e.g., ['lovable.app', 'tokenforge.app'])
 */
export function verifyOrigin(req: Request, allowedOrigins: string[]): boolean {
  const origin = req.headers.get('origin');
  
  // Allow non-browser requests (server-to-server)
  if (!origin) return true;
  
  try {
    // Parse the origin URL and extract hostname
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname;
    
    // STRICT match: hostname must exactly match OR end with allowed domain
    return allowedOrigins.some(allowed => {
      // Exact match
      if (hostname === allowed) return true;
      // Subdomain match (e.g., "preview--xxx.lovable.app" matches "lovable.app")
      if (hostname.endsWith('.' + allowed)) return true;
      return false;
    });
  } catch {
    // Invalid URL - reject
    console.warn('Invalid origin URL:', origin);
    return false;
  }
}

/**
 * Require API_KEY_PEPPER - hard fail if missing
 * Returns pepper or throws
 */
export function requireApiKeyPepper(): string {
  const pepper = Deno.env.get('API_KEY_PEPPER');
  if (!pepper) {
    console.error('CRITICAL: API_KEY_PEPPER not configured - cannot hash API keys');
    throw new Error('Server configuration error: API_KEY_PEPPER required');
  }
  return pepper;
}
