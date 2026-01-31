/**
 * AI Outreach System - Autonomous Contact & Follow-up
 * יצירת הודעות מותאמות אישית ושליחה אוטומטית ללידים
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Outreach templates
const OUTREACH_PERSONAS = {
  helpful: {
    tone: 'friendly, helpful, not salesy',
    style: 'Offer genuine value first, mention solution naturally',
  },
  expert: {
    tone: 'professional, knowledgeable',
    style: 'Share insight about their problem, offer expertise',
  },
  curious: {
    tone: 'curious, engaging',
    style: 'Ask questions about their challenge, show interest',
  },
};

interface Lead {
  id?: string;
  source_url: string;
  source_type: string;
  title: string;
  content: string;
  author?: string;
  relevance_score: number;
}

interface OutreachMessage {
  lead_id: string;
  message_type: 'initial' | 'follow_up_1' | 'follow_up_2' | 'final';
  channel: string;
  content: string;
  persona: string;
  scheduled_for: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { leads: inputLeads, mode = 'initial' } = await req.json();
    
    // Get leads to process
    let leadsToProcess: Lead[] = inputLeads || [];
    
    if (!inputLeads) {
      // Fetch unprocessed leads from DB
      const { data: dbLeads } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'new')
        .order('relevance_score', { ascending: false })
        .limit(10);
      
      leadsToProcess = dbLeads || [];
    }

    if (leadsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No leads to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Processing ${leadsToProcess.length} leads for outreach...`);

    const outreachMessages: OutreachMessage[] = [];

    for (const lead of leadsToProcess) {
      // Select persona based on lead characteristics
      const persona = lead.relevance_score >= 80 ? 'expert' : 
                      lead.relevance_score >= 60 ? 'helpful' : 'curious';
      
      const personaConfig = OUTREACH_PERSONAS[persona];
      
      // Generate personalized message with AI
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'AI Outreach',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are an expert at writing engaging, non-spammy outreach messages.

Your tone: ${personaConfig.tone}
Your style: ${personaConfig.style}

Rules:
1. NEVER be pushy or salesy
2. Reference their specific problem/question
3. Offer genuine value or insight
4. Keep it SHORT (2-3 sentences max)
5. End with a soft call-to-action (question, not demand)
6. Sound human, not like a bot

Our service: AI-powered automation that helps startups and developers ship faster.

Return JSON with:
- message: The outreach message
- subject: Short subject line (if email)
- hook: Why this message should work`
            },
            {
              role: 'user',
              content: `Lead context:
Source: ${lead.source_type}
Their post/question: "${lead.title}"
Details: "${lead.content.slice(0, 500)}"
Author: ${lead.author || 'Unknown'}

Write an initial outreach message for ${lead.source_type === 'reddit' ? 'Reddit comment/DM' : 'direct message'}.`
            }
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiResponse.ok) {
        console.warn(`AI failed for lead: ${lead.title}`);
        continue;
      }

      const aiData = await aiResponse.json();
      const messageData = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');
      
      if (messageData.message) {
        const outreach: OutreachMessage = {
          lead_id: lead.id || crypto.randomUUID(),
          message_type: 'initial',
          channel: lead.source_type,
          content: messageData.message,
          persona: persona,
          scheduled_for: new Date().toISOString(),
        };
        
        outreachMessages.push(outreach);
        
        // Save to outreach queue
        await supabase.from('outreach_queue').insert({
          lead_id: lead.id,
          source_url: lead.source_url,
          message_type: outreach.message_type,
          channel: outreach.channel,
          message_content: outreach.content,
          subject: messageData.subject,
          persona: outreach.persona,
          status: 'queued',
          scheduled_for: outreach.scheduled_for,
        });
        
        // Update lead status
        if (lead.id) {
          await supabase
            .from('leads')
            .update({ status: 'outreach_queued' })
            .eq('id', lead.id);
        }
      }
    }

    // Generate follow-up sequences for high-value leads
    const highValueLeads = leadsToProcess.filter(l => l.relevance_score >= 75);
    
    for (const lead of highValueLeads) {
      // Schedule follow-ups
      const followUpDays = [2, 5, 10]; // Days after initial contact
      
      for (let i = 0; i < followUpDays.length; i++) {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + followUpDays[i]);
        
        await supabase.from('outreach_queue').insert({
          lead_id: lead.id,
          source_url: lead.source_url,
          message_type: i === 0 ? 'follow_up_1' : i === 1 ? 'follow_up_2' : 'final',
          channel: lead.source_type,
          message_content: null, // Will be generated when it's time to send
          status: 'scheduled',
          scheduled_for: scheduledDate.toISOString(),
        });
      }
    }

    // Send Telegram notification for hot leads
    const hotLeads = leadsToProcess.filter(l => l.relevance_score >= 80);
    if (hotLeads.length > 0) {
      const hotLeadsSummary = hotLeads
        .map(l => `• ${l.title} (${l.relevance_score}%)`)
        .join('\n');
      
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `🎯 <b>Hot Leads Found!</b>\n\n${hotLeadsSummary}\n\n📧 Outreach queued automatically`,
          type: 'lead_alert',
        },
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000003', // Sentinel for outreach
      action: 'outreach_generated',
      metadata: {
        leads_processed: leadsToProcess.length,
        messages_created: outreachMessages.length,
        hot_leads: hotLeads.length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        leads_processed: leadsToProcess.length,
        messages_created: outreachMessages.length,
        hot_leads_alerted: hotLeads.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Outreach error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
