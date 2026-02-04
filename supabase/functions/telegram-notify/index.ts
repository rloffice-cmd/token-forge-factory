/**
 * Telegram Notification Edge Function
 * Sends alerts for system events: stuck jobs, daily reports, errors
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types that are ALWAYS allowed even during emergency stop
const ALWAYS_ALLOWED_TYPES = ['payment_confirmed', 'cashout', 'error', 'kill_gate', 'critical'];

type NotificationType = 'stuck' | 'daily_report' | 'error' | 'success' | 'kill_gate' | 'cashout' | 'payment_confirmed' | 'critical' | string;

interface NotifyRequest {
  type?: NotificationType;
  title?: string;
  message: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: NotifyRequest = await req.json();
    const { type = 'success', title, message, data } = body;

    // ========== EMERGENCY STOP CHECK ==========
    // Only allow critical notifications during emergency stop
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('emergency_stop')
      .single();

    if (settings?.emergency_stop && !ALWAYS_ALLOWED_TYPES.includes(type)) {
      console.log(`🛑 Telegram blocked during emergency_stop: type=${type}`);
      return new Response(
        JSON.stringify({ success: false, reason: 'emergency_stop_active', blocked_type: type }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error('Missing Telegram credentials');
    }

    // If message contains HTML tags, send as HTML; otherwise use title + message format
    const isHtmlMessage = message.includes('<b>') || message.includes('<i>');
    
    let text: string;
    if (isHtmlMessage) {
      // Send HTML message directly (from cashout alert, etc.)
      text = message;
    } else if (title) {
      // Build markdown message with title
      const emoji = getEmoji(type);
      text = `${emoji} *${escapeMarkdown(title)}*\n\n${escapeMarkdown(message)}`;
      
      // Add data if provided
      if (data && Object.keys(data).length > 0) {
        text += '\n\n```json\n' + JSON.stringify(data, null, 2) + '\n```';
      }
    } else {
      // Simple text message
      text = message;
    }

    // Determine parse mode based on content
    const parseMode = isHtmlMessage ? 'HTML' : 'MarkdownV2';
    
    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    const result = await telegramResponse.json();

    if (!telegramResponse.ok) {
      console.error('Telegram API error:', result);
      // Retry with plain text if formatted message fails
      const plainText = title ? `${getEmoji(type)} ${title}\n\n${message}` : message;
      const plainResponse = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: plainText,
        }),
      });
      const plainResult = await plainResponse.json();
      return new Response(JSON.stringify({ success: plainResponse.ok, result: plainResult }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getEmoji(type: NotificationType | undefined): string {
  switch (type) {
    case 'stuck': return '🚨';
    case 'daily_report': return '📊';
    case 'error': return '❌';
    case 'success': return '✅';
    case 'kill_gate': return '⚠️';
    case 'cashout': return '💰';
    default: return '📢';
  }
}

function escapeMarkdown(text: string): string {
  // Escape special characters for MarkdownV2
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
