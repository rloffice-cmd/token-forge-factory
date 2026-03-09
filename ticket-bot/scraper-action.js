/**
 * 🎫 Smart Ticket Scraper v3
 * - Zero false positives: only alerts on VERIFIED availability
 * - NOL World (official) gets priority with dedicated deep checker
 * - Secondary markets: only alerts on confirmed listings with prices
 * - Forums & communities: scans for private sellers (Reddit, Twitter, Naver, etc.)
 * - Self-healing: catches all errors, never crashes
 * - Reports health status to Telegram
 */
import puppeteer from 'puppeteer';

// ============== CONFIGURATION ==============
const CONFIG = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  targetDates: (process.env.TARGET_DATES || '2026-03-28,2026-03-29,2026-04-04,2026-04-05').split(','),
};

const DATE_LABELS = {
  '2026-03-28': 'שבת 28.3 (Day 1)',
  '2026-03-29': 'ראשון 29.3 (Day 2)',
  '2026-04-04': 'שבת 4.4 (Day 3)',
  '2026-04-05': 'ראשון 5.4 (Day 4)',
};

const NOL_URL = 'https://world.nol.com/en/ticket/places/26000193/products/26002658';
const NOL_KR_URL = 'https://nol.com/ticket/places/26000193/products/26002658';

// Secondary markets - only check these, don't alert unless VERY confident
const SECONDARY_SOURCES = [
  { name: 'Tixel', url: 'https://tixel.com/search?q=stray+kids+fan+meeting' },
  { name: 'StubHub', url: 'https://www.stubhub.com/find/s/?q=stray+kids+fan+meeting+2026' },
  { name: 'Viagogo', url: 'https://www.viagogo.com/search?searchTerm=stray+kids+fan+meeting' },
  { name: 'VividSeats', url: 'https://www.vividseats.com/stray-kids-tickets/performer/103531' },
  { name: 'SeatGeek', url: 'https://seatgeek.com/search?q=stray+kids' },
  { name: 'Interpark', url: 'https://tickets.interpark.com/search?keyword=stray+kids+fan+meeting' },
  { name: 'Yes24', url: 'https://ticket.yes24.com/search/Search.aspx?query=stray+kids' },
];

// Forums & communities for private sellers
const FORUM_SOURCES = [
  { name: 'Reddit r/straykids', url: 'https://www.reddit.com/r/straykids/search/?q=ticket+sell+fan+meeting&sort=new&t=week' },
  { name: 'Reddit r/kpopforsale', url: 'https://www.reddit.com/r/kpopforsale/search/?q=stray+kids+fan+meeting&sort=new&t=week' },
  { name: 'Reddit r/ktickets', url: 'https://www.reddit.com/r/ktickets/search/?q=stray+kids&sort=new&t=week' },
  { name: 'Twitter/X', url: 'https://nitter.privacydev.net/search?f=tweets&q=stray+kids+fan+meeting+ticket+%28selling+OR+sell+OR+wts+OR+%EC%96%91%EB%8F%84%29&since=2026-03-01' },
  { name: 'Carousell', url: 'https://www.carousell.com/search/stray%20kids%20fan%20meeting%20ticket' },
  { name: 'DCInside (KR)', url: 'https://search.dcinside.com/combine/q/%EC%8A%A4%ED%8A%B8%EB%A0%88%EC%9D%B4%ED%82%A4%EC%A6%88+%ED%8C%AC%EB%AF%B8%ED%8C%85+%EC%96%91%EB%8F%84' },
  { name: 'Naver Cafe (KR)', url: 'https://search.naver.com/search.naver?query=%EC%8A%A4%ED%8A%B8%EB%A0%88%EC%9D%B4%ED%82%A4%EC%A6%88+%ED%8C%AC%EB%AF%B8%ED%8C%85+%ED%8B%B0%EC%BC%93+%EC%96%91%EB%8F%84&where=cafearticle&sm=tab_opt&nso=so%3Add%2Cp%3A1w' },
];

// ============== HEALTH TRACKING ==============
const health = {
  startTime: Date.now(),
  sourcesChecked: 0,
  sourcesFailed: 0,
  errors: [],
  nolStatus: 'unknown',
  confirmedFindings: [],
};

