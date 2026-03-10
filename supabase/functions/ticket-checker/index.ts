/**
 * Ticket Checker Edge Function
 * Fast fetch-based check for NOL World ticket availability
 * Runs via Supabase cron (pg_cron) every 1-2 minutes
 * No browser needed - lightweight and fast
 *
 * STRICT MODE: Default assumption is SOLD OUT.
 * Only alerts on strong positive signals (cancellation tickets, price+cart).
 * Generic words like "booking" or "purchase" in site navigation are IGNORED.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Verify cron secret (optional, for security)
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  if (expectedSecret && cronSecret !== expectedSecret) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
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

    // === Check NOL World (STRICT mode) ===
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

      // Confirm sold out (normal state)
      const soldOut = bodyLower.includes('sold out') || bodyLower.includes('매진') || bodyLower.includes('soldout');

      // Only very specific cancellation phrases (NOT generic "cancellation" which could be in policies)
      const cancelPatterns = ['cancellation ticket', '취소표 예매', 'returned ticket', 'released ticket'];
      const hasCancellation = cancelPatterns.some((p) => bodyLower.includes(p));

      // Check for actual price + quantity indicators (real purchase flow)
      const priceRegex = /[₩$€]\s*[\d,]{3,}/;
      const hasPrice = priceRegex.test(html);
      const hasQuantitySelect = bodyLower.includes('select quantity') || bodyLower.includes('수량 선택') ||
        bodyLower.includes('add to cart') || bodyLower.includes('장바구니');

      if (hasCancellation) {
        results.push({
          source: SOURCES.nolWorld.name,
          status: 'CANCELLATION_DETECTED',
          details: 'Cancellation tickets detected on the page!',
          url: SOURCES.nolWorld.eventUrl,
        });
      } else if (hasPrice && hasQuantitySelect && !soldOut) {
        results.push({
          source: SOURCES.nolWorld.name,
          status: 'POSSIBLY_AVAILABLE',
          details: 'Price and quantity selector found - tickets may be available!',
          url: SOURCES.nolWorld.eventUrl,
        });
      }

      console.log(`NOL World: ${soldOut ? 'Sold Out (confirmed)' : hasCancellation ? 'CANCELLATION!' : 'No availability signals'}`);
    } catch (err) {
      console.error('NOL check failed:', err);
    }

    // === Check Tixel (STRICT mode) ===
    try {
      const response = await fetch(SOURCES.tixel.searchUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      });
      const html = await response.text();
      const bodyLower = html.toLowerCase();

      const hasStrayKids = bodyLower.includes('stray kids') &&
        (bodyLower.includes('fan meeting') || bodyLower.includes('little house'));

      // Check for EXPLICIT no-ticket indicators
      const noResults = bodyLower.includes('no results') || bodyLower.includes('no tickets') ||
        bodyLower.includes('currently unavailable') || bodyLower.includes('check back later');

      // STRICT: Also require price indicators to confirm real listings
      const priceRegex = /(?:from\s+)?[$€£₩]\s*\d[\d,]*(?:\.\d{2})?/gi;
      const priceMatches = html.match(priceRegex) || [];
      const hasRealPrices = priceMatches.length > 0;

      if (hasStrayKids && !noResults && hasRealPrices) {
        results.push({
          source: SOURCES.tixel.name,
          status: 'TICKETS_FOUND',
          details: `Stray Kids listings with prices found on Tixel! (${priceMatches.slice(0, 2).join(', ')})`,
          url: SOURCES.tixel.searchUrl,
        });
      }

      console.log(`Tixel: ${noResults ? 'No results' : !hasStrayKids ? 'No relevant listings' : !hasRealPrices ? 'Listings but no prices' : 'TICKETS FOUND!'}`);
    } catch (err) {
      console.error('Tixel check failed:', err);
    }

    // === Check if new finding vs previous state (signature-based) ===
    const currentSignature = results.map(r => `${r.source}:${r.status}`).sort().join('|');

    const { data: lastState } = await supabase
      .from('ticket_scraper_state')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const lastSignature = lastState?.result_signature || '';
    const isNewFinding = results.length > 0 && currentSignature !== lastSignature;

    // Save state with signature for dedup
    await supabase.from('ticket_scraper_state').insert({
      results: JSON.stringify(results),
      found_count: results.length,
      result_signature: currentSignature,
      source: 'edge_function',
      checked_at: new Date().toISOString(),
    });

    // Send Telegram alert only for genuinely new findings
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
          `\n\n⚡ Check the links above!\n` +
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
