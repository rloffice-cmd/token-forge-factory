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

    // Wait for the page to load
    await page.waitForSelector('body', { timeout: 10000 });

    const pageContent = await page.content();

    // Look for ticket availability indicators
    const results = [];

    for (const targetDate of CONFIG.targetDates) {
      const dateLabel = DATE_LABELS[targetDate] || targetDate;

      // Check if there are any "book" or "buy" buttons that aren't disabled
      const availability = await page.evaluate((date) => {
        const body = document.body.innerText.toLowerCase();
        const html = document.body.innerHTML;

        // Check for sold out indicators
        const soldOutPatterns = ['sold out', 'soldout', 'sold-out', '매진', 'unavailable'];
        const isSoldOut = soldOutPatterns.some((p) => body.includes(p));

        // Check for available booking buttons
        const bookButtons = document.querySelectorAll(
          'button:not([disabled]), a[href*="book"], a[href*="ticket"], [class*="buy"], [class*="book"]'
        );
        const hasActiveButtons = Array.from(bookButtons).some((btn) => {
          const text = btn.textContent.toLowerCase();
          return (
            (text.includes('book') ||
              text.includes('buy') ||
              text.includes('ticket') ||
              text.includes('reserve') ||
              text.includes('예매')) &&
            !text.includes('sold') &&
            !text.includes('unavailable')
          );
        });

        // Look for date-specific availability
        const hasDate = body.includes(date) || html.includes(date);

        // Check for cancellation ticket indicators
        const cancelPatterns = ['cancellation', 'returned', 'released', '취소표', '환불'];
        const hasCancelTickets = cancelPatterns.some((p) => body.includes(p));

        return {
          isSoldOut,
          hasActiveButtons,
          hasDate,
          hasCancelTickets,
          bodySnippet: body.substring(0, 500),
        };
      }, targetDate);

      if (availability.hasCancelTickets || (availability.hasActiveButtons && !availability.isSoldOut)) {
        results.push({
          source: source.name,
          date: dateLabel,
          status: 'POSSIBLY_AVAILABLE',
          url: source.eventUrl,
          details: availability.hasCancelTickets ? 'Cancellation tickets detected!' : 'Active booking buttons found!',
        });
      } else {
        console.log(`   ${dateLabel}: ${availability.isSoldOut ? '❌ Sold Out' : '⏳ No availability detected'}`);
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
      const body = document.body.innerText.toLowerCase();
      const links = Array.from(document.querySelectorAll('a'));

      // Look for Stray Kids fan meeting links with pricing
      const relevantLinks = links.filter((a) => {
        const text = (a.textContent + ' ' + a.href).toLowerCase();
        return (
          (text.includes('stray kids') || text.includes('스트레이 키즈')) &&
          (text.includes('fan meeting') || text.includes('fanmeeting') || text.includes('little house'))
        );
      });

      // Check for price indicators (means tickets are available)
      const pricePatterns = ['$', '₩', '€', 'from', 'starting at', 'price'];
      const hasPricing = pricePatterns.some((p) => body.includes(p));

      // Check for "no tickets" indicators
      const noTicketPatterns = ['no tickets', 'not available', 'no events', 'no results', 'sold out'];
      const noTickets = noTicketPatterns.some((p) => body.includes(p));

      return {
        foundLinks: relevantLinks.map((a) => ({
          text: a.textContent.trim().substring(0, 100),
          href: a.href,
        })),
        hasPricing,
        noTickets,
        bodySnippet: body.substring(0, 500),
      };
    });

    if (availability.foundLinks.length > 0 && !availability.noTickets) {
      for (const link of availability.foundLinks) {
        for (const targetDate of CONFIG.targetDates) {
          const dateLabel = DATE_LABELS[targetDate] || targetDate;
          results.push({
            source: source.name,
            date: dateLabel,
            status: 'TICKETS_FOUND',
            url: link.href || source.searchUrl,
            details: `Found listing: ${link.text}`,
          });
        }
      }
    } else {
      console.log(`   ${availability.noTickets ? '❌ No tickets listed' : '⏳ No relevant listings found'}`);
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
    // Try to hit the NOL World event page API directly
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

    // Quick checks
    const soldOut = bodyLower.includes('sold out') || bodyLower.includes('매진') || bodyLower.includes('soldout');
    const hasBooking = bodyLower.includes('booking') || bodyLower.includes('예매') || bodyLower.includes('purchase');
    const hasCancellation = bodyLower.includes('cancellation') || bodyLower.includes('취소표');

    if (hasCancellation || (hasBooking && !soldOut)) {
      return [
        {
          source: 'NOL World API',
          date: 'Check manually',
          status: 'POSSIBLY_AVAILABLE',
          url: SOURCES.nolWorld.eventUrl,
          details: hasCancellation ? 'Cancellation tickets may be available!' : 'Booking may be open!',
        },
      ];
    }

    console.log(`   ${soldOut ? '❌ Still Sold Out' : '⏳ No change detected'}`);
    return [];
  } catch (err) {
    console.error(`   ❌ API check failed: ${err.message}`);
    return [];
  }
}

// ============== MAIN LOOP ==============
let checkCount = 0;
let foundTickets = false;

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

    // Check NOL World with browser
    const nolResults = await checkNolWorld(browser);
    allResults.push(...nolResults);

    // Check secondary markets
    for (const sourceKey of ['tixel', 'seatpick', 'vividseats']) {
      const results = await checkSecondaryMarket(browser, sourceKey);
      allResults.push(...results);
    }
  } catch (err) {
    console.error('Browser error:', err.message);
  } finally {
    if (browser) await browser.close();
  }

  // Process results
  if (allResults.length > 0) {
    foundTickets = true;

    const message =
      `🎫🎫🎫 TICKET ALERT! 🎫🎫🎫\n\n` +
      `<b>Stray Kids 6th Fan Meeting</b>\n` +
      `<b>"STAY in Our Little House"</b>\n\n` +
      allResults
        .map(
          (r) => `🔥 <b>${r.source}</b>\n` + `   📅 ${r.date}\n` + `   📝 ${r.details}\n` + `   🔗 ${r.url}\n`
        )
        .join('\n') +
      `\n⚡ GO NOW! Check the links above!`;

    await sendTelegramAlert(message);

    // Also play a sound alert on the system
    console.log('\n🔔🔔🔔 TICKETS FOUND! CHECK ABOVE! 🔔🔔🔔');
  } else {
    console.log(`\n⏳ No tickets found yet. Next check in ${CONFIG.checkIntervalSeconds} seconds...`);
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
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');

  // Initialize Telegram
  initTelegram();

  console.log('\nMonitoring sources:');
  Object.values(SOURCES).forEach((s) => console.log(`  📡 ${s.name}`));
  console.log(`\n⏱️  Check interval: every ${CONFIG.checkIntervalSeconds} seconds`);
  console.log('🎯 Target dates:', CONFIG.targetDates.map((d) => DATE_LABELS[d] || d).join(', '));
  console.log('\nStarting monitoring...\n');

  // Send startup notification
  await sendTelegramAlert(
    '🤖 Ticket bot started!\n\n' +
      'Monitoring for Stray Kids 6th Fan Meeting tickets\n' +
      `Dates: 28.3, 29.3, 4.4, 5.4.2026\n` +
      `Checking every ${CONFIG.checkIntervalSeconds} seconds`
  );

  // Initial check
  await runCheck();

  // Schedule recurring checks
  setInterval(async () => {
    try {
      await runCheck();
    } catch (err) {
      console.error('Check failed:', err.message);
    }
  }, CONFIG.checkIntervalSeconds * 1000);
}

main().catch(console.error);
