/**
 * Follow-up Engine
 * Sends automated follow-ups to leads who received checkout links but didn't pay
 * Implements progressive messaging with discounts
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FollowUpConfig {
  hours_since_sent: number;
  discount_percent: number;
  message_template: string;
  subject: string;
}

const FOLLOW_UP_STAGES: FollowUpConfig[] = [
  {
    hours_since_sent: 2,
    discount_percent: 0,
    subject: '🔔 Your security analysis is waiting',
    message_template: `Hi! 

I noticed you started setting up on-chain risk protection but didn't complete the checkout.

Your checkout link is still active: {checkout_url}

Questions? Just reply to this message.

- DTF Security Bot`,
  },
  {
    hours_since_sent: 24,
    discount_percent: 15,
    subject: '🎁 15% off - Limited time',
    message_template: `Hi again!

I wanted to follow up - we're offering a special 15% discount on your first purchase.

Use code FIRST15 at checkout: {checkout_url}

This offer expires in 24 hours.

- DTF Security Bot`,
  },
  {
    hours_since_sent: 72,
    discount_percent: 25,
    subject: '⚡ Final offer: 25% off expires today',
    message_template: `Last chance!

I'm authorized to offer you 25% off - our biggest discount.

This is the final follow-up. Use code FINAL25: {checkout_url}

After this, the standard price applies.

- DTF Security Bot`,
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('📧 Follow-up Engine starting...');

    // Check brain settings
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('brain_enabled, outreach_enabled')
      .eq('id', true)
      .single();

    if (!settings?.brain_enabled || !settings?.outreach_enabled) {
      console.log('⏸️ Brain or outreach disabled - skipping');
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find closing attempts that were sent but not converted
    const { data: pendingFollowUps, error: fetchError } = await supabase
      .from('closing_attempts')
      .select(`
        id,
        opportunity_id,
        checkout_url,
        created_at,
        metadata_json
      `)
      .eq('result', 'sent')
      .not('checkout_url', 'is', null)
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;

    console.log(`Found ${pendingFollowUps?.length || 0} pending follow-ups`);

    let followUpsSent = 0;
    const now = new Date();

    for (const attempt of pendingFollowUps || []) {
      const sentAt = new Date(attempt.created_at);
      const hoursSinceSent = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60);
      
      // Get metadata to check follow-up stage
      const metadata = attempt.metadata_json || {};
      const followUpStage = metadata.follow_up_stage || 0;
      
      // Find the appropriate follow-up stage
      const nextStage = FOLLOW_UP_STAGES.find((stage, index) => 
        index === followUpStage && hoursSinceSent >= stage.hours_since_sent
      );

      if (!nextStage) continue;

      // Get the lead associated with this opportunity
      const { data: opportunity } = await supabase
        .from('opportunities')
        .select('signal_id')
        .eq('id', attempt.opportunity_id)
        .single();

      if (!opportunity) continue;

      // Get lead info from demand_signals -> leads relationship
      const { data: signal } = await supabase
        .from('demand_signals')
        .select('source_url, query_text')
        .eq('id', opportunity.signal_id)
        .single();

      if (!signal) continue;

      // Create follow-up message
      const messageBody = nextStage.message_template.replace('{checkout_url}', attempt.checkout_url);

      // Queue the follow-up message
      // Find or create a lead for this signal
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('source_id', opportunity.signal_id)
        .maybeSingle();

      if (existingLead) {
        // Add to outreach queue
        await supabase.from('outreach_queue').insert({
          lead_id: existingLead.id,
          channel: 'email',
          message_body: messageBody,
          subject: nextStage.subject,
          template_id: `follow-up-stage-${followUpStage + 1}`,
          persona: 'helpful',
          priority: 10, // High priority for follow-ups
          generation_metadata: {
            type: 'follow_up',
            stage: followUpStage + 1,
            discount_percent: nextStage.discount_percent,
            hours_since_sent: Math.round(hoursSinceSent),
          },
        });

        // Update closing attempt metadata
        await supabase
          .from('closing_attempts')
          .update({
            metadata_json: {
              ...metadata,
              follow_up_stage: followUpStage + 1,
              last_follow_up_at: now.toISOString(),
            },
          })
          .eq('id', attempt.id);

        followUpsSent++;
        console.log(`📤 Queued follow-up stage ${followUpStage + 1} for attempt ${attempt.id}`);
      }
    }

    // Check for converted payments and update closing attempts
    const { data: confirmedPayments } = await supabase
      .from('payments')
      .select('charge_id')
      .eq('status', 'confirmed');

    if (confirmedPayments?.length) {
      // Mark corresponding closing attempts as converted
      for (const payment of confirmedPayments) {
        await supabase
          .from('closing_attempts')
          .update({ result: 'converted' })
          .eq('charge_id', payment.charge_id);
      }
    }

    console.log(`✅ Follow-up Engine complete: ${followUpsSent} follow-ups queued`);

    return new Response(
      JSON.stringify({
        success: true,
        follow_ups_sent: followUpsSent,
        pending_checked: pendingFollowUps?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Follow-up Engine error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
