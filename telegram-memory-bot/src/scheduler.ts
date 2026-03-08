import { Bot } from 'grammy';
import * as db from './db';
import { Task } from './types';
import { InlineKeyboard } from 'grammy';

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startScheduler(bot: Bot, chatId: number): void {
  // Check every 30 seconds for due reminders
  intervalHandle = setInterval(async () => {
    try {
      await checkReminders(bot, chatId);
    } catch (err) {
      console.error('Scheduler error:', err);
    }
  }, 30_000);

  console.log('⏰ Reminder scheduler started (checking every 30s)');
}

export function stopScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('⏰ Reminder scheduler stopped');
  }
}

async function checkReminders(bot: Bot, chatId: number): Promise<void> {
  const dueTasks = await db.getTasksDueForReminder();

  for (const task of dueTasks) {
    await sendReminder(bot, chatId, task);
    await db.markTaskReminded(task.id);
  }
}

async function sendReminder(bot: Bot, chatId: number, task: Task): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text('✅ בוצע', `task_done:${task.id}`)
    .text('⏰ נודניק שעה', `task_snooze:${task.id}:1`)
    .row()
    .text('⏰ 3 שעות', `task_snooze:${task.id}:3`)
    .text('⏰ מחר', `task_snooze:${task.id}:24`);

  const priorityEmoji = getPriorityEmoji(task.priority);
  const isRecurring = task.reminder_interval_hours != null;
  const recurringLabel = isRecurring
    ? `\n🔁 תזכורת חוזרת כל ${formatInterval(task.reminder_interval_hours!)}`
    : '';

  let message = `🔔 *תזכורת!*\n\n`;
  message += `${priorityEmoji} *${task.title}*\n`;
  if (task.description) message += `📝 ${task.description}\n`;
  if (task.due_date) message += `📅 יעד: ${new Date(task.due_date).toLocaleDateString('he-IL')}\n`;
  message += recurringLabel;
  message += `\n🆔 #${task.id}`;

  try {
    await bot.api.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error(`Failed to send reminder for task #${task.id}:`, err);
  }
}

function getPriorityEmoji(p: string): string {
  switch (p) {
    case 'urgent': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '📌';
  }
}

function formatInterval(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} דקות`;
  if (hours === 1) return 'שעה';
  if (hours < 24) return `${hours} שעות`;
  if (hours === 24) return 'יום';
  const days = Math.round(hours / 24);
  return `${days} ימים`;
}
