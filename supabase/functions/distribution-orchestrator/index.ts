/**
 * Distribution Orchestrator - Master Coordinator for AI Distribution System
 * מתזמר את כל מערכת ההפצה האוטונומית
 * 
 * Coordinates:
 * 1. Intent Scanner - Find high-intent leads
 * 2. Content Engine - Generate responses and content
 * 3. Lead Hunter - Discover new opportunities
 * 4. AI Outreach - Personalized follow-ups
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DistributionStats {
  intent_scans: number;
  content_generated: number;
  leads_found: number;
  outreach_sent: number;
  responses_created: number;
  high_intent_alerts: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ========== EMERGENCY STOP CHECK (BEFORE ANYTHING ELSE) ==========
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('brain_enabled, emergency_stop')
      .single();

    if (settings?.emergency_stop || !settings?.brain_enabled) {
      console.log('🛑 System stopped: emergency_stop or brain_disabled');
      return new Response(
        JSON.stringify({ success: false, reason: settings?.emergency_stop ? 'emergency_stop' : 'brain_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { mode = 'full_cycle' } = body;

    console.log(`🎯 Distribution Orchestrator running: ${mode}`);

    const stats: DistributionStats = {
      intent_scans: 0,
      content_generated: 0,
      leads_found: 0,
      outreach_sent: 0,
      responses_created: 0,
      high_intent_alerts: 0,
    };

    const errors: string[] = [];

    // Step 1: Run Intent Scanner to find high-intent signals
    console.log('📡 Step 1: Running Intent Scanner...');
    try {
      const intentResponse = await fetch(`${supabaseUrl}/functions/v1/ai-intent-scanner`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (intentResponse.ok) {
        const intentData = await intentResponse.json();
        stats.intent_scans = intentData.scanned || 0;
        stats.high_intent_alerts = intentData.critical_signals || 0;
        stats.leads_found += intentData.signals_found || 0;
        console.log(`✅ Intent Scanner: ${intentData.signals_found} signals found`);
      } else {
        errors.push(`Intent Scanner failed: ${intentResponse.status}`);
      }
    } catch (e) {
      errors.push(`Intent Scanner error: ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    // Step 2: Generate fresh content
    console.log('📝 Step 2: Generating Content...');
    try {
      const contentResponse = await fetch(`${supabaseUrl}/functions/v1/ai-content-engine`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'generate' }),
      });

      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        stats.content_generated = contentData.count || 0;
        console.log(`✅ Content Engine: ${contentData.count} pieces generated`);
      } else {
        errors.push(`Content Engine failed: ${contentResponse.status}`);
      }
    } catch (e) {
      errors.push(`Content Engine error: ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    // Step 3: Run Lead Hunter for additional discovery
    console.log('🔍 Step 3: Running Lead Hunter...');
    try {
      const leadResponse = await fetch(`${supabaseUrl}/functions/v1/lead-hunter`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (leadResponse.ok) {
        const leadData = await leadResponse.json();
        stats.leads_found += leadData.leads_found || 0;
        console.log(`✅ Lead Hunter: ${leadData.leads_found} leads found`);
      } else {
        errors.push(`Lead Hunter failed: ${leadResponse.status}`);
      }
    } catch (e) {
      errors.push(`Lead Hunter error: ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    // Step 4: Process outreach queue
    console.log('📧 Step 4: Processing Outreach Queue...');
    try {
      // Get pending outreach items
      const { data: pendingOutreach, error: outreachError } = await supabase
        .from('outreach_queue')
        .select('*')
        .eq('status', 'queued')
        .lte('scheduled_for', new Date().toISOString())
        .limit(10);

      if (!outreachError && pendingOutreach && pendingOutreach.length > 0) {
        // For now, just mark as ready (actual sending would require platform APIs)
        for (const item of pendingOutreach) {
          await supabase
            .from('outreach_queue')
            .update({ 
              status: 'ready_to_send',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          stats.outreach_sent++;
        }
        console.log(`✅ Outreach: ${stats.outreach_sent} messages ready`);
      }
    } catch (e) {
      errors.push(`Outreach processing error: ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    // Step 5: Check for leads needing responses
    console.log('💬 Step 5: Creating Response Drafts...');
    try {
      const { data: hotLeads, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .in('status', ['new', 'hot'])
        .gte('intent_score', 60)
        .is('first_contact_at', null)
        .limit(5);

      if (!leadError && hotLeads && hotLeads.length > 0) {
        for (const lead of hotLeads) {
          if (lead.notes) {
            const responseResult = await fetch(`${supabaseUrl}/functions/v1/ai-content-engine`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                mode: 'respond',
                context: lead.notes,
                target_platform: lead.source?.toLowerCase() || 'reddit',
              }),
            });

            if (responseResult.ok) {
              stats.responses_created++;
              await supabase
                .from('leads')
                .update({ status: 'response_drafted' })
                .eq('id', lead.id);
            }
          }
        }
        console.log(`✅ Responses: ${stats.responses_created} drafts created`);
      }
    } catch (e) {
      errors.push(`Response creation error: ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    // Calculate overall health
    const totalActions = stats.intent_scans + stats.content_generated + stats.leads_found + stats.responses_created;
    const healthScore = errors.length === 0 ? 100 : Math.max(0, 100 - (errors.length * 20));

    // Send summary notification
    await supabase.functions.invoke('telegram-notify', {
      body: {
        message: `📊 *Distribution Cycle Complete*

🔎 Intent Scans: ${stats.intent_scans}
📝 Content Generated: ${stats.content_generated}
🎯 Leads Found: ${stats.leads_found}
📧 Outreach Ready: ${stats.outreach_sent}
💬 Responses Created: ${stats.responses_created}
🚨 High Intent Alerts: ${stats.high_intent_alerts}

Health: ${healthScore}%${errors.length > 0 ? `\n⚠️ Errors: ${errors.length}` : ''}`,
        type: 'distribution_summary',
      },
    }).catch(() => {/* Silent fail */});

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000005', // Sentinel for distribution
      action: 'distribution_cycle_completed',
      metadata: {
        ...stats,
        errors: errors.length,
        error_details: errors,
        health_score: healthScore,
        mode,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        stats,
        health_score: healthScore,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Distribution Orchestrator error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
