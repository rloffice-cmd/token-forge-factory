import 'dotenv/config';
import puppeteer from 'puppeteer';
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';

// ============== CONFIGURATION ==============
const CONFIG = {
  nol: {
    email: process.env.NOL_EMAIL,
    password: process.env.NOL_PASSWORD,
  },
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  checkIntervalSeconds: parseInt(process.env.CHECK_INTERVAL_SECONDS || '30'),
  targetDates: (process.env.TARGET_DATES || '2026-03-29,2026-04-05').split(','),
  ticketsNeeded: parseInt(process.env.TICKETS_NEEDED || '1'),
};

// Target event URLs
const SOURCES = {
  nolWorld: {
    name: 'NOL World (Official)',
    eventUrl: 'https://world.nol.com/en/ticket/places/26000193/products/26002658',
    apiUrl: 'https://world.nol.com/api/v1/ticket/places/26000193/products/26002658',
  },
  tixel: {
    name: 'Tixel (Resale)',
    searchUrl: 'https://tixel.com/us/music-tickets/stray-kids',
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

// Date labels for display
const DATE_LABELS = {
  '2026-03-28': 'שבת 28.3 (Day 1)',
  '2026-03-29': 'ראשון 29.3 (Day 2)',
  '2026-04-04': 'שבת 4.4 (Day 3)',
  '2026-04-05': 'ראשון 5.4 (Day 4)',
};

// ============== TELEGRAM ==============
let telegramBot = null;

function initTelegram() {
  if (CONFIG.telegram.token && CONFIG.telegram.token !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    telegramBot = new TelegramBot(CONFIG.telegram.token, { polling: false });
    console.log('✅ Telegram bot connected');
    return true;
  }
  console.log('⚠️  Telegram not configured - notifications will be console-only');
  console.log('   Run: node setup-telegram.js to configure Telegram');
  return false;
}

async function sendTelegramAlert(message) {
  // Always log to console
  console.log('\n🎫 ' + message);

  if (telegramBot && CONFIG.telegram.chatId && CONFIG.telegram.chatId !== 'YOUR_CHAT_ID_HERE') {
    try {
      await telegramBot.sendMessage(CONFIG.telegram.chatId, message, { parse_mode: 'HTML' });
      console.log('📱 Telegram notification sent!');
    } catch (err) {
      console.error('❌ Telegram send failed:', err.message);
    }
  }
}

// ============== STATE TRACKING (prevent duplicate alerts) ==============
let lastAlertSignature = '';

// ============== NOL WORLD SCRAPER ==============
async function checkNolWorld(browser) {
  const source = SOURCES.nolWorld;
  console.log(`\n🔍 Checking ${source.name}...`);

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    await page.goto(source.eventUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('body', { timeout: 10000 });

    const results = [];

    for (const targetDate of CONFIG.targetDates) {
      const dateLabel = DATE_LABELS[targetDate] || targetDate;

      // === STRICT availability detection ===
      const availability = await page.evaluate(() => {
        const body = document.body.innerText.toLowerCase();

        // 1. Sold out confirmation
        const soldOutPatterns = ['sold out', 'soldout', 'sold-out', '매진', 'tickets unavailable'];
        const isSoldOut = soldOutPatterns.some((p) => body.includes(p));

        // 2. Cancellation tickets (very specific phrases only)
        const cancelPatterns = ['cancellation ticket', '취소표 예매', 'returned ticket', 'released ticket'];
        const hasCancelTickets = cancelPatterns.some((p) => body.includes(p));

        // 3. Active purchase flow elements (NOT generic nav buttons)
        const hasQuantitySelector = !!document.querySelector(
          'select[name*="quantity"], select[name*="qty"], input[name*="quantity"], [class*="quantity-select"], [class*="qty"]'
        );
        const hasAddToCart = !!document.querySelector(
          'button[class*="cart"], button[class*="purchase"], [class*="add-to-cart"], [data-action*="cart"]'
        );
        const hasSeatSelection = !!document.querySelector(
          '[class*="seat-map"], [class*="seatmap"], [class*="seat-select"], [class*="zone-select"]'
        );

        // 4. Check for actual price amounts
        const priceRegex = /[₩$€]\s*[\d,]{3,}/;
        const hasPriceOnPage = priceRegex.test(document.body.innerText);

        // A real purchase flow needs MULTIPLE signals together
        const hasRealPurchaseFlow = hasPriceOnPage && (hasQuantitySelector || hasAddToCart || hasSeatSelection);

        return { isSoldOut, hasCancelTickets, hasRealPurchaseFlow };
      });

      if (availability.hasCancelTickets) {
        results.push({
          source: source.name,
          date: dateLabel,
          status: 'CANCELLATION_DETECTED',
          url: source.eventUrl,
          details: 'Cancellation tickets detected!',
        });
      } else if (availability.hasRealPurchaseFlow && !availability.isSoldOut) {
        results.push({
          source: source.name,
          date: dateLabel,
          status: 'POSSIBLY_AVAILABLE',
          url: source.eventUrl,
          details: 'Active purchase flow detected (price + cart/quantity)!',
        });
      } else {
        console.log(`   ${dateLabel}: ${availability.isSoldOut ? '❌ Sold Out' : '⏳ No real availability signals'}`);
      }
    }

    await page.close();
    return results;
  } catch (err) {
    console.error(`   ❌ Error checking ${source.name}: ${err.message}`);
    return [];
  }
}

// ============== SECONDARY MARKET SCRAPERS ==============
async function checkSecondaryMarket(browser, sourceKey) {
  const source = SOURCES[sourceKey];
  if (!source || !source.searchUrl) return [];

  console.log(`🔍 Checking ${source.name}...`);

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    await page.goto(source.searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('body', { timeout: 10000 });

    const results = [];

    const availability = await page.evaluate(() => {
      const body = document.body.innerText;
      const bodyLower = body.toLowerCase();
      const links = Array.from(document.querySelectorAll('a'));

      // Look for Stray Kids fan meeting links
      const relevantLinks = links.filter((a) => {
        const text = (a.textContent + ' ' + a.href).toLowerCase();
        return (
          (text.includes('stray kids') || text.includes('스트레이 키즈')) &&
          (text.includes('fan meeting') || text.includes('fanmeeting') || text.includes('little house'))
        );
      });

      // === STRICT: Check for actual ticket pricing ===
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
        foundLinks: relevantLinks.map((a) => ({
          text: a.textContent.trim().substring(0, 100),
          href: a.href,
        })),
        priceCount: priceMatches.length,
        firstPrices: priceMatches.slice(0, 3),
        noTickets,
        hasActualBuyButtons,
      };
    });

    // STRICT: Only report if relevant links AND (real prices OR buy buttons) AND no "no tickets"
    if (
      availability.foundLinks.length > 0 &&
      !availability.noTickets &&
      (availability.priceCount > 0 || availability.hasActualBuyButtons)
    ) {
      for (const link of availability.foundLinks.slice(0, 2)) {
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
    console.error(`   ❌ Error checking ${source.name}: ${err.message}`);
    return [];
  }
}

// ============== NOL WORLD API CHECK (faster, no browser needed) ==============
async function checkNolWorldAPI() {
  console.log(`🔍 Quick API check on NOL World...`);

  try {
    const response = await fetch(SOURCES.nolWorld.eventUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
      },
    });

    const html = await response.text();
    const bodyLower = html.toLowerCase();

    // === STRICT checks ===
    const soldOut = bodyLower.includes('sold out') || bodyLower.includes('매진') || bodyLower.includes('soldout');

    // Only very specific cancellation phrases
    const cancelPatterns = ['cancellation ticket', '취소표 예매', 'returned ticket', 'released ticket'];
    const hasCancellation = cancelPatterns.some((p) => bodyLower.includes(p));

    // Look for actual price + quantity indicators
    const priceRegex = /[₩$€]\s*[\d,]{3,}/;
    const hasPrice = priceRegex.test(html);
    const hasQuantitySelect = bodyLower.includes('select quantity') || bodyLower.includes('수량 선택') ||
      bodyLower.includes('add to cart') || bodyLower.includes('장바구니');

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
        details: 'Price and quantity selector found!',
      }];
    }

    console.log(`   ${soldOut ? '❌ Still Sold Out' : '⏳ No availability signals'}`);
    return [];
  } catch (err) {
    console.error(`   ❌ API check failed: ${err.message}`);
    return [];
  }
}

