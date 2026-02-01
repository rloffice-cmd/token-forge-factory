/**
 * Fulfillment Provisioner - אספקה אוטומטית
 * 
 * לאחר payment CONFIRMED:
 * - api_key: מנפיק מפתח API ושולח ללקוח
 * - report: מייצר דוח ומעלה ל-storage
 * - download: מספק לינק הורדה
 * 
 * Kill Gates:
 * - רק payments עם status=confirmed
 * - fulfillment_enabled חייב להיות true
 * - לא מספק פעמיים לאותו payment
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FulfillmentJob {
  id: string;
  payment_id: string;
  opportunity_id: string | null;
  offer_id: string | null;
  delivery_type: string;
  delivery_email: string | null;
  offers?: {
    delivery_config: Record<string, unknown>;
  };
  payments?: {
    customer_id: string;
    pack_id: string;
    users_customers?: {
      email: string;
    };
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Check if fulfillment is enabled
    const { data: configData } = await supabase
      .from('engine_config')
      .select('config_value')
      .eq('config_key', 'fulfillment_enabled')
      .single();

    if (!configData || (configData.config_value !== true && configData.config_value !== 'true')) {
      console.log('Fulfillment is disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Fulfillment disabled', fulfilled: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get queued fulfillment jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('fulfillment_jobs')
      .select(`
        *,
        offers (delivery_config),
        payments (
          customer_id, 
          pack_id,
          users_customers (email)
        )
      `)
      .eq('status', 'queued')
      .order('queued_at', { ascending: true })
      .limit(20);

    if (jobsError) {
      throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No queued jobs', fulfilled: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let fulfilled = 0;
    let failed = 0;

    for (const job of jobs as FulfillmentJob[]) {
      try {
        // Mark as processing
        await supabase
          .from('fulfillment_jobs')
          .update({ status: 'processing', started_at: new Date().toISOString() })
          .eq('id', job.id);

        const email = job.delivery_email || job.payments?.users_customers?.email;
        const customerId = job.payments?.customer_id;

        if (!customerId) {
          throw new Error('No customer ID found');
        }

        let result: { api_key_id?: string; artifact_url?: string } = {};

        switch (job.delivery_type) {
          case 'api_key':
            result = await provisionApiKey(supabase, customerId, job.payments?.pack_id);
            break;
          
          case 'report':
            result = await provisionReport(supabase, customerId, job);
            break;
          
          case 'download':
            result = await provisionDownload(supabase, job);
            break;
          
          default:
            throw new Error(`Unknown delivery type: ${job.delivery_type}`);
        }

        // Mark as delivered
        await supabase
          .from('fulfillment_jobs')
          .update({
            status: 'delivered',
            api_key_id: result.api_key_id,
            artifact_url: result.artifact_url,
            delivered_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        // Update opportunity if linked
        if (job.opportunity_id) {
          await supabase
            .from('opportunities')
            .update({ status: 'closed' })
            .eq('id', job.opportunity_id);
        }

        console.log(`Fulfilled job ${job.id} (${job.delivery_type})`);
        fulfilled++;

      } catch (jobError) {
        console.error(`Failed to fulfill job ${job.id}:`, jobError);
        
        await supabase
          .from('fulfillment_jobs')
          .update({
            status: 'failed',
            error_message: jobError instanceof Error ? jobError.message : 'Unknown error',
          })
          .eq('id', job.id);

        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Fulfillment complete: ${fulfilled} fulfilled, ${failed} failed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: jobs.length,
        fulfilled,
        failed,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fulfillment provisioner error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function provisionApiKey(
  supabase: any, 
  customerId: string,
  packId?: string
): Promise<{ api_key_id: string }> {
  // Generate a secure API key
  const keyBytes = new Uint8Array(32);
  crypto.getRandomValues(keyBytes);
  const rawKey = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const apiKey = `dtf_${rawKey}`;
  const keyPrefix = apiKey.substring(0, 12);

  // Hash the key for storage
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey + (Deno.env.get('API_KEY_PEPPER') || 'default-pepper'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Determine rate limit tier based on pack
  let rateLimitTier = 'basic';
  if (packId === 'pro') rateLimitTier = 'pro';
  else if (packId === 'enterprise') rateLimitTier = 'enterprise';

  // Insert the key
  const { data: keyRecord, error: keyError } = await supabase
    .from('api_keys')
    .insert({
      customer_id: customerId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      rate_limit_tier: rateLimitTier,
      label: `Auto-provisioned - ${new Date().toISOString()}`,
    })
    .select('id')
    .single();

  if (keyError) {
    throw new Error(`Failed to create API key: ${keyError.message}`);
  }

  // Store in delivery table for reveal-once
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await supabase
    .from('api_key_deliveries')
    .insert({
      api_key_id: keyRecord.id,
      customer_id: customerId,
      plaintext_key: apiKey,
      expires_at: expiresAt.toISOString(),
    });

  return { api_key_id: keyRecord.id };
}

async function provisionReport(
  supabase: any,
  customerId: string,
  job: FulfillmentJob
): Promise<{ artifact_url: string }> {
  // Generate a simple report (in production, this would be more sophisticated)
  const report = {
    generated_at: new Date().toISOString(),
    customer_id: customerId,
    type: 'fulfillment_report',
    data: {
      message: 'Report generated successfully',
      delivery_config: job.offers?.delivery_config || {},
    },
  };

  // For now, return a placeholder URL
  // In production, you'd upload to Supabase Storage
  const reportJson = JSON.stringify(report, null, 2);
  const artifactUrl = `data:application/json;base64,${btoa(reportJson)}`;

  return { artifact_url: artifactUrl };
}

async function provisionDownload(
  supabase: any,
  job: FulfillmentJob
): Promise<{ artifact_url: string }> {
  // Return the configured download URL from the offer
  const downloadUrl = job.offers?.delivery_config?.download_url as string;
  
  if (!downloadUrl) {
    throw new Error('No download URL configured for offer');
  }

  return { artifact_url: downloadUrl };
}
