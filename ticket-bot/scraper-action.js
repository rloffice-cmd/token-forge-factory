/**
 * 🔥🔥🔥 MONSTER TICKET SCRAPER 🔥🔥🔥
 * Aggressive multi-source parallel scanner
 * Checks EVERYTHING - official + resale + Korean platforms + Google
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

const DATE_LABELS = {
  '2026-03-28': '🗓 שבת 28.3 (Day 1)',
  '2026-03-29': '🗓 ראשון 29.3 (Day 2)',
  '2026-04-04': '🗓 שבת 4.4 (Day 3)',
  '2026-04-05': '🗓 ראשון 5.4 (Day 4)',
};

// ============== ALL SOURCES ==============
const SOURCES = [
  // === OFFICIAL ===
  {
    name: '🎫 NOL World (Official)',
    url: 'https://world.nol.com/en/ticket/places/26000193/products/26002658',
    type: 'official',
    priority: 1,
  },
  {
    name: '🎫 NOL Korea',
    url: 'https://nol.com/ticket/places/26000193/products/26002658',
    type: 'official',
    priority: 1,
  },
  // === KOREAN PLATFORMS ===
  {
    name: '🇰🇷 Interpark Ticket',
    url: 'https://tickets.interpark.com/search?keyword=stray+kids+fan+meeting',
    type: 'search',
    priority: 2,
  },
  {
    name: '🇰🇷 Yes24 Ticket',
    url: 'https://ticket.yes24.com/search/Search.aspx?query=stray+kids',
    type: 'search',
    priority: 2,
  },
  {
    name: '🇰🇷 Melon Ticket',
    url: 'https://ticket.melon.com/search/index.htm?q=stray+kids',
    type: 'search',
    priority: 2,
  },
  // === GLOBAL RESALE ===
  {
    name: '🌍 Tixel',
    url: 'https://tixel.com/search?q=stray+kids+fan+meeting',
    type: 'search',
    priority: 2,
  },
  {
    name: '🌍 StubHub',
    url: 'https://www.stubhub.com/find/s/?q=stray+kids+fan+meeting+2026',
    type: 'search',
    priority: 2,
  },
  {
    name: '🌍 Viagogo',
    url: 'https://www.viagogo.com/search?searchTerm=stray+kids+fan+meeting',
    type: 'search',
    priority: 2,
  },
  {
    name: '🌍 SeatPick',
    url: 'https://seatpick.com/stray-kids-tickets',
    type: 'search',
    priority: 3,
  },
  {
    name: '🌍 VividSeats',
    url: 'https://www.vividseats.com/stray-kids-tickets/performer/103531',
    type: 'search',
    priority: 3,
  },
  {
    name: '🌍 SeatGeek',
    url: 'https://seatgeek.com/search?q=stray+kids',
    type: 'search',
    priority: 3,
  },
  {
    name: '🌍 Ticketmaster',
    url: 'https://www.ticketmaster.com/search?q=stray+kids+fan+meeting',
    type: 'search',
    priority: 3,
  },
  // === SOCIAL / COMMUNITY ===
  {
    name: '🐦 Twitter Search',
    url: 'https://nitter.net/search?f=tweets&q=stray+kids+fan+meeting+ticket+selling&since=2026-03-01',
    type: 'social',
    priority: 2,
  },
  {
    name: '📱 Reddit',
    url: 'https://www.reddit.com/r/straykids/search/?q=fan+meeting+ticket&sort=new&t=week',
    type: 'social',
    priority: 3,
  },
];

// Google search queries - cast a wide net
const GOOGLE_QUERIES = [
  'stray kids 6th fan meeting ticket 2026',
  'stray kids "little house" ticket buy',
  'stray kids fan meeting ticket resale 2026',
  '스트레이키즈 팬미팅 티켓 양도',
  'stray kids fan meeting march april 2026 ticket',
  'stray kids NOL ticket available',
  'stray kids fan meeting cancellation ticket',
];

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

// ============== FAST HTTP CHECKS (no browser) ==============
async function httpCheck(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8,he;q=0.7',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const html = await res.text();
    return { source, html, ok: true };
  } catch (err) {
    clearTimeout(timeout);
    return { source, html: '', ok: false, error: err.message };
  }
}

function analyzeHtml(html, sourceName) {
  const lower = html.toLowerCase();
  const results = [];

  // Positive signals - tickets might be available
  const positivePatterns = [
    { pattern: 'add to cart', weight: 10, detail: 'Add to cart button found!' },
    { pattern: 'buy now', weight: 10, detail: 'Buy now button found!' },
    { pattern: 'book now', weight: 9, detail: 'Booking available!' },
    { pattern: 'purchase', weight: 5, detail: 'Purchase option detected' },
    { pattern: 'cancellation ticket', weight: 10, detail: 'Cancellation tickets!' },
    { pattern: '취소표', weight: 10, detail: 'Cancellation tickets (KR)!' },
    { pattern: '예매하기', weight: 9, detail: 'Book now button (KR)!' },
    { pattern: '구매하기', weight: 9, detail: 'Purchase button (KR)!' },
    { pattern: '양도', weight: 8, detail: 'Ticket transfer listing (KR)!' },
    { pattern: '티켓 판매', weight: 8, detail: 'Tickets for sale (KR)!' },
    { pattern: 'selling', weight: 4, detail: 'Selling mentioned' },
    { pattern: 'available', weight: 3, detail: 'Availability mentioned' },
    { pattern: 'in stock', weight: 8, detail: 'In stock!' },
    { pattern: 'released', weight: 6, detail: 'Released tickets!' },
    { pattern: 'returned', weight: 6, detail: 'Returned tickets!' },
    { pattern: 'from $', weight: 5, detail: 'Pricing found ($)' },
    { pattern: 'from ₩', weight: 5, detail: 'Pricing found (₩)' },
    { pattern: 'from €', weight: 5, detail: 'Pricing found (€)' },
  ];

  // Negative signals
  const negativePatterns = ['sold out', '매진', 'no tickets', 'not available', 'no results', 'no events found', 'unavailable'];
  const isSoldOut = negativePatterns.some(p => lower.includes(p));

  // Check for stray kids relevance
  const isRelevant = lower.includes('stray kids') || lower.includes('스트레이') || lower.includes('fan meeting') || lower.includes('little house') || lower.includes('팬미팅');

  let bestMatch = null;
  let bestWeight = 0;

  for (const p of positivePatterns) {
    if (lower.includes(p.pattern) && p.weight > bestWeight) {
      bestWeight = p.weight;
      bestMatch = p;
    }
  }

  if (bestMatch && bestWeight >= 4 && !isSoldOut) {
    results.push({
      source: sourceName,
      status: bestWeight >= 8 ? '🔴 HIGH PRIORITY' : '🟡 CHECK THIS',
      details: bestMatch.detail,
      weight: bestWeight,
      relevant: isRelevant,
    });
  }

  if (isSoldOut) {
    console.log(`   ${sourceName}: ❌ Sold out`);
  } else if (results.length === 0) {
    console.log(`   ${sourceName}: ⏳ Nothing found`);
  }

  return results;
}

// ============== BROWSER DEEP SCAN ==============
async function browserDeepScan(browser, source) {
  console.log(`   🔬 Deep scanning ${source.name}...`);
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8' });

    // Intercept and block images/css for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Wait a bit for JS rendering
    await new Promise(r => setTimeout(r, 3000));

    const results = await page.evaluate(() => {
      const body = document.body?.innerText?.toLowerCase() || '';
      const html = document.body?.innerHTML?.toLowerCase() || '';
      const links = Array.from(document.querySelectorAll('a'));

      // Find all relevant links
      const relevantLinks = links.filter(a => {
        const text = (a.textContent + ' ' + (a.href || '')).toLowerCase();
        return (text.includes('stray kids') || text.includes('스트레이') || text.includes('skz')) &&
          (text.includes('fan meeting') || text.includes('fanmeeting') || text.includes('little house') || text.includes('팬미팅') || text.includes('ticket') || text.includes('티켓'));
      }).map(a => ({ text: a.textContent.trim().substring(0, 150), href: a.href }));

      // Find price elements
      const priceElements = Array.from(document.querySelectorAll('[class*="price"], [data-price], [class*="cost"], [class*="amount"]'));
      const prices = priceElements.map(el => el.textContent.trim()).filter(t => t.match(/[\$₩€£]\s*\d/));

      // Find active buy/book buttons
      const buttons = Array.from(document.querySelectorAll('button:not([disabled]), [role="button"]:not([disabled]), a[class*="buy"], a[class*="book"], a[class*="ticket"]'));
      const activeButtons = buttons.filter(btn => {
        const text = btn.textContent.toLowerCase();
        return (text.includes('buy') || text.includes('book') || text.includes('cart') || text.includes('예매') || text.includes('구매')) &&
          !text.includes('sold') && !text.includes('unavailable');
      }).map(btn => btn.textContent.trim().substring(0, 80));

      // Check for quantity selectors (strong signal)
      const quantitySelectors = document.querySelectorAll('select[name*="qty"], select[name*="quantity"], input[name*="qty"], [class*="quantity"]');

      return {
        relevantLinks,
        prices,
        activeButtons,
        hasQuantitySelector: quantitySelectors.length > 0,
        bodySnippet: body.substring(0, 1000),
      };
    });

    await page.close();
    return results;
  } catch (err) {
    console.log(`   ⚠️ Deep scan failed for ${source.name}: ${err.message}`);
    return null;
  }
}

// ============== GOOGLE SEARCH CHECK ==============
async function googleSearchCheck(browser) {
  console.log('\n🔎 Running Google searches...');
  const results = [];

  for (const query of GOOGLE_QUERIES) {
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbs=qdr:d`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 2000));

      const searchResults = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links
          .filter(a => {
            const href = (a.href || '').toLowerCase();
            const text = (a.textContent || '').toLowerCase();
            const isTicketSite = href.includes('ticket') || href.includes('tixel') || href.includes('stubhub') ||
              href.includes('viagogo') || href.includes('seatgeek') || href.includes('nol.com') ||
              href.includes('interpark') || href.includes('yes24') || href.includes('melon') ||
              text.includes('ticket') || text.includes('buy') || text.includes('sell');
            const isRelevant = text.includes('stray') || text.includes('fan meeting') || text.includes('little house');
            return isTicketSite && isRelevant && !href.includes('google.com');
          })
          .map(a => ({
            text: a.textContent.trim().substring(0, 150),
            href: a.href,
          }))
          .slice(0, 5);
      });

      if (searchResults.length > 0) {
        for (const sr of searchResults) {
          results.push({
            source: `🔎 Google: "${query.substring(0, 30)}..."`,
            status: '🟡 CHECK THIS',
            details: sr.text,
            url: sr.href,
            weight: 5,
          });
        }
      }

      await page.close();

      // Small delay between searches to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.log(`   ⚠️ Google search failed for "${query.substring(0, 30)}": ${err.message}`);
    }
  }

  return results;
}

// ============== MAIN ==============
async function main() {
  const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  console.log('');
  console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
  console.log('🔥  MONSTER TICKET SCRAPER - ACTIVATED  🔥');
  console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
  console.log(`⏰ ${now} (Israel Time)`);
  console.log(`🎯 Scanning ${SOURCES.length} sources + ${GOOGLE_QUERIES.length} Google queries\n`);

  const allResults = [];

  // ===== PHASE 1: Fast HTTP checks (parallel) =====
  console.log('━━━ PHASE 1: Fast HTTP Scan (all sources parallel) ━━━');
  const httpPromises = SOURCES.map(source => httpCheck(source));
  const httpResults = await Promise.allSettled(httpPromises);

  for (const result of httpResults) {
    if (result.status === 'fulfilled' && result.value.ok) {
      const findings = analyzeHtml(result.value.html, result.value.source.name);
      for (const f of findings) {
        f.url = result.value.source.url;
        allResults.push(f);
      }
    } else if (result.status === 'fulfilled' && !result.value.ok) {
      console.log(`   ${result.value.source.name}: ⚠️ ${result.value.error}`);
    }
  }

  // ===== PHASE 2: Browser deep scan (priority sources) =====
  console.log('\n━━━ PHASE 2: Browser Deep Scan ━━━');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--single-process',
      ],
    });

    // Deep scan priority sources (official + Korean platforms)
    const prioritySources = SOURCES.filter(s => s.priority <= 2);
    for (const source of prioritySources) {
      const deepResult = await browserDeepScan(browser, source);
      if (deepResult) {
        if (deepResult.relevantLinks.length > 0) {
          for (const link of deepResult.relevantLinks) {
            allResults.push({
              source: source.name,
              status: '🟡 LINK FOUND',
              details: link.text,
              url: link.href || source.url,
              weight: 6,
            });
          }
        }
        if (deepResult.activeButtons.length > 0) {
          allResults.push({
            source: source.name,
            status: '🔴 ACTIVE BUTTONS!',
            details: deepResult.activeButtons.join(', '),
            url: source.url,
            weight: 9,
          });
        }
        if (deepResult.prices.length > 0) {
          allResults.push({
            source: source.name,
            status: '🔴 PRICES FOUND!',
            details: deepResult.prices.join(', '),
            url: source.url,
            weight: 8,
          });
        }
        if (deepResult.hasQuantitySelector) {
          allResults.push({
            source: source.name,
            status: '🔴🔴🔴 QUANTITY SELECTOR!',
            details: 'Ticket quantity selector found - tickets likely available!',
            url: source.url,
            weight: 10,
          });
        }
      }
    }

    // ===== PHASE 3: Google searches =====
    console.log('\n━━━ PHASE 3: Google Search Sweep ━━━');
    const googleResults = await googleSearchCheck(browser);
    allResults.push(...googleResults);

  } catch (err) {
    console.error('Browser error:', err.message);
  } finally {
    if (browser) await browser.close();
  }

  // ===== RESULTS =====
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 SCAN COMPLETE: ${allResults.length} findings`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Deduplicate results
  const seen = new Set();
  const uniqueResults = allResults.filter(r => {
    const key = `${r.source}|${r.details}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by priority/weight
  uniqueResults.sort((a, b) => (b.weight || 0) - (a.weight || 0));

  if (uniqueResults.length > 0) {
    // Build alert message
    const highPriority = uniqueResults.filter(r => (r.weight || 0) >= 8);
    const medPriority = uniqueResults.filter(r => (r.weight || 0) >= 4 && (r.weight || 0) < 8);
    const lowPriority = uniqueResults.filter(r => (r.weight || 0) < 4);

    let message = '';

    if (highPriority.length > 0) {
      message += `🚨🚨🚨 <b>URGENT TICKET ALERT!</b> 🚨🚨🚨\n\n`;
      message += `<b>Stray Kids 6th Fan Meeting</b>\n`;
      message += `<b>"STAY in Our Little House"</b>\n\n`;
      message += `<b>🔴 HIGH PRIORITY (${highPriority.length}):</b>\n`;
      for (const r of highPriority) {
        message += `\n${r.status}\n`;
        message += `📍 ${r.source}\n`;
        message += `📝 ${r.details}\n`;
        if (r.url) message += `🔗 ${r.url}\n`;
      }
    }

    if (medPriority.length > 0) {
      message += `\n<b>🟡 WORTH CHECKING (${medPriority.length}):</b>\n`;
      for (const r of medPriority.slice(0, 10)) {
        message += `\n📍 ${r.source}\n`;
        message += `📝 ${r.details}\n`;
        if (r.url) message += `🔗 ${r.url}\n`;
      }
    }

    if (lowPriority.length > 0 && highPriority.length === 0) {
      message += `\n<b>ℹ️ LOW SIGNAL (${lowPriority.length}):</b>\n`;
      for (const r of lowPriority.slice(0, 5)) {
        message += `📍 ${r.source}: ${r.details}\n`;
      }
    }

    const dates = CONFIG.targetDates.map(d => DATE_LABELS[d] || d).join('\n');
    message += `\n📅 <b>Target Dates:</b>\n${dates}\n`;
    message += `\n⚡ <b>GO CHECK NOW!</b> ⚡`;

    await sendTelegram(message);
    console.log(`\n🎫 ALERT SENT! ${uniqueResults.length} findings.`);
  } else {
    // Send periodic "still watching" update every ~30 min (6 runs)
    const minute = new Date().getMinutes();
    if (minute < 5) {
      await sendTelegram(
        `👁 <b>Scraper Active</b> | ${now}\n\n` +
        `Scanned ${SOURCES.length} sites + ${GOOGLE_QUERIES.length} Google queries\n` +
        `❌ No tickets found yet\n\n` +
        `🔄 Checking every 2 minutes...\n` +
        `I'll alert you INSTANTLY when something appears!`
      );
    }
    console.log(`\n⏳ No tickets found. Monster sleeps... for now.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