// ============== MAIN LOOP ==============
let checkCount = 0;

async function runCheck() {
  checkCount++;
  const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Check #${checkCount} | ${now} (Israel Time)`);
  console.log(`${'='.repeat(60)}`);

  const allResults = [];

  // Quick API check (doesn't need browser)
  const apiResults = await checkNolWorldAPI();
  allResults.push(...apiResults);

  // Browser-based checks
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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

  // Check for genuinely new findings (signature-based dedup)
  const currentSignature = allResults.map(r => `${r.source}:${r.status}`).sort().join('|');
  const isNewFinding = allResults.length > 0 && currentSignature !== lastAlertSignature;

  if (allResults.length > 0 && isNewFinding) {
    lastAlertSignature = currentSignature;

    const message =
      `🎫🎫🎫 TICKET ALERT! 🎫🎫🎫\n\n` +
      `<b>Stray Kids 6th Fan Meeting</b>\n` +
      `<b>"STAY in Our Little House"</b>\n\n` +
      allResults
        .map(
          (r) => `🔥 <b>${r.source}</b>\n` + `   📅 ${r.date}\n` + `   📝 ${r.details}\n` + `   🔗 ${r.url}\n`
        )
        .join('\n') +
      `\n⚡ Check the links above!`;

    await sendTelegramAlert(message);
    console.log('\n🔔🔔🔔 TICKETS FOUND! CHECK ABOVE! 🔔🔔🔔');
  } else if (allResults.length > 0) {
    console.log(`\n🎫 ${allResults.length} results (already alerted, same finding)`);
  } else {
    console.log(`\n⏳ No tickets found. Next check in ${CONFIG.checkIntervalSeconds} seconds...`);
  }

  return allResults;
}

