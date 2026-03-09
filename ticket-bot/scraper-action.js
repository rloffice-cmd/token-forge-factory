/**
 * One-shot ticket scraper for GitHub Actions
 * Runs once, checks all sources, sends alerts, then exits
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
      },
    });
    const html = await response.text();
    const bodyLower = html.toLowerCase();

    const soldOut = bodyLower.includes('sold out') || bodyLower.includes('매진');
    const hasBooking = bodyLower.includes('booking') || bodyLower.includes('예매') || bodyLower.includes('purchase');
    const hasCancellation = bodyLower.includes('cancellation') || bodyLower.includes('취소표');

    if (hasCancellation || (hasBooking && !soldOut)) {
      return [{
        source: 'NOL World API',
        date: 'Check manually',
        status: 'POSSIBLY_AVAILABLE',
        url: SOURCES.nolWorld.eventUrl,
        details: hasCancellation ? 'Cancellation tickets detected!' : 'Booking may be open!',
      }];
    }
    console.log(`   ${soldOut ? '❌ Sold Out' : '⏳ No change'}`);
    return [];
  } catch (err) {
    console.error(`   ❌ API check failed: ${err.message}`);
    return [];
  }
}

// ============== BROWSER SCRAPERS ==============
async function checkNolWorld(browser) {
  console.log(`🔍 Checking ${SOURCES.nolWorld.name}...`);
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(SOURCES.nolWorld.eventUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('body', { timeout: 10000 });

    const results = [];
    for (const targetDate of CONFIG.targetDates) {
      const dateLabel = DATE_LABELS[targetDate] || targetDate;
      const availability = await page.evaluate((date) => {
        const body = document.body.innerText.toLowerCase();
        const soldOutPatterns = ['sold out', 'soldout', 'sold-out', '매진', 'unavailable'];
        const isSoldOut = soldOutPatterns.some((p) => body.includes(p));
        const bookButtons = document.querySelectorAll('button:not([disabled]), a[href*="book"], a[href*="ticket"]');
        const hasActiveButtons = Array.from(bookButtons).some((btn) => {
          const text = btn.textContent.toLowerCase();
          return (text.includes('book') || text.includes('buy') || text.includes('예매')) && !text.includes('sold');
        });
        const cancelPatterns = ['cancellation', 'returned', 'released', '취소표'];
        const hasCancelTickets = cancelPatterns.some((p) => body.includes(p));
        return { isSoldOut, hasActiveButtons, hasCancelTickets };
      }, targetDate);

      if (availability.hasCancelTickets || (availability.hasActiveButtons && !availability.isSoldOut)) {
        results.push({
          source: SOURCES.nolWorld.name,
          date: dateLabel,
          status: 'POSSIBLY_AVAILABLE',
          url: SOURCES.nolWorld.eventUrl,
          details: availability.hasCancelTickets ? 'Cancellation tickets detected!' : 'Active booking buttons found!',
        });
      } else {
        console.log(`   ${dateLabel}: ${availability.isSoldOut ? '❌ Sold Out' : '⏳ No availability'}`);
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
      const body = document.body.innerText.toLowerCase();
      const links = Array.from(document.querySelectorAll('a'));
      const relevantLinks = links.filter((a) => {
        const text = (a.textContent + ' ' + a.href).toLowerCase();
        return (text.includes('stray kids') || text.includes('스트레이 키즈')) &&
          (text.includes('fan meeting') || text.includes('fanmeeting') || text.includes('little house'));
      });
      const noTicketPatterns = ['no tickets', 'not available', 'no events', 'no results', 'sold out'];
      const noTickets = noTicketPatterns.some((p) => body.includes(p));
      return {
        foundLinks: relevantLinks.map((a) => ({ text: a.textContent.trim().substring(0, 100), href: a.href })),
        noTickets,
      };
    });

    const results = [];
    if (availability.foundLinks.length > 0 && !availability.noTickets) {
      for (const link of availability.foundLinks) {
        results.push({
          source: source.name,
          date: 'Multiple dates',
          status: 'TICKETS_FOUND',
          url: link.href || source.searchUrl,
          details: `Found: ${link.text}`,
        });
      }
    } else {
      console.log(`   ${availability.noTickets ? '❌ No tickets' : '⏳ No listings'}`);
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

  // Check if this is a new finding (compare with last state)
  const lastState = await getLastState();
  const lastCount = lastState?.found_count || 0;
  const isNewFinding = allResults.length > 0 && (lastCount === 0 || allResults.length > lastCount);

  // Save current state
  await saveState(allResults);

  // Send alert only for new findings
  if (allResults.length > 0 && isNewFinding) {
    const message =
      `🎫🎫🎫 TICKET ALERT! 🎫🎫🎫\n\n` +
      `<b>Stray Kids 6th Fan Meeting</b>\n` +
      `<b>"STAY in Our Little House"</b>\n\n` +
      allResults.map((r) =>
        `🔥 <b>${r.source}</b>\n   📅 ${r.date}\n   📝 ${r.details}\n   🔗 ${r.url}`
      ).join('\n\n') +
      `\n\n⚡ GO NOW! Check the links above!`;

    await sendTelegram(message);
    console.log(`\n🎫 FOUND ${allResults.length} results! Alert sent.`);
    process.exit(0);
  } else if (allResults.length > 0) {
    console.log(`\n🎫 ${allResults.length} results (already alerted)`);
  } else {
    console.log(`\n⏳ No tickets found.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
