/**
 * Send Test Telegram - CLEARLY MARKED AS TEST
 * 
 * RULES:
 * 1. Message MUST include [TEST] marker
 * 2. Logged as is_test=true in notifications
 * 3. Does NOT count as real revenue
 * 4. Requires ADMIN_API_TOKEN
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ADMIN_API_TOKEN = Deno.env.get('ADMIN_API_TOKEN');
  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Verify admin token
  const adminToken = req.headers.get('x-admin-token');
  if (!ADMIN_API_TOKEN || adminToken !== ADMIN_API_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return new Response(
      JSON.stringify({ error: 'Telegram not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Build TEST message - clearly marked
    const testMessage = `🧪 <b>[TEST] בדיקת מערכת</b>

⚠️ זו הודעת בדיקה בלבד!
לא נכנס כסף אמיתי.

<b>Timestamp:</b> ${new Date().toISOString()}
<b>Status:</b> Telegram integration working ✅

<i>הודעה זו מסומנת כ-TEST ולא נכנסת לדוחות הכנסות.</i>`;

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: testMessage,
        parse_mode: 'HTML',
      }),
    });

    const result = await response.json();
    const success = response.ok && result.ok;

    // Log as TEST notification - won't appear in real reports
    await supabase.from('notifications').insert({
      event_type: 'test',
      message: 'Test telegram sent',
      was_sent: success,
      is_test: true, // CRITICAL: Mark as test
      source: 'admin_ui',
      metadata: {
        telegram_response: result,
        triggered_by: 'manual_test',
      },
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: '00000000-0000-0000-0000-000000000000',
      action: 'TEST_TELEGRAM_SENT',
      metadata: {
        success,
        source: 'admin_ui',
        is_test: true,
      },
    });

    return new Response(
      JSON.stringify({ 
        success, 
        message: success ? 'Test message sent' : 'Failed to send',
        telegram_result: result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Test telegram error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
