import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const chatId = process.env.TELEGRAM_CHAT_ID;

try {
  await bot.sendMessage(chatId,
    '🎫 *בוט כרטיסים מחובר בהצלחה\\!*\n\n' +
    '🎵 Stray Kids 6th Fan Meeting\n' +
    '🏠 STAY in Our Little House\n\n' +
    '📅 תאריכים מבוקשים:\n' +
    '• שבת 28\\.3\\.2026 \\(Day 1\\)\n' +
    '• ראשון 29\\.3\\.2026 \\(Day 2\\)\n' +
    '• שבת 4\\.4\\.2026 \\(Day 3\\)\n' +
    '• ראשון 5\\.4\\.2026 \\(Day 4\\)\n\n' +
    '🔍 הבוט יסרוק:\n' +
    '• NOL World \\(אתר רשמי\\)\n' +
    '• Tixel \\(שוק משני\\)\n' +
    '• SeatPick \\(שוק משני\\)\n' +
    '• VividSeats \\(שוק משני\\)\n\n' +
    '⏱ בדיקה כל 30 שניות\n' +
    '✅ תקבל/י הודעה ברגע שכרטיס יימצא\\!',
    { parse_mode: 'MarkdownV2' }
  );
  console.log('✅ Telegram message sent successfully!');
} catch (err) {
  console.error('❌ Failed:', err.message);
}
process.exit(0);