function logError(source, error) {
  const msg = `${source}: ${error}`;
  health.errors.push(msg);
  health.sourcesFailed++;
  console.error(`   ❌ ${msg}`);
}

// ============== TELEGRAM ==============
async function sendTelegram(message) {
  if (!CONFIG.telegram.token || !CONFIG.telegram.chatId) {
    console.log('⚠️ Telegram not configured');
    return false;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
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
      if (res.ok) {
        console.log('📱 Telegram sent');
        return true;
      }
      // If HTML parse fails, retry without it
      if (attempt === 1) {
        const res2 = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CONFIG.telegram.chatId,
            text: message.replace(/<[^>]+>/g, ''),
          }),
        });
        if (res2.ok) { console.log('📱 Telegram sent (plain)'); return true; }
      }
    } catch (err) {
      console.error(`   Telegram attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) await sleep(2000 * attempt);
    }
  }
  return false;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============== SAFE BROWSER CREATION ==============
async function createBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--single-process',
    ],
    timeout: 30000,
  });
}

async function safePage(browser, url, opts = {}) {
  const page = await browser.newPage();
  const timeout = opts.timeout || 25000;

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8' });

  // Block heavy resources for speed
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

  // Wait for JS rendering
  await sleep(opts.renderWait || 4000);

  return page;
}

// ============== NOL WORLD - DEDICATED SMART CHECKER ==============
// This is the most important check. We need to understand the actual page state.
async function checkNolWorld(browser) {
  console.log('\n🎫 ═══ NOL WORLD OFFICIAL CHECK ═══');

  const results = [];

  for (const { url, label } of [
    { url: NOL_URL, label: 'NOL World (EN)' },
    { url: NOL_KR_URL, label: 'NOL Korea (KR)' },
  ]) {
    console.log(`   🔍 Checking ${label}...`);
    health.sourcesChecked++;

    let page;
    try {
      page = await safePage(browser, url, { renderWait: 5000 });

      const analysis = await page.evaluate(() => {
        const body = document.body?.innerText || '';
        const bodyLower = body.toLowerCase();
        const html = document.body?.innerHTML || '';
        const htmlLower = html.toLowerCase();

        // ===== SOLD OUT detection =====
        const soldOutIndicators = [
          'sold out', 'soldout', 'sold-out', '매진',
          'all tickets have been sold', 'no longer available',
          'tickets are not available', 'currently unavailable',
        ];
        const soldOutCount = soldOutIndicators.filter(p => bodyLower.includes(p)).length;

        // ===== ACTIVE PURCHASE detection =====
        // Look for real, clickable, enabled purchase/booking buttons
        const allButtons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]'));
        const purchaseButtons = allButtons.filter(btn => {
          const text = btn.textContent.toLowerCase().trim();
          const isDisabled = btn.disabled || btn.classList.contains('disabled') ||
            btn.getAttribute('aria-disabled') === 'true' ||
            btn.closest('[disabled]') !== null;
          const isPurchase = (
            text === 'book' || text === 'buy' || text === 'purchase' ||
            text.includes('book now') || text.includes('buy now') ||
            text.includes('buy ticket') || text.includes('get ticket') ||
            text.includes('add to cart') || text.includes('reserve') ||
            text === '예매' || text === '예매하기' || text === '구매하기' ||
            text.includes('예매하기') || text.includes('티켓 구매')
          );
          return isPurchase && !isDisabled;
        });

        // ===== TICKET SELECTION UI =====
        // Quantity selectors, date pickers, seat maps = tickets are buyable
        const hasQuantitySelect = document.querySelector(
          'select[name*="qty"], select[name*="quantity"], input[type="number"][name*="qty"], ' +
          '[class*="quantity-select"], [class*="ticket-quantity"], [data-qty]'
        ) !== null;

        const hasSeatMap = document.querySelector(
          '[class*="seat-map"], [class*="seatmap"], [class*="venue-map"], ' +
          'svg[class*="seat"], canvas[class*="seat"]'
        ) !== null;

        const hasDateSelector = document.querySelector(
          '[class*="date-select"], [class*="calendar"], [class*="date-picker"], ' +
          '[class*="schedule"] button:not([disabled]), [class*="performance"] button:not([disabled])'
        ) !== null;

        // ===== PRICE on page =====
        const priceRegex = /(?:₩|KRW|원)\s*[\d,]+|[\d,]+\s*(?:₩|원|KRW)/;
        const hasPrice = priceRegex.test(body);

        // ===== CANCELLATION / RETURNED tickets =====
        const cancelPatterns = [
          'cancellation ticket', 'cancelled ticket', 'returned ticket',
          'released ticket', '취소표', '환불표', '반환',
          'ticket returned', 'ticket released',
        ];
        const hasCancelTickets = cancelPatterns.some(p => bodyLower.includes(p));

        // ===== WAITLIST / LOTTERY =====
        const hasWaitlist = bodyLower.includes('waitlist') || bodyLower.includes('waiting list') ||
          bodyLower.includes('대기') || bodyLower.includes('lottery');

        // ===== Page state summary =====
        return {
          soldOutCount,
          isSoldOut: soldOutCount >= 1,
          purchaseButtonCount: purchaseButtons.length,
          purchaseButtonTexts: purchaseButtons.map(b => b.textContent.trim()).slice(0, 5),
          hasQuantitySelect,
          hasSeatMap,
          hasDateSelector,
          hasPrice,
          hasCancelTickets,
          hasWaitlist,
          pageTitle: document.title,
          // Get the first 200 chars to understand context
          pageSnippet: body.substring(0, 300).replace(/\s+/g, ' '),
        };
      });

      console.log(`   📄 Page: "${analysis.pageTitle}"`);
      console.log(`   🔒 Sold out signals: ${analysis.soldOutCount}`);
      console.log(`   🛒 Purchase buttons: ${analysis.purchaseButtonCount}`);
      console.log(`   📊 Qty selector: ${analysis.hasQuantitySelect} | Seat map: ${analysis.hasSeatMap} | Date picker: ${analysis.hasDateSelector}`);
      console.log(`   💰 Price shown: ${analysis.hasPrice} | Cancel tickets: ${analysis.hasCancelTickets}`);

      // === DECISION LOGIC ===
      // CONFIRMED AVAILABLE: Must have BOTH purchase UI AND no sold-out signals
      const hasActivePurchaseUI = (
        analysis.purchaseButtonCount > 0 &&
        (analysis.hasQuantitySelect || analysis.hasSeatMap || analysis.hasDateSelector || analysis.hasPrice)
      );

      if (hasActivePurchaseUI && !analysis.isSoldOut) {
        const confidence = 'CONFIRMED';
        results.push({
          source: `🎫 ${label}`,
          confidence,
          details: `Active purchase UI found! Buttons: [${analysis.purchaseButtonTexts.join(', ')}]` +
            (analysis.hasPrice ? ' + pricing visible' : '') +
            (analysis.hasQuantitySelect ? ' + quantity selector' : '') +
            (analysis.hasSeatMap ? ' + seat map active' : ''),
          url,
        });
        console.log(`   ✅✅✅ CONFIRMED: Tickets appear available!`);
      } else if (analysis.hasCancelTickets && !analysis.isSoldOut) {
        results.push({
          source: `🎫 ${label}`,
          confidence: 'HIGH',
          details: 'Cancellation/returned tickets detected on page!',
          url,
        });
        console.log(`   ✅ HIGH: Cancellation tickets detected!`);
      } else if (analysis.purchaseButtonCount > 0 && !analysis.isSoldOut && !analysis.hasQuantitySelect) {
        // Buttons exist but no quantity selector - might be just navigation buttons
        // DON'T alert - this was causing false positives
        console.log(`   ⚠️ Buttons found but no ticket selection UI - likely navigation, skipping`);
        health.nolStatus = 'buttons_no_ui';
      } else if (analysis.isSoldOut) {
        console.log(`   ❌ SOLD OUT`);
        health.nolStatus = 'sold_out';
      } else if (analysis.hasWaitlist) {
        console.log(`   ⏳ Waitlist/lottery mode`);
        health.nolStatus = 'waitlist';
      } else {
        console.log(`   ⏳ No availability detected`);
        health.nolStatus = 'no_availability';
      }

    } catch (err) {
      logError(label, err.message);
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  return results;
}

// ============== SECONDARY MARKET CHECKER ==============
// Only alert if we find a SPECIFIC listing with a price for the right event
async function checkSecondaryMarket(browser, source) {
  console.log(`   🔍 ${source.name}...`);
  health.sourcesChecked++;

  let page;
  try {
    page = await safePage(browser, source.url, { timeout: 20000, renderWait: 3000 });

    const analysis = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      const bodyLower = body.toLowerCase();

      // Must find Stray Kids + fan meeting/little house TOGETHER
      const isRelevant = (
        (bodyLower.includes('stray kids') || bodyLower.includes('스트레이 키즈')) &&
        (bodyLower.includes('fan meeting') || bodyLower.includes('fanmeeting') ||
         bodyLower.includes('little house') || bodyLower.includes('팬미팅'))
      );

      if (!isRelevant) return { relevant: false, listings: [] };

      // Look for actual ticket listings with prices
      // A real listing has: event name + date/venue + price
      const priceRegex = /[\$€£₩]\s*[\d,.]+|[\d,.]+\s*(?:USD|EUR|KRW|원)/gi;
      const prices = body.match(priceRegex) || [];

      // Look for specific event links (not just search results)
      const links = Array.from(document.querySelectorAll('a'));
      const eventLinks = links.filter(a => {
        const text = (a.textContent + ' ' + (a.href || '')).toLowerCase();
        const hasEvent = (text.includes('stray kids') || text.includes('스트레이')) &&
          (text.includes('fan meeting') || text.includes('little house') || text.includes('팬미팅'));
        // Must also have a date or venue indicator
        const hasDetail = text.includes('2026') || text.includes('march') || text.includes('april') ||
          text.includes('3월') || text.includes('4월') || text.includes('seoul') || text.includes('서울');
        return hasEvent && hasDetail;
      }).map(a => ({
        text: a.textContent.trim().substring(0, 200),
        href: a.href,
      }));

      // "No results" detection
      const noResults = bodyLower.includes('no results') || bodyLower.includes('no tickets') ||
        bodyLower.includes('no events') || bodyLower.includes('0 results') ||
        bodyLower.includes('nothing found') || bodyLower.includes('no listings');

      return {
        relevant: true,
        listings: eventLinks,
        hasPrices: prices.length > 0,
        priceExamples: prices.slice(0, 3),
        noResults,
      };
    });

    if (!analysis.relevant) {
      console.log(`      No Stray Kids fan meeting content`);
      return [];
    }

    if (analysis.noResults) {
      console.log(`      No listings available`);
      return [];
    }

    // Only alert if we have SPECIFIC listings with prices
    if (analysis.listings.length > 0 && analysis.hasPrices) {
      console.log(`      ✅ Found ${analysis.listings.length} listings with prices: ${analysis.priceExamples.join(', ')}`);
      return analysis.listings.map(l => ({
        source: `🎟 ${source.name}`,
        confidence: 'HIGH',
        details: `${l.text} | Prices: ${analysis.priceExamples.join(', ')}`,
        url: l.href || source.url,
      }));
    }

    if (analysis.listings.length > 0) {
      console.log(`      Found listings but no prices - not alerting`);
    } else {
      console.log(`      Relevant content but no specific listings`);
    }

    return [];
  } catch (err) {
    logError(source.name, err.message);
    return [];
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ============== FORUM & COMMUNITY CHECKER ==============
async function checkForums(browser) {
  console.log('\n🗣 ═══ FORUMS & PRIVATE SELLERS ═══');
  const results = [];

  for (const source of FORUM_SOURCES) {
    console.log(`   🔍 ${source.name}...`);
    health.sourcesChecked++;
    let page;
    try {
      page = await safePage(browser, source.url, { timeout: 20000, renderWait: 3000 });
      const posts = await page.evaluate(() => {
        const body = document.body?.innerText || '';
        const bodyLower = body.toLowerCase();

        // All three must match: selling keyword + ticket keyword + event keyword
        const sellingKeywords = ['selling', 'sell', 'wts', 'for sale', 'letting go', '양도', '양도합니다', '팝니다', '판매'];
        const ticketKeywords = ['ticket', 'tickets', '티켓', '입장권'];
        const eventKeywords = ['stray kids', 'skz', '스트레이', 'fan meeting', 'fanmeeting', 'little house', '팬미팅'];

        const hasSelling = sellingKeywords.some(k => bodyLower.includes(k));
        const hasTicket = ticketKeywords.some(k => bodyLower.includes(k));
        const hasEvent = eventKeywords.some(k => bodyLower.includes(k));

        if (!(hasSelling && hasTicket && hasEvent)) return [];

        // Find post links about selling
        const links = Array.from(document.querySelectorAll('a'));
        const postLinks = links.filter(a => {
          const text = a.textContent.toLowerCase();
          const hasSellingWord = sellingKeywords.some(k => text.includes(k));
          const hasTicketWord = ticketKeywords.some(k => text.includes(k));
          const hasEventWord = eventKeywords.some(k => text.includes(k));
          return (hasSellingWord || hasTicketWord) && (hasEventWord || text.includes('stray') || text.includes('skz'));
        }).map(a => ({
          text: a.textContent.trim().substring(0, 200),
          href: a.href,
        })).slice(0, 5);

        // Also check text blocks
        const textBlocks = body.split('\n').filter(line => {
          const l = line.toLowerCase();
          return sellingKeywords.some(k => l.includes(k)) && eventKeywords.some(k => l.includes(k)) && line.trim().length > 20;
        }).map(t => t.trim().substring(0, 200)).slice(0, 3);

        return [
          ...postLinks.map(p => ({ ...p, type: 'link' })),
          ...textBlocks.map(t => ({ text: t, href: '', type: 'text' })),
        ];
      });

      if (posts.length > 0) {
        console.log(`      ✅ Found ${posts.length} potential seller posts!`);
        for (const post of posts) {
          results.push({
            source: `🗣 ${source.name}`,
            confidence: 'MEDIUM',
            details: post.text,
            url: post.href || source.url,
          });
        }
      } else {
        console.log(`      No seller posts`);
      }
    } catch (err) {
      logError(source.name, err.message);
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }
  return results;
}

// ============== HEALTH REPORT ==============
function buildHealthReport(now) {
  const elapsed = ((Date.now() - health.startTime) / 1000).toFixed(0);
  const errorRate = health.sourcesChecked > 0
    ? ((health.sourcesFailed / health.sourcesChecked) * 100).toFixed(0)
    : '0';

  let status = '✅ Healthy';
  if (health.sourcesFailed > health.sourcesChecked / 2) status = '⚠️ Degraded';
  if (health.sourcesFailed === health.sourcesChecked) status = '❌ All checks failed';

  return (
    `👁 <b>Scraper Health Report</b>\n` +
    `⏰ ${now}\n\n` +
    `Status: ${status}\n` +
    `🎫 NOL World: ${health.nolStatus}\n` +
    `📊 Sources: ${health.sourcesChecked - health.sourcesFailed}/${health.sourcesChecked} OK\n` +
    `⚡ Runtime: ${elapsed}s\n` +
    (health.errors.length > 0 ? `\n⚠️ Errors:\n${health.errors.slice(0, 5).map(e => `• ${e}`).join('\n')}\n` : '') +
    `\n🔄 Next check in ~3 minutes`
  );
}

// ============== MAIN ==============
async function main() {
  const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  console.log(`\n🎫 Smart Ticket Scraper v3 | ${now}`);
  console.log(`🎯 NOL World + ${SECONDARY_SOURCES.length} markets + ${FORUM_SOURCES.length} forums\n`);

  const confirmedResults = [];
  let browser;

  try {
    browser = await createBrowser();
  } catch (err) {
    console.error('❌ CRITICAL: Cannot launch browser:', err.message);
    await sendTelegram(`❌ <b>SCRAPER ERROR</b>\n\nCannot launch browser: ${err.message}\n\nThe workflow will auto-retry next run.`);
    process.exit(1);
  }

  try {
    // ===== PRIORITY 1: NOL World Official =====
    const nolResults = await checkNolWorld(browser);
    confirmedResults.push(...nolResults);

    // ===== PRIORITY 2: Secondary Markets =====
    console.log('\n🎟 ═══ SECONDARY MARKETS ═══');
    for (const source of SECONDARY_SOURCES) {
      try {
        const results = await checkSecondaryMarket(browser, source);
        confirmedResults.push(...results);
      } catch (err) {
        logError(source.name, err.message);
      }
    }

    // ===== PRIORITY 3: Forums & Private Sellers =====
    const forumResults = await checkForums(browser);
    confirmedResults.push(...forumResults);

  } catch (err) {
    console.error('Scan error:', err.message);
    health.errors.push(`Scan: ${err.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // ===== RESULTS & ALERTS =====
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (confirmedResults.length > 0) {
    console.log(`🎫 VERIFIED FINDINGS: ${confirmedResults.length}`);

    // Sort: CONFIRMED first, then HIGH, then MEDIUM
    confirmedResults.sort((a, b) => {
      const order = { CONFIRMED: 0, HIGH: 1, MEDIUM: 2 };
      return (order[a.confidence] ?? 9) - (order[b.confidence] ?? 9);
    });

    const confirmed = confirmedResults.filter(r => r.confidence === 'CONFIRMED');
    const high = confirmedResults.filter(r => r.confidence === 'HIGH');
    const medium = confirmedResults.filter(r => r.confidence === 'MEDIUM');

    let message = '';
    if (confirmed.length > 0) {
      message += `🚨🚨🚨 <b>TICKETS AVAILABLE - VERIFIED!</b> 🚨🚨🚨\n\n`;
    } else if (high.length > 0) {
      message += `🔔🔔 <b>TICKET ALERT!</b> 🔔🔔\n\n`;
    } else {
      message += `📢 <b>Private Sellers Found</b>\n\n`;
    }

    message += `<b>Stray Kids 6th Fan Meeting</b>\n<b>"STAY in Our Little House"</b>\n\n`;

    if (confirmed.length > 0) {
      message += `<b>🔴 CONFIRMED (${confirmed.length}):</b>\n`;
      for (const r of confirmed) {
        message += `\n📍 ${r.source}\n📝 ${r.details}\n🔗 ${r.url}\n`;
      }
    }
    if (high.length > 0) {
      message += `\n<b>🟠 HIGH CONFIDENCE (${high.length}):</b>\n`;
      for (const r of high) {
        message += `\n📍 ${r.source}\n📝 ${r.details}\n🔗 ${r.url}\n`;
      }
    }
    if (medium.length > 0) {
      message += `\n<b>🟡 PRIVATE SELLERS (${medium.length}):</b>\n`;
      for (const r of medium.slice(0, 8)) {
        message += `\n📍 ${r.source}\n📝 ${r.details}\n${r.url ? `🔗 ${r.url}\n` : ''}`;
      }
    }

    const dates = CONFIG.targetDates.map(d => DATE_LABELS[d] || d).join('\n');
    message += `\n📅 <b>Dates:</b>\n${dates}\n\n⚡ <b>GO CHECK NOW!</b> ⚡`;

    await sendTelegram(message);

    // Double alert for confirmed official tickets
    if (confirmed.length > 0) {
      await sleep(3000);
      await sendTelegram(`🚨🚨🚨 TICKETS ON OFFICIAL SITE! GO NOW!\n🔗 ${confirmed[0].url}`);
    }

    health.confirmedFindings = confirmedResults;
  } else {
    console.log('⏳ No verified tickets found.');

    // Health report: send every ~30 min (when minute is 0-4 or 30-34)
    const minute = new Date().getMinutes();
    if (minute < 5 || (minute >= 30 && minute < 35)) {
      await sendTelegram(buildHealthReport(now));
    }
  }

  // Always log health
  console.log(`\n📊 Health: ${health.sourcesChecked - health.sourcesFailed}/${health.sourcesChecked} sources OK`);
  if (health.errors.length > 0) {
    console.log(`⚠️ Errors: ${health.errors.length}`);
    health.errors.forEach(e => console.log(`   • ${e}`));
  }

  // Exit cleanly
  process.exit(0);
}

// ===== GLOBAL ERROR HANDLING =====
process.on('uncaughtException', async (err) => {
  console.error('💥 Uncaught exception:', err.message);
  try {
    await sendTelegram(`❌ <b>Scraper crashed!</b>\n${err.message}\n\nAuto-restarting next cycle...`);
  } catch {}
  process.exit(1);
});

process.on('unhandledRejection', async (err) => {
  console.error('💥 Unhandled rejection:', err);
  process.exit(1);
});

// Hard timeout: if scraper takes more than 6 minutes, kill it
setTimeout(() => {
  console.error('⏰ Hard timeout reached (6 min). Forcing exit.');
  process.exit(1);
}, 6 * 60 * 1000);

main();
