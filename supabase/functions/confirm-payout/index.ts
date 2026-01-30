/**
 * Confirm Payout Edge Function
 * Updates payout status and creates ledger OUT entry
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConfirmPayoutInput {
  request_id: string;
  tx_hash: string;
  status: 'signed' | 'submitted' | 'confirmed' | 'failed';
  error_message?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const input: ConfirmPayoutInput = await req.json();
    
    // Validate input
    if (!input.request_id) {
      return new Response(
        JSON.stringify({ error: 'Missing request_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!input.status) {
      return new Response(
        JSON.stringify({ error: 'Missing status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get existing request
    const { data: existing, error: fetchError } = await supabase
      .from('cashout_requests')
      .select('*')
      .eq('id', input.request_id)
      .single();
    
    if (fetchError) throw fetchError;
    if (!existing) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Build update object
    const updates: Record<string, unknown> = { status: input.status };
    
    if (input.status === 'signed') {
      updates.signed_at = new Date().toISOString();
    } else if (input.status === 'submitted') {
      updates.submitted_at = new Date().toISOString();
      if (input.tx_hash) {
        updates.tx_hash = input.tx_hash;
      }
    } else if (input.status === 'confirmed') {
      updates.confirmed_at = new Date().toISOString();
      
      // Create ledger OUT entry for confirmed transactions
      const { error: ledgerError } = await supabase
        .from('treasury_ledger')
        .insert({
          amount: existing.amount_dtf,
          asset: 'DTF-TOKEN',
          direction: 'OUT',
          tx_hash: input.tx_hash || existing.tx_hash,
          job_id: existing.id, // Use request ID as reference
        });
      
      if (ledgerError) {
        console.error('Failed to create ledger entry:', ledgerError);
        // Don't fail the whole operation, just log
      }
    } else if (input.status === 'failed') {
      if (input.error_message) {
        updates.error_message = input.error_message;
      }
    }
    
    // Update request
    const { data: updated, error: updateError } = await supabase
      .from('cashout_requests')
      .update(updates)
      .eq('id', input.request_id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Send Telegram notification for confirmed payouts
    if (input.status === 'confirmed') {
      try {
        const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
        
        if (telegramToken && chatId) {
          const message = `✅ *משיכה אושרה!*\n\n` +
            `💰 סכום: ${existing.amount_dtf} DTF\n` +
            `💵 שווי: $${existing.amount_usd}\n` +
            `🔗 TX: [צפה ב-Etherscan](https://etherscan.io/tx/${input.tx_hash || existing.tx_hash})`;
          
          await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
            }),
          });
        }
      } catch (notifyError) {
        console.error('Telegram notification failed:', notifyError);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        request: updated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error confirming payout:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