// ============== STARTUP ==============
async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  🎵 Stray Kids Ticket Scraper Bot             ║');
  console.log('║  🏠 STAY in Our Little House - Fan Meeting     ║');
  console.log('║  📅 Target: 28-29.3 / 4-5.4.2026              ║');
  console.log('║  🎫 Tickets needed: 1                         ║');
  console.log('║  🔒 STRICT mode: only real availability alerts ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');

  initTelegram();

  console.log('\nMonitoring sources:');
  Object.values(SOURCES).forEach((s) => console.log(`  📡 ${s.name}`));
  console.log(`\n⏱️  Check interval: every ${CONFIG.checkIntervalSeconds} seconds`);
  console.log('🎯 Target dates:', CONFIG.targetDates.map((d) => DATE_LABELS[d] || d).join(', '));
  console.log('🔒 Strict mode: only alerting on confirmed availability signals');
  console.log('\nStarting monitoring...\n');

  await sendTelegramAlert(
    '🤖 Ticket bot started! (STRICT mode)\n\n' +
      'Monitoring for Stray Kids 6th Fan Meeting tickets\n' +
      `Dates: 28.3, 29.3, 4.4, 5.4.2026\n` +
      `Checking every ${CONFIG.checkIntervalSeconds} seconds\n` +
      '🔒 Only real availability alerts (no false positives)'
  );

  await runCheck();

  setInterval(async () => {
    try {
      await runCheck();
    } catch (err) {
      console.error('Check failed:', err.message);
    }
  }, CONFIG.checkIntervalSeconds * 1000);
}

main().catch(console.error);
