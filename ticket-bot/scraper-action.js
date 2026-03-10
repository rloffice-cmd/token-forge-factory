/**
 * One-shot ticket scraper for GitHub Actions
 * Runs once, checks all sources, sends alerts, then exits
 *
 * IMPORTANT: Default assumption is SOLD OUT. Only alert on strong
 * positive signals of real availability (prices, quantities, add-to-cart).
 * Generic words like "booking" or "purchase" in site navigation are IGNORED.
 */
import puppeteer from 'puppeteer';

// ============== CONFIGURATION ==============
const CONFIG = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  targetDates: (process.env.TARGET_DATES || '2026-03-28,2026-03-29,2026-04-04,2026-04-05').split(','),
};

const SOURCES = {
  nolWorld: {
    name: 'NOL World (Official)',
    eventUrl: 'https://world.nol.com/en/ticket/places/26000193/products/26002658',
  },
  tixel: {
    name: 'Tixel (Resale)',
    searchUrl: 'https://tixel.com/search?q=stray+kids+fan+meeting',
  },
  seatpick: {
    name: 'SeatPick (Resale)',
    searchUrl: 'https://seatpick.com/stray-kids-tickets',
  },
  vividseats: {
    name: 'VividSeats (Resale)',
    searchUrl: 'https://www.vividseats.com/stray-kids-tickets/performer/103531',
  },
};

const DATE_LABELS = {
  '2026-03-28': 'שבת 28.3 (Day 1)',
  '2026-03-29': 'ראשון 29.3 (Day 2)',
  '2026-04-04': 'שבת 4.4 (Day 3)',
  '2026-04-05': 'ראשון 5.4 (Day 4)',
};

// ============== TELEGRAM ==============
async function sendTelegram(message) {
  if (!CONFIG.telegram.token || !CONFIG.telegram.chatId) {
    console.log('⚠️ Telegram not configured');
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${CONFIG.telegram.token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.telegram.chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      // Retry without HTML parsing
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CONFIG.telegram.chatId, text: message.replace(/<[^>]+>/g, '') }),
      });
    }
    console.log('📱 Telegram sent');
  } catch (err) {
    console.error('❌ Telegram failed:', err.message);
  }
}

// ============== STATE (Supabase) ==============
async function getLastState() {
  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceKey) return null;
  try {
    const res = await fetch(
      `${CONFIG.supabase.url}/rest/v1/ticket_scraper_state?select=*&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: CONFIG.supabase.serviceKey,
          Authorization: `Bearer ${CONFIG.supabase.serviceKey}`,
        },
      }
    );
    const data = await res.json();
    return data?.[0] || null;
  } catch {
    return null;
  }
}

async function saveState(results) {
  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceKey) return;
  try {
    await fetch(`${CONFIG.supabase.url}/rest/v1/ticket_scraper_state`, {
      method: 'POST',
      headers: {
        apikey: CONFIG.supabase.serviceKey,
        Authorization: `Bearer ${CONFIG.supabase.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        results: JSON.stringify(results),
        found_count: results.length,
        // Store a signature so we can detect truly new findings
        result_signature: results.map(r => `${r.source}:${r.status}`).sort().join('|'),
        checked_at: new Date().toISOString(),
      }),
    });
  } catch {
    // State saving is optional
  }
}

// ============== NOL API CHECK (fast, no browser) ==============
async function checkNolWorldAPI() {
  console.log('🔍 Quick API check on NOL World...');
  try {
    const response = await fetch(SOURCES.nolWorld.eventUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
      },
    });
    const html = await response.text();
    const bodyLower = html.toLowerCase();

    // === STRICT availability detection ===
    // We ONLY alert on strong positive signals, NOT on generic site words.

    // 1. Check for explicit cancellation ticket indicators (very specific)
    const cancelPatterns = ['cancellation ticket', '취소표 예매', 'returned ticket', 'released ticket'];
    const hasCancellation = cancelPatterns.some((p) => bodyLower.includes(p));

    // 2. Check for quantity/price selectors (indicates active sale)
    //    Look for patterns like "₩88,000" or "select quantity" or "add to cart"
    const priceRegex = /[₩$€]\s*[\d,]+/;
    const hasPrice = priceRegex.test(html);
    const hasQuantitySelect = bodyLower.includes('select quantity') || bodyLower.includes('수량 선택') ||
      bodyLower.includes('add to cart') || bodyLower.includes('장바구니');

    // 3. Check for sold out (to confirm the normal state)
    const soldOut = bodyLower.includes('sold out') || bodyLower.includes('매진') || bodyLower.includes('soldout');

    // Only trigger on very specific signals
    if (hasCancellation) {
      return [{
        source: 'NOL World API',
        date: 'Check manually',
        status: 'CANCELLATION_DETECTED',
        url: SOURCES.nolWorld.eventUrl,
        details: 'Cancellation tickets detected on the page!',
      }];
    }

    if (hasPrice && hasQuantitySelect && !soldOut) {
      return [{
        source: 'NOL World API',
        date: 'Check manually',
        status: 'POSSIBLY_AVAILABLE',
        url: SOURCES.nolWorld.eventUrl,
        details: 'Price and quantity selector found - tickets may be available!',
      }];
    }

    console.log(`   ${soldOut ? '❌ Sold Out (confirmed)' : '⏳ No availability signals detected'}`);
    return [];
  } catch (err) {
    console.error(`   ❌ API check failed: ${err.message}`);
    return [];
  }
}

