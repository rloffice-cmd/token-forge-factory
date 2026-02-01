/**
 * Brain Fulfill - Automated Fulfillment for Confirmed Payments
 * Provisions API keys or webhook endpoints based on offer type
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate secure API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'dtf_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// Generate webhook endpoint secret
function generateWebhookSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let secret = 'whsec_';
  for (let i = 0; i < 24; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// Hash key for storage
async function hashKey(key: string, pepper: string): Promise<string> {
  const data = new TextEncoder().encode(key + pepper);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Send Telegram notification
async function sendTelegram(message: string): Promise<void> {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
  
  if (!botToken || !chatId) return;
  
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.error('Telegram error:', e);
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

  try {
    // Check brain_enabled
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('brain_enabled, fulfillment_enabled')
      .single();
    
    if (!settings?.brain_enabled || !settings?.fulfillment_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Brain or fulfillment disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find confirmed payments without completed fulfillment
    const { data: pendingPayments, error: paymentsError } = await supabase
      .from('payments')
      .select(`
        *,
        users_customers(id, email, name),
        fulfillment_jobs(id, status)
      `)
      .in('status', ['confirmed', 'resolved'])
      .order('confirmed_at', { ascending: true })
      .limit(10);
    
    if (paymentsError) throw paymentsError;

    const results = {
      payments_processed: 0,
      api_keys_provisioned: 0,
      webhooks_provisioned: 0,
      errors: [] as string[]
    };

    const pepper = Deno.env.get('ADMIN_API_TOKEN') || 'default-pepper';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    for (const payment of pendingPayments || []) {
      // Skip if already has completed fulfillment
      const completedJob = payment.fulfillment_jobs?.find((j: any) => j.status === 'completed');
      if (completedJob) continue;

      const customer = payment.users_customers;
      if (!customer) {
        results.errors.push(`Payment ${payment.id}: No customer found`);
        continue;
      }

      // Determine offer type based on pack_id or metadata
      const packId = payment.pack_id || '';
      const isWebhookOffer = packId.includes('webhook') || payment.metadata?.offer === 'webhook-monitor';
      
      try {
        // Create fulfillment job
        const { data: job, error: jobError } = await supabase
          .from('fulfillment_jobs')
          .insert({
            payment_id: payment.id,
            delivery_type: isWebhookOffer ? 'webhook_url' : 'api_key',
            fulfillment_type: isWebhookOffer ? 'webhook_url' : 'api_key',
            status: 'running',
            delivery_email: customer.email
          })
          .select()
          .single();
        
        if (jobError) throw jobError;

        if (isWebhookOffer) {
          // Provision webhook endpoint
          const endpointId = crypto.randomUUID();
          const secret = generateWebhookSecret();
          const secretHash = await hashKey(secret, pepper);
          const endpointUrl = `${supabaseUrl}/functions/v1/ingest-webhook/${endpointId}`;
          
          await supabase.from('webhook_endpoints').insert({
            id: endpointId,
            customer_id: customer.id,
            endpoint_url: endpointUrl,
            endpoint_secret_hash: secretHash,
            plan: packId || 'starter',
            is_active: true
          });
          
          // Update fulfillment job
          await supabase
            .from('fulfillment_jobs')
            .update({
              status: 'completed',
              delivered_at: new Date().toISOString(),
              output: {
                endpoint_url: endpointUrl,
                secret: secret, // Revealed once
                dashboard_url: `${supabaseUrl.replace('.supabase.co', '')}/api-access`
              }
            })
            .eq('id', job.id);
          
          results.webhooks_provisioned++;
          
          // Notify
          await sendTelegram(
            `🎉 Webhook endpoint מוקצה!\n` +
            `📧 ${customer.email}\n` +
            `🔗 ${endpointUrl.slice(0, 50)}...`
          );
          
        } else {
          // Provision API key
          const apiKey = generateApiKey();
          const keyHash = await hashKey(apiKey, pepper);
          const keyPrefix = apiKey.slice(0, 8);
          
          // Determine quota based on credits purchased
          const credits = payment.credits_purchased || 100;
          const quota = Math.max(100, credits * 10);
          
          const { data: apiKeyRecord } = await supabase
            .from('api_keys')
            .insert({
              customer_id: customer.id,
              key_hash: keyHash,
              key_prefix: keyPrefix,
              plan: packId || 'starter',
              quota_monthly: quota,
              used_monthly: 0,
              status: 'active'
            })
            .select()
            .single();
          
          // Create delivery record (reveal-once)
          await supabase.from('api_key_deliveries').insert({
            api_key_id: apiKeyRecord?.id,
            customer_id: customer.id,
            plaintext_key: apiKey,
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
            delivered: false
          });
          
          // Update fulfillment job
          await supabase
            .from('fulfillment_jobs')
            .update({
              status: 'completed',
              delivered_at: new Date().toISOString(),
              api_key_id: apiKeyRecord?.id,
              output: {
                key_prefix: keyPrefix,
                quota: quota,
                access_url: `${supabaseUrl.replace('.supabase.co', '')}/api-access`
              }
            })
            .eq('id', job.id);
          
          results.api_keys_provisioned++;
          
          // Notify
          await sendTelegram(
            `🔑 API Key מוקצה!\n` +
            `📧 ${customer.email}\n` +
            `🎯 Quota: ${quota} calls/month`
          );
        }
        
        results.payments_processed++;
        
      } catch (fulfillError) {
        const errMsg = fulfillError instanceof Error ? fulfillError.message : 'Unknown error';
        console.error(`Fulfillment error for payment ${payment.id}:`, fulfillError);
        results.errors.push(`${payment.id}: ${errMsg}`);
        
        // Mark job as failed
        await supabase
          .from('fulfillment_jobs')
          .update({
            status: 'failed',
            error_message: errMsg
          })
          .eq('payment_id', payment.id);
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: '00000000-0000-0000-0000-000000000000',
      action: 'brain-fulfill:completed',
      metadata: results
    });

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Brain fulfill error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
