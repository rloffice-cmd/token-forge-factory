import 'dotenv/config';
import { Bot } from 'grammy';
import { initDb, createTables } from './db';
import { initAI, detectIntent } from './ai';
import {
  handleStoreMemory,
  handleQuestion,
  handleTaskAdd,
  handleTaskList,
  handleTaskComplete,
  handleStats,
  handleForwardedMessage,
  handleHelp,
  handleRecent,
  handleDelete,
  handleCallbackQuery,
} from './handlers';
import { startScheduler, stopScheduler } from './scheduler';

// === Validation ===

function validateEnv(): void {
  const required = ['BOT_TOKEN', 'GEMINI_API_KEY', 'OWNER_CHAT_ID'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(', ')}`);
  }
}

// === Main ===

async function main(): Promise<void> {
  console.log('🧠 המוח השני - מאתחל...');

  validateEnv();

  // Init services
  try {
    initDb();
    await createTables();
    console.log('✅ Database ready');
  } catch (err) {
    console.error('❌ Database init failed:', err);
    throw err;
  }

  try {
    initAI();
    console.log('✅ AI ready');
  } catch (err) {
    console.error('❌ AI init failed:', err);
    throw err;
  }

  const bot = new Bot(process.env.BOT_TOKEN!);
  const ownerChatId = parseInt(process.env.OWNER_CHAT_ID!);

  if (isNaN(ownerChatId)) {
    throw new Error(`Invalid OWNER_CHAT_ID: ${process.env.OWNER_CHAT_ID}`);
  }

  // === Security: Only respond to owner ===
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (chatId !== ownerChatId) {
      console.log(`⛔ Unauthorized: ${chatId}`);
      if (ctx.message) {
        await ctx.reply('⛔ הבוט הזה פרטי. גישה לא מורשית.');
      }
      return;
    }
    await next();
  });

  // === Commands ===
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '🧠 *המוח השני פעיל!*\n\n' +
      'שלח לי כל מידע שאתה רוצה לזכור.\n' +
      'שאל אותי שאלות על מה ששמרת.\n' +
      'העבר הודעות מ-WhatsApp, מייל, או כל מקום אחר.\n\n' +
      'שלח /help למדריך מלא.',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('help', handleHelp);
  bot.command('stats', handleStats);
  bot.command('tasks', handleTaskList);
  bot.command('recent', handleRecent);

  bot.command('delete', async (ctx) => {
    await handleDelete(ctx, ctx.message?.text || '');
  });

  // === Handle inline button callbacks ===
  bot.on('callback_query:data', handleCallbackQuery);

  // === Handle all text messages ===
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;

    // Skip commands (already handled above)
    if (text.startsWith('/')) return;

    // Handle forwarded messages
    if (ctx.message.forward_origin) {
      await handleForwardedMessage(ctx);
      return;
    }

    // Check for delete command
    if (/^(מחק|delete)\s/i.test(text)) {
      await handleDelete(ctx, text);
      return;
    }

    // Detect intent
    const intent = await detectIntent(text);

    switch (intent) {
      case 'question':
        await handleQuestion(ctx, text);
        break;
      case 'task_add':
        await handleTaskAdd(ctx, text);
        break;
      case 'task_list':
        await handleTaskList(ctx);
        break;
      case 'task_complete':
        await handleTaskComplete(ctx, text);
        break;
      case 'stats':
        await handleStats(ctx);
        break;
      case 'help':
        await handleHelp(ctx);
        break;
      case 'store':
      default:
        await handleStoreMemory(ctx, text);
        break;
    }
  });

  // === Handle photos with captions ===
  bot.on('message:photo', async (ctx) => {
    const caption = ctx.message.caption;
    if (caption) {
      if (ctx.message.forward_origin) {
        await handleForwardedMessage(ctx);
      } else {
        await handleStoreMemory(ctx, `[תמונה] ${caption}`);
      }
    } else {
      await ctx.reply('📷 קיבלתי תמונה, אבל בלי טקסט לא אוכל לשמור אותה. הוסף תיאור.');
    }
  });

  // === Handle documents with captions ===
  bot.on('message:document', async (ctx) => {
    const caption = ctx.message.caption || `[מסמך: ${ctx.message.document.file_name || 'ללא שם'}]`;
    if (ctx.message.forward_origin) {
      await handleForwardedMessage(ctx);
    } else {
      await handleStoreMemory(ctx, caption);
    }
  });

  // === Handle voice messages ===
  bot.on('message:voice', async (ctx) => {
    await ctx.reply('🎤 קיבלתי הודעה קולית. כרגע אני תומך רק בטקסט - שלח את התוכן כהודעת טקסט.');
  });

  // === Error handling ===
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  // === Start reminder scheduler ===
  startScheduler(bot, ownerChatId);

  // === Graceful shutdown ===
  const shutdown = () => {
    console.log('🛑 Shutting down gracefully...');
    stopScheduler();
    bot.stop();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // === Start bot ===
  console.log('🚀 המוח השני פועל!');
  console.log(`👤 Owner chat ID: ${ownerChatId}`);
  await bot.start({
    onStart: () => console.log('✅ Bot polling started successfully'),
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