// ============== BROWSER SCRAPERS ==============
async function checkNolWorld(browser) {
  console.log(`🔍 Checking ${SOURCES.nolWorld.name} (browser)...`);
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(SOURCES.nolWorld.eventUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('body', { timeout: 10000 });

    const results = [];
    for (const targetDate of CONFIG.targetDates) {
      const dateLabel = DATE_LABELS[targetDate] || targetDate;

      const availability = await page.evaluate(() => {
        const body = document.body.innerText.toLowerCase();
        const html = document.body.innerHTML.toLowerCase();

        // === STRICT checks - only strong positive signals ===

        // 1. Sold out confirmation
        const soldOutPatterns = ['sold out', 'soldout', 'sold-out', '매진', 'tickets unavailable'];
        const isSoldOut = soldOutPatterns.some((p) => body.includes(p));

        // 2. Cancellation tickets (very specific phrase)
        const cancelPatterns = ['cancellation ticket', '취소표 예매', 'returned ticket', 'released ticket'];
        const hasCancelTickets = cancelPatterns.some((p) => body.includes(p));

        // 3. Active purchase flow elements (NOT generic nav buttons)
        //    Look for: quantity dropdown, seat selection, price display with currency, add-to-cart
        const hasQuantitySelector = !!document.querySelector(
          'select[name*="quantity"], select[name*="qty"], input[name*="quantity"], [class*="quantity-select"], [class*="qty"]'
        );
        const hasAddToCart = !!document.querySelector(
          'button[class*="cart"], button[class*="purchase"], [class*="add-to-cart"], [data-action*="cart"]'
        );
        const hasSeatSelection = !!document.querySelector(
          '[class*="seat-map"], [class*="seatmap"], [class*="seat-select"], [class*="zone-select"]'
        );

        // 4. Check for actual price amounts near buy-like elements
        const priceRegex = /[₩$€]\s*[\d,]{3,}/;
        const hasPriceOnPage = priceRegex.test(document.body.innerText);

        // A real purchase flow needs MULTIPLE signals together
        const hasRealPurchaseFlow = hasPriceOnPage && (hasQuantitySelector || hasAddToCart || hasSeatSelection);

        return {
          isSoldOut,
          hasCancelTickets,
          hasRealPurchaseFlow,
          hasQuantitySelector,
          hasAddToCart,
          hasPriceOnPage,
        };
      });

      if (availability.hasCancelTickets) {
        results.push({
          source: SOURCES.nolWorld.name,
          date: dateLabel,
          status: 'CANCELLATION_DETECTED',
          url: SOURCES.nolWorld.eventUrl,
          details: 'Cancellation tickets detected!',
        });
      } else if (availability.hasRealPurchaseFlow && !availability.isSoldOut) {
        results.push({
          source: SOURCES.nolWorld.name,
          date: dateLabel,
          status: 'POSSIBLY_AVAILABLE',
          url: SOURCES.nolWorld.eventUrl,
          details: 'Active purchase flow detected (price + cart/quantity)!',
        });
      } else {
        console.log(`   ${dateLabel}: ${availability.isSoldOut ? '❌ Sold Out' : '⏳ No real availability signals'}`);
      }
    }
    await page.close();
    return results;
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    return [];
  }
}

