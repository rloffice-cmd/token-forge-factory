/**
 * Outreach Sender - Send Queued Messages
 * שליחת הודעות מתוזמנות ועדכון סטטוסים
 * Runs every 15 minutes via pg_cron
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('📤 Outreach Sender processing queue...');

    // Get queued messages that are due
    const now = new Date().toISOString();
    const { data: queuedMessages } = await supabase
      .from('outreach_queue')
      .select('*')
      .eq('status', 'queued')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(20);

    if (!queuedMessages || queuedMessages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No messages to send' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${queuedMessages.length} messages...`);

    let sent = 0;
    let failed = 0;

    for (const message of queuedMessages) {
      try {
        // Generate content for scheduled follow-ups that don't have content yet
        if (!message.message_content && message.message_type !== 'initial') {
          const { data: lead } = await supabase
            .from('leads')
            .select('*')
            .eq('id', message.lead_id)
            .single();

          if (!lead) continue;

          // Get previous messages sent to this lead
          const { data: prevMessages } = await supabase
            .from('outreach_queue')
            .select('message_content, message_type')
            .eq('lead_id', message.lead_id)
            .eq('status', 'sent')
            .order('created_at', { ascending: false })
            .limit(3);

          // Generate follow-up with AI
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
              'X-Title': 'Follow-up Generator',
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                {
                  role: 'system',
                  content: `You are writing a ${message.message_type} for someone who didn't respond to previous outreach.

Rules:
1. Be brief and non-pushy
2. Add new value, don't just repeat
3. Different angle from previous messages
4. Friendly, human tone
5. Max 2-3 sentences

Return just the message text.`
                },
                {
                  role: 'user',
                  content: `Lead's original need: "${lead.title}"
Previous messages sent: ${JSON.stringify(prevMessages?.map(m => m.message_content) || [])}

Write a ${message.message_type === 'follow_up_1' ? 'first follow-up' : 
          message.message_type === 'follow_up_2' ? 'second follow-up' : 
          'final check-in'}`
                }
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            message.message_content = aiData.choices?.[0]?.message?.content || '';
          }
        }

        if (!message.message_content) {
          await supabase
            .from('outreach_queue')
            .update({ status: 'failed', error: 'No content' })
            .eq('id', message.id);
          failed++;
          continue;
        }

        // For now, we log the "send" action
        // In production, this would integrate with Reddit API, email service, etc.
        console.log(`[SIMULATED SEND] Channel: ${message.channel}`);
        console.log(`Message: ${message.message_content.slice(0, 100)}...`);

        // Update message status
        await supabase
          .from('outreach_queue')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            message_content: message.message_content, // Save generated content
          })
          .eq('id', message.id);

        // Update lead status based on message type
        if (message.lead_id) {
          const newStatus = message.message_type === 'initial' ? 'contacted' :
                           message.message_type === 'closing' ? 'closing_sent' :
                           `follow_up_${message.message_type.replace('follow_up_', '')}`;
          
          await supabase
            .from('leads')
            .update({ 
              status: newStatus,
              last_contacted_at: new Date().toISOString(),
            })
            .eq('id', message.lead_id);
        }

        sent++;

        // Rate limiting between messages
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Failed to send message ${message.id}:`, error);
        
        await supabase
          .from('outreach_queue')
          .update({ 
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', message.id);
        
        failed++;
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000005', // Sentinel
      action: 'outreach_batch_sent',
      metadata: {
        total_queued: queuedMessages.length,
        sent: sent,
        failed: failed,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: queuedMessages.length,
        sent: sent,
        failed: failed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Outreach Sender error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
