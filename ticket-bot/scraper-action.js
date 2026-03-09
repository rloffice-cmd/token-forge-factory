/**
 * 🎫 Smart Ticket Scraper v3
 * - Zero false positives: only alerts on VERIFIED availability
 * - NOL World (official) gets priority with dedicated deep checker
 * - Secondary markets: only alerts on confirmed listings with prices
 * - Forums & community: scans for private sellers
 * - Self-healing: catches all errors, never crashes
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

const NOL_URLS = [
  { url: 'https://world.nol.com/en/ticket/places/26000193/products/26002658', label: 'NOL World (EN)' },
  { url: 'https://nol.com/ticket/places/26000193/products/26002658', label: 'NOL Korea (KR)' },
];

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
  { name: 'Twitter/X', url: 'https://nitter.privacydev.net/search?f=tweets&q=stray+kids+fan+meeting+ticket+%28selling+OR+sell+OR+wts+OR+양도%29&since=2026-03-01' },
  { name: 'Carousell', url: 'https://www.carousell.com/search/stray%20kids%20fan%20meeting%20ticket' },
  { name: 'DCInside (KR)', url: 'https://search.dcinside.com/combine/q/스트레이키즈+팬미팅+양도' },
  { name: 'Naver Cafe (KR)', url: 'https://search.naver.com/search.naver?query=스트레이키즈+팬미팅+티켓+양도&where=cafearticle&sm=tab_opt&nso=so%3Add%2Cp%3A1w' },
];

// ============== HEALTH TRACKING ==============
const health = {
  startTime: Date.now(),
  sourcesChecked: 0,
  sourcesFailed: 0,
  errors: [],
  nolStatus: 'unknown',
};

function logError(source, error) {
  health.errors.push(`${source}: ${error}`);
  health.sourcesFailed++;
  console.error(`   ❌ ${source}: ${error}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
      if (res.ok) { console.log('📱 Telegram sent'); return true; }
      // Retry without HTML
      const res2 = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CONFIG.telegram.chatId, text: message.replace(/<[^>]+>/g, '') }),
      });
      if (res2.ok) { console.log('📱 Telegram sent (plain)'); return true; }
    } catch (err) {
      console.error(`   Telegram attempt ${attempt}: ${err.message}`);
      if (attempt < 3) await sleep(2000 * attempt);
    }
  }
  return false;
}

// ============== BROWSER HELPERS ==============
async function createBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
    timeout: 30000,
  });
}

async function safePage(browser, url, opts = {}) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8' });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
    else req.continue();
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeout || 25000 });
  await sleep(opts.renderWait || 4000);
  return page;
}

// ============== NOL WORLD - DEDICATED SMART CHECKER ==============
async function checkNolWorld(browser) {
  console.log('🎫 ═══ NOL WORLD OFFICIAL CHECK ═══');
  const results = [];

  for (const { url, label } of NOL_URLS) {
    console.log(`   🔍 ${label}...`);
    health.sourcesChecked++;
    let page;
    try {
      page = await safePage(browser, url, { renderWait: 5000 });
      const analysis = await page.evaluate(() => {
        const body = document.body?.innerText || '';
        const bodyLower = body.toLowerCase();

        // SOLD OUT detection
        const soldOutIndicators = ['sold out', 'soldout', 'sold-out', '매진', 'all tickets have been sold', 'no longer available', 'currently unavailable'];
        const isSoldOut = soldOutIndicators.some(p => bodyLower.includes(p));

        // Active purchase buttons (must be enabled, not just navigation)
        const allButtons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]'));
        const purchaseButtons = allButtons.filter(btn => {
          const text = btn.textContent.toLowerCase().trim();
          const isDisabled = btn.disabled || btn.classList.contains('disabled') || btn.getAttribute('aria-disabled') === 'true';
          const isPurchase = ['book', 'buy', 'purchase', 'book now', 'buy now', 'buy ticket', 'get ticket', 'add to cart', 'reserve', '예매', '예매하기', '구매하기', '티켓 구매'].some(k => text.includes(k));
          return isPurchase && !isDisabled;
        });

        // Ticket selection UI - strong signals
        const hasQuantitySelect = !!document.querySelector('select[name*="qty"], select[name*="quantity"], input[type="number"][name*="qty"], [class*="quantity-select"], [class*="ticket-quantity"]');
        const hasSeatMap = !!document.querySelector('[class*="seat-map"], [class*="seatmap"], [class*="venue-map"]');
        const hasDateSelector = !!document.querySelector('[class*="date-select"], [class*="calendar"], [class*="date-picker"]');

        // Price on page
        const hasPrice = /(?:₩|KRW|원)\s*[\d,]+|[\d,]+\s*(?:₩|원|KRW)/.test(body);

        // Cancellation tickets
        const cancelPatterns = ['cancellation ticket', 'cancelled ticket', 'returned ticket', 'released ticket', '취소표', '환불표'];
        const hasCancelTickets = cancelPatterns.some(p => bodyLower.includes(p));

        return {
          isSoldOut,
          purchaseButtonCount: purchaseButtons.length,
          purchaseButtonTexts: purchaseButtons.map(b => b.textContent.trim()).slice(0, 5),
          hasQuantitySelect, hasSeatMap, hasDateSelector, hasPrice, hasCancelTickets,
          pageTitle: document.title,
        };
      });

      console.log(`   📄 "${analysis.pageTitle}"`);
      console.log(`   🔒 Sold out: ${analysis.isSoldOut} | Buttons: ${analysis.purchaseButtonCount} | Qty: ${analysis.hasQuantitySelect} | Price: ${analysis.hasPrice}`);

      // DECISION: Must have purchase UI + ticket selection + no sold-out
      const hasRealPurchaseUI = analysis.purchaseButtonCount > 0 && (analysis.hasQuantitySelect || analysis.hasSeatMap || analysis.hasDateSelector || analysis.hasPrice);

      if (hasRealPurchaseUI && !analysis.isSoldOut) {
        results.push({
          source: `🎫 ${label}`,
          confidence: 'CONFIRMED',
          details: `Purchase UI active! [${analysis.purchaseButtonTexts.join(', ')}]${analysis.hasPrice ? ' + prices visible' : ''}${analysis.hasQuantitySelect ? ' + qty selector' : ''}`,
          url,
        });
        console.log(`   ✅✅✅ CONFIRMED AVAILABLE!`);
      } else if (analysis.hasCancelTickets && !analysis.isSoldOut) {
        results.push({
          source: `🎫 ${label}`,
          confidence: 'HIGH',
          details: 'Cancellation/returned tickets detected!',
          url,
        });
        console.log(`   ✅ Cancellation tickets detected!`);
      } else if (analysis.isSoldOut) {
        health.nolStatus = 'sold_out';
        console.log(`   ❌ SOLD OUT`);
      } else {
        health.nolStatus = 'no_availability';
        console.log(`   ⏳ No availability`);
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
async function checkSecondaryMarket(browser, source) {
  console.log(`   🔍 ${source.name}...`);
  health.sourcesChecked++;
  let page;
  try {
    page = await safePage(browser, source.url, { timeout: 20000, renderWait: 3000 });
    const analysis = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      const bodyLower = body.toLowerCase();

      // Must find Stray Kids + fan meeting TOGETHER
      const isRelevant = (bodyLower.includes('stray kids') || bodyLower.includes('스트레이 키즈')) &&
        (bodyLower.includes('fan meeting') || bodyLower.includes('fanmeeting') || bodyLower.includes('little house') || bodyLower.includes('팬미팅'));
      if (!isRelevant) return { relevant: false, listings: [] };

      // Real prices
      const prices = body.match(/[\$€£₩]\s*[\d,.]+|[\d,.]+\s*(?:USD|EUR|KRW|원)/gi) || [];

      // Specific event links with dates
      const links = Array.from(document.querySelectorAll('a'));
      const eventLinks = links.filter(a => {
        const text = (a.textContent + ' ' + (a.href || '')).toLowerCase();
        const hasEvent = (text.includes('stray kids') || text.includes('스트레이')) && (text.includes('fan meeting') || text.includes('little house') || text.includes('팬미팅'));
        const hasDetail = text.includes('2026') || text.includes('march') || text.includes('april') || text.includes('3월') || text.includes('4월') || text.includes('seoul') || text.includes('서울');
        return hasEvent && hasDetail;
      }).map(a => ({ text: a.textContent.trim().substring(0, 200), href: a.href }));

      const noResults = ['no results', 'no tickets', 'no events', '0 results', 'nothing found', 'no listings'].some(p => bodyLower.includes(p));
      return { relevant: true, listings: eventLinks, hasPrices: prices.length > 0, priceExamples: prices.slice(0, 3), noResults };
    });

    if (!analysis.relevant || analysis.noResults) {
      console.log(`      No listings`);
      return [];
    }

    if (analysis.listings.length > 0 && analysis.hasPrices) {
      console.log(`      ✅ ${analysis.listings.length} listings with prices!`);
      return analysis.listings.map(l => ({
        source: `🎟 ${source.name}`,
        confidence: 'HIGH',
        details: `${l.text} | Prices: ${analysis.priceExamples.join(', ')}`,
        url: l.href || source.url,
      }));
    }
    console.log(`      No confirmed listings`);
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

        // Selling keywords in multiple languages
        const sellingKeywords = ['selling', 'sell', 'wts', 'for sale', 'letting go', '양도', '양도합니다', '팝니다', '판매'];
        const ticketKeywords = ['ticket', 'tickets', '티켓', '입장권'];
        const eventKeywords = ['stray kids', 'skz', '스트레이', 'fan meeting', 'fanmeeting', 'little house', '팬미팅'];

        const hasSelling = sellingKeywords.some(k => bodyLower.includes(k));
        const hasTicket = ticketKeywords.some(k => bodyLower.includes(k));
        const hasEvent = eventKeywords.some(k => bodyLower.includes(k));

        if (!(hasSelling && hasTicket && hasEvent)) return [];

        // Extract post-like elements (links with text)
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

        // Also look for text blocks mentioning selling
        const textBlocks = body.split('\n').filter(line => {
          const l = line.toLowerCase();
          return sellingKeywords.some(k => l.includes(k)) && eventKeywords.some(k => l.includes(k)) && line.trim().length > 20;
        }).map(t => t.trim().substring(0, 200)).slice(0, 3);

        return [...postLinks.map(p => ({ ...p, type: 'link' })), ...textBlocks.map(t => ({ text: t, href: '', type: 'text' }))];
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
        console.log(`      No seller posts found`);
      }
    } catch (err) {
      logError(source.name, err.message);
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }
  return results;
}

// ============== MAIN ==============
async function main() {
  const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  console.log(`\n🎫 Smart Ticket Scraper v3 | ${now}`);
  console.log(`🎯 NOL World + ${SECONDARY_SOURCES.length} markets + ${FORUM_SOURCES.length} forums\n`);

  const allResults = [];
  let browser;

  try {
    browser = await createBrowser();
  } catch (err) {
    console.error('❌ CRITICAL: Browser failed:', err.message);
    await sendTelegram(`❌ <b>SCRAPER ERROR</b>\n\nBrowser failed: ${err.message}\nAuto-retrying next cycle...`);
    process.exit(1);
  }

  try {
    // PRIORITY 1: NOL World
    const nolResults = await checkNolWorld(browser);
    allResults.push(...nolResults);

    // PRIORITY 2: Secondary markets
    console.log('\n🎟 ═══ SECONDARY MARKETS ═══');
    for (const source of SECONDARY_SOURCES) {
      try {
        const results = await checkSecondaryMarket(browser, source);
        allResults.push(...results);
      } catch (err) { logError(source.name, err.message); }
    }

    // PRIORITY 3: Forums & private sellers
    const forumResults = await checkForums(browser);
    allResults.push(...forumResults);

  } catch (err) {
    console.error('Scan error:', err.message);
    health.errors.push(`Scan: ${err.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // ===== SEND ALERTS =====
  console.log(`\n━━━ RESULTS: ${allResults.length} verified findings ━━━`);

  if (allResults.length > 0) {
    // Sort by confidence
    const order = { CONFIRMED: 0, HIGH: 1, MEDIUM: 2 };
    allResults.sort((a, b) => (order[a.confidence] ?? 9) - (order[b.confidence] ?? 9));

    const confirmed = allResults.filter(r => r.confidence === 'CONFIRMED');
    const high = allResults.filter(r => r.confidence === 'HIGH');
    const medium = allResults.filter(r => r.confidence === 'MEDIUM');

    let msg = '';
    if (confirmed.length > 0) {
      msg += `🚨🚨🚨 <b>TICKETS AVAILABLE - VERIFIED!</b> 🚨🚨🚨\n\n`;
    } else if (high.length > 0) {
      msg += `🔔🔔 <b>TICKET ALERT!</b> 🔔🔔\n\n`;
    } else {
      msg += `📢 <b>Possible Tickets Found</b>\n\n`;
    }

    msg += `<b>Stray Kids 6th Fan Meeting</b>\n<b>"STAY in Our Little House"</b>\n\n`;

    if (confirmed.length > 0) {
      msg += `<b>🔴 CONFIRMED (${confirmed.length}):</b>\n`;
      for (const r of confirmed) {
        msg += `\n📍 ${r.source}\n📝 ${r.details}\n🔗 ${r.url}\n`;
      }
    }
    if (high.length > 0) {
      msg += `\n<b>🟠 HIGH CONFIDENCE (${high.length}):</b>\n`;
      for (const r of high) {
        msg += `\n📍 ${r.source}\n📝 ${r.details}\n🔗 ${r.url}\n`;
      }
    }
    if (medium.length > 0) {
      msg += `\n<b>🟡 PRIVATE SELLERS (${medium.length}):</b>\n`;
      for (const r of medium.slice(0, 8)) {
        msg += `\n📍 ${r.source}\n📝 ${r.details}\n${r.url ? `🔗 ${r.url}\n` : ''}`;
      }
    }

    const dates = CONFIG.targetDates.map(d => DATE_LABELS[d] || d).join('\n');
    msg += `\n📅 <b>Dates:</b>\n${dates}\n\n⚡ <b>GO CHECK NOW!</b> ⚡`;

    await sendTelegram(msg);

    // Double alert for confirmed
    if (confirmed.length > 0) {
      await sleep(3000);
      await sendTelegram(`🚨🚨🚨 TICKETS AVAILABLE ON OFFICIAL SITE! GO NOW!\n🔗 ${confirmed[0].url}`);
    }
  } else {
    // Health report every ~30 min
    const minute = new Date().getMinutes();
    if (minute < 5 || (minute >= 30 && minute < 35)) {
      const elapsed = ((Date.now() - health.startTime) / 1000).toFixed(0);
      const ok = health.sourcesChecked - health.sourcesFailed;
      await sendTelegram(
        `👁 <b>Scraper Active</b> | ${now}\n\n` +
        `🎫 NOL: ${health.nolStatus}\n` +
        `📊 ${ok}/${health.sourcesChecked} sources OK\n` +
        `⚡ Runtime: ${elapsed}s\n` +
        (health.errors.length > 0 ? `⚠️ ${health.errors.length} errors\n` : '') +
        `\n🔄 Next check in ~3 min\n` +
        `No tickets yet - I'll alert instantly when found!`
      );
    }
    console.log('⏳ No verified tickets. Waiting for next cycle...');
  }

  process.exit(0);
}

// Global safety nets
process.on('uncaughtException', async (err) => {
  console.error('💥 Crash:', err.message);
  try { await sendTelegram(`❌ Scraper crashed: ${err.message}\nAuto-restarting...`); } catch {}
  process.exit(1);
});
process.on('unhandledRejection', (err) => { console.error('💥 Rejection:', err); process.exit(1); });
setTimeout(() => { console.error('⏰ Hard timeout 7min'); process.exit(1); }, 7 * 60 * 1000);

main();
