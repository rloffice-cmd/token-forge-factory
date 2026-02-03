/**
 * Shared Authentication Guards
 * Security utilities for Edge Functions
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
 */
export function verifyCronSecret(req: Request): AuthResult {
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  
  if (!expectedSecret) {
    console.error('CRON_SECRET not configured');
    return { authorized: false, error: 'Server configuration error' };
  }
  
  if (!cronSecret || cronSecret !== expectedSecret) {
    return { authorized: false, error: 'Invalid or missing cron secret' };
  }
  
  return { authorized: true };
}

/**
 * Verify ADMIN_API_TOKEN for admin-only functions
 */
export function verifyAdminToken(req: Request): AuthResult {
  const adminToken = req.headers.get('x-admin-token');
  const expectedToken = Deno.env.get('ADMIN_API_TOKEN');
  
  if (!expectedToken) {
    console.error('ADMIN_API_TOKEN not configured');
    return { authorized: false, error: 'Server configuration error' };
  }
  
  if (!adminToken || adminToken !== expectedToken) {
    return { authorized: false, error: 'Invalid or missing admin token' };
  }
  
  return { authorized: true };
}

/**
 * Verify webhook token for ingest endpoints
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
 */
export async function logSecurityEvent(
  supabase: any,
  eventType: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000001', // Security sentinel
      action: eventType,
      metadata: {
        ...metadata,
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
 */
export async function checkRateLimit(
  supabase: any,
  identifier: string,
  maxRequests: number,
  windowMinutes: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  
  const { count } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('metadata->>identifier', identifier)
    .gte('created_at', windowStart);
  
  return (count || 0) >= maxRequests;
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
 */
export function verifyOrigin(req: Request, allowedOrigins: string[]): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // Allow non-browser requests
  return allowedOrigins.some(allowed => origin.includes(allowed));
}