async function checkSecondaryMarket(browser, sourceKey) {
  const source = SOURCES[sourceKey];
  if (!source?.searchUrl) return [];
  console.log(`🔍 Checking ${source.name}...`);

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(source.searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('body', { timeout: 10000 });

    const availability = await page.evaluate(() => {
      const body = document.body.innerText;
      const bodyLower = body.toLowerCase();
      const links = Array.from(document.querySelectorAll('a'));

      // Find links specifically about Stray Kids fan meeting
      const relevantLinks = links.filter((a) => {
        const text = (a.textContent + ' ' + a.href).toLowerCase();
        return (text.includes('stray kids') || text.includes('스트레이 키즈')) &&
          (text.includes('fan meeting') || text.includes('fanmeeting') || text.includes('little house'));
      });

      // === STRICT: Check for actual ticket pricing near the listing ===
      // Look for real price amounts like "$150", "€89", "From $100"
      const priceRegex = /(?:from\s+)?[$€£₩]\s*\d[\d,]*(?:\.\d{2})?/gi;
      const priceMatches = body.match(priceRegex) || [];

      // Check for explicit "no tickets" messages
      const noTicketPatterns = ['no tickets available', 'currently unavailable', 'no events found',
        'no results found', 'all sold out', '0 tickets', 'check back later'];
      const noTickets = noTicketPatterns.some((p) => bodyLower.includes(p));

      // Check for actual "buy" buttons near listings (not in nav)
      const buyButtons = Array.from(document.querySelectorAll(
        '[class*="listing"] button, [class*="event"] button, [class*="ticket"] a[href*="checkout"], [class*="buy-btn"], [data-testid*="buy"]'
      ));
      const hasActualBuyButtons = buyButtons.length > 0;

      return {
        foundLinks: relevantLinks.map((a) => ({ text: a.textContent.trim().substring(0, 100), href: a.href })),
        priceCount: priceMatches.length,
        firstPrices: priceMatches.slice(0, 3),
        noTickets,
        hasActualBuyButtons,
      };
    });

    const results = [];

    // STRICT: Only report if we found relevant links AND (real prices OR actual buy buttons)
    // AND no "no tickets" message
    if (
      availability.foundLinks.length > 0 &&
      !availability.noTickets &&
      (availability.priceCount > 0 || availability.hasActualBuyButtons)
    ) {
      for (const link of availability.foundLinks.slice(0, 2)) { // max 2 results per source
        results.push({
          source: source.name,
          date: 'Check listing',
          status: 'TICKETS_FOUND',
          url: link.href || source.searchUrl,
          details: `${link.text}${availability.firstPrices.length > 0 ? ` | Prices: ${availability.firstPrices.join(', ')}` : ''}`,
        });
      }
    } else {
      const reason = availability.noTickets
        ? '❌ No tickets available'
        : availability.foundLinks.length === 0
          ? '⏳ No relevant listings'
          : '⏳ Listings found but no actual prices/buy options';
      console.log(`   ${reason}`);
    }
    await page.close();
    return results;
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    return [];
  }
}

// ============== MAIN ==============
async function main() {
  const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  console.log(`\n🔄 Ticket Check | ${now} (Israel Time)`);

  const allResults = [];

  // Quick API check
  const apiResults = await checkNolWorldAPI();
  allResults.push(...apiResults);

  // Browser checks
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const nolResults = await checkNolWorld(browser);
    allResults.push(...nolResults);

    for (const sourceKey of ['tixel', 'seatpick', 'vividseats']) {
      const results = await checkSecondaryMarket(browser, sourceKey);
      allResults.push(...results);
    }
  } catch (err) {
    console.error('Browser error:', err.message);
  } finally {
    if (browser) await browser.close();
  }

  // Check if this is a NEW finding (compare signatures, not just counts)
  const lastState = await getLastState();
  const currentSignature = allResults.map(r => `${r.source}:${r.status}`).sort().join('|');
  const lastSignature = lastState?.result_signature || '';
  const isNewFinding = allResults.length > 0 && currentSignature !== lastSignature;

  // Save current state
  await saveState(allResults);

  // Send alert only for genuinely new findings
  if (allResults.length > 0 && isNewFinding) {
    const message =
      `🎫🎫🎫 TICKET ALERT! 🎫🎫🎫\n\n` +
      `<b>Stray Kids 6th Fan Meeting</b>\n` +
      `<b>"STAY in Our Little House"</b>\n\n` +
      allResults.map((r) =>
        `🔥 <b>${r.source}</b>\n   📅 ${r.date}\n   📝 ${r.details}\n   🔗 ${r.url}`
      ).join('\n\n') +
      `\n\n⚡ Check the links above!`;

    await sendTelegram(message);
    console.log(`\n🎫 FOUND ${allResults.length} results! Alert sent.`);
    process.exit(0);
  } else if (allResults.length > 0) {
    console.log(`\n🎫 ${allResults.length} results (already alerted, same signature)`);
  } else {
    console.log(`\n⏳ No tickets found. All clear.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
