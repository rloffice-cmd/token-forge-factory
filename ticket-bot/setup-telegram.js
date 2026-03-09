import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function setup() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  🤖 Telegram Bot Setup                        ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
  console.log('How to create a Telegram Bot:');
  console.log('1. Open Telegram');
  console.log('2. Search for @BotFather');
  console.log('3. Send /newbot');
  console.log('4. Give your bot a name (e.g., "Stray Kids Ticket Alert")');
  console.log('5. Give it a username (e.g., "skz_ticket_alert_bot")');
  console.log('6. Copy the token you receive\n');

  const token = await ask('Paste your Telegram Bot Token here: ');

  if (!token || token.length < 20) {
    console.log('❌ Invalid token. Please try again.');
    rl.close();
    return;
  }

  console.log('\n⏳ Connecting to Telegram...');

  try {
    const bot = new TelegramBot(token, { polling: true });

    console.log('✅ Bot connected!');
    console.log('\n📱 Now open Telegram and send any message to your bot.');
    console.log('   I will detect your Chat ID automatically...\n');

    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      console.log(`\n✅ Chat ID detected: ${chatId}`);
      console.log(`   From: ${msg.from.first_name} ${msg.from.last_name || ''}`);

      // Update .env file
      let envContent = readFileSync('.env', 'utf-8');
      envContent = envContent.replace(/TELEGRAM_BOT_TOKEN=.*/, `TELEGRAM_BOT_TOKEN=${token}`);
      envContent = envContent.replace(/TELEGRAM_CHAT_ID=.*/, `TELEGRAM_CHAT_ID=${chatId}`);
      writeFileSync('.env', envContent);

      console.log('\n✅ .env file updated with your Telegram credentials!');

      // Send confirmation
      await bot.sendMessage(
        chatId,
        '🎫 *Stray Kids Ticket Bot Connected!*\n\n' +
          'You will receive alerts when tickets become available for:\n' +
          '📅 29.3.2026 (Day 2)\n' +
          '📅 5.4.2026 (Day 4)\n\n' +
          'Run `npm start` in the ticket-bot folder to begin monitoring!',
        { parse_mode: 'Markdown' }
      );

      console.log('\n🎉 Setup complete! Now run: npm start');
      await bot.stopPolling();
      rl.close();
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Failed to connect:', err.message);
    rl.close();
  }
}

setup();
