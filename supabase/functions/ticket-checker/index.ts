/**
 * Ticket Checker Edge Function
 * Fast fetch-based check for NOL World ticket availability
 * Runs via Supabase cron (pg_cron) every 1-2 minutes
 * No browser needed - lightweight and fast
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyCronSecret } from "../_shared/auth-guards.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const SOURCES = {
  nolWorld: {
    name: 'NOL World (Official)',
    eventUrl: 'https://world.nol.com/en/ticket/places/26000193/products/26002658',
  },
  tixel: {
    name: 'Tixel',
    searchUrl: 'https://tixel.com/search?q=stray+kids+fan+meeting',
  },
};

const DATE_LABELS: Record<string, string> = {
  '2026-03-28': 'שבת 28.3 (Day 1)',
  '2026-03-29': 'ראשון 29.3 (Day 2)',
  '2026-04-04': 'שבת 4.4 (Day 3)',
  '2026-04-05': 'ראשון 5.4 (Day 4)',
};

const TARGET_DATES = ['2026-03-28', '2026-03-29', '2026-04-04', '2026-04-05'];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function parseStoredResults(rawResults: unknown): Array<{ source: string; url: string }> {
  if (!rawResults) return [];

  try {
    const parsed = typeof rawResults === 'string' ? JSON.parse(rawResults) : rawResults;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((result) => {
        if (!result || typeof result !== 'object') return null;
        const entry = result as Record<string, unknown>;

        const source = typeof entry.source === 'string' ? entry.source : '';
        const url = typeof entry.url === 'string' ? entry.url : '';
        return source && url ? { source, url } : null;
      })
      .filter((result): result is { source: string; url: string } => result !== null);
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authResult = verifyCronSecret(req);
  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.error || 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Array<{
      source: string;
      status: string;
      details: string;
      url: string;
    }> = [];

    // === Check NOL World ===
    try {
      const response = await fetch(SOURCES.nolWorld.eventUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
        },
      });

      const html = await response.text();
      const bodyLower = html.toLowerCase();

      const soldOut = bodyLower.includes('sold out') || bodyLower.includes('매진') || bodyLower.includes('soldout');
      const hasBooking = bodyLower.includes('booking') || bodyLower.includes('예매') || bodyLower.includes('purchase');
      const hasCancellation = bodyLower.includes('cancellation') || bodyLower.includes('취소표') || bodyLower.includes('returned');

      if (hasCancellation || (hasBooking && !soldOut)) {
        results.push({
          source: SOURCES.nolWorld.name,
          status: hasCancellation ? 'CANCELLATION_DETECTED' : 'POSSIBLY_AVAILABLE',
          details: hasCancellation ? 'Cancellation tickets may be available!' : 'Booking appears to be open!',
          url: SOURCES.nolWorld.eventUrl,
        });
      }

      console.log(`NOL World: ${soldOut ? 'Sold Out' : hasCancellation ? 'CANCELLATION!' : hasBooking ? 'BOOKING OPEN!' : 'No change'}`);
    } catch (err) {
      console.error('NOL check failed:', err);
    }

    // === Check Tixel (fetch-based) ===
    try {
      const response = await fetch(SOURCES.tixel.searchUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      });
      const html = await response.text();
      const bodyLower = html.toLowerCase();

      const hasStrayKids = bodyLower.includes('stray kids') &&
        (bodyLower.includes('fan meeting') || bodyLower.includes('little house'));
      const noResults = bodyLower.includes('no results') || bodyLower.includes('no tickets');

      if (hasStrayKids && !noResults) {
        results.push({
          source: SOURCES.tixel.name,
          status: 'TICKETS_FOUND',
          details: 'Stray Kids listings found on Tixel!',
          url: SOURCES.tixel.searchUrl,
        });
      }
    } catch (err) {
      console.error('Tixel check failed:', err);
    }

    // === Check if new finding vs previous state ===
    const { data: lastState } = await supabase
      .from('ticket_scraper_state')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const lastResults = parseStoredResults(lastState?.results);
    const lastSignatures = new Set(lastResults.map((result) => `${result.source}::${result.url}`));
    const isNewFinding = results.length > 0 &&
      results.some((result) => !lastSignatures.has(`${result.source}::${result.url}`));

    // Save state
    await supabase.from('ticket_scraper_state').insert({
      results: JSON.stringify(results),
      found_count: results.length,
      source: 'edge_function',
      checked_at: new Date().toISOString(),
    });

    // Send Telegram alert for new findings
    if (results.length > 0 && isNewFinding) {
      const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const message =
          `🎫🎫🎫 TICKET ALERT! 🎫🎫🎫\n\n` +
          `<b>Stray Kids 6th Fan Meeting</b>\n` +
          `<b>"STAY in Our Little House"</b>\n\n` +
          results.map((r) =>
            `🔥 <b>${r.source}</b>\n   📝 ${r.details}\n   🔗 ${r.url}`
          ).join('\n\n') +
          `\n\n⚡ GO NOW! Check the links above!\n` +
          `📅 Dates: ${TARGET_DATES.map(d => DATE_LABELS[d]).join(', ')}`;

        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const telegramRes = await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        });

        if (!telegramRes.ok) {
          // Fallback: plain text
          await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: message.replace(/<[^>]+>/g, ''),
            }),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        found: results.length,
        alerted: isNewFinding && results.length > 0,
        results,
        checked_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Ticket checker error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
