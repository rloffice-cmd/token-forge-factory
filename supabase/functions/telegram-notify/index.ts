/**
 * Telegram Notification Edge Function
 * Sends alerts for system events: stuck jobs, daily reports, errors
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type NotificationType = 'stuck' | 'daily_report' | 'error' | 'success' | 'kill_gate';

interface NotifyRequest {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error('Missing Telegram credentials');
    }

    const { type, title, message, data }: NotifyRequest = await req.json();

    // Build message with emoji based on type
    const emoji = getEmoji(type);
    let text = `${emoji} *${escapeMarkdown(title)}*\n\n${escapeMarkdown(message)}`;
    
    // Add data if provided
    if (data && Object.keys(data).length > 0) {
      text += '\n\n```json\n' + JSON.stringify(data, null, 2) + '\n```';
    }

    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'MarkdownV2',
      }),
    });

    const result = await telegramResponse.json();

    if (!telegramResponse.ok) {
      console.error('Telegram API error:', result);
      // Retry without markdown if it fails
      const plainResponse = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: `${emoji} ${title}\n\n${message}`,
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

function getEmoji(type: NotificationType): string {
  switch (type) {
    case 'stuck': return '🚨';
    case 'daily_report': return '📊';
    case 'error': return '❌';
    case 'success': return '✅';
    case 'kill_gate': return '⚠️';
    default: return '📢';
  }
}

function escapeMarkdown(text: string): string {
  // Escape special characters for MarkdownV2
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
