import { Bot, InlineKeyboard } from 'grammy';
import * as db from './db';
import { Task } from './types';
import { formatPriorityEmoji, formatInterval } from './utils';

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let isChecking = false;

export function startScheduler(bot: Bot, chatId: number): void {
  intervalHandle = setInterval(async () => {
    if (isChecking) return; // prevent overlapping runs
    isChecking = true;
    try {
      await checkReminders(bot, chatId);
    } catch (err) {
      console.error('Scheduler error:', err);
    } finally {
      isChecking = false;
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
  const dueTasks = db.getTasksDueForReminder();

  for (const task of dueTasks) {
    await sendReminder(bot, chatId, task);
    db.markTaskReminded(task.id);
  }
}

async function sendReminder(bot: Bot, chatId: number, task: Task): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text('✅ בוצע', `task_done:${task.id}`)
    .text('⏰ נודניק שעה', `task_snooze:${task.id}:1`)
    .row()
    .text('⏰ 3 שעות', `task_snooze:${task.id}:3`)
    .text('⏰ מחר', `task_snooze:${task.id}:24`);

  const priorityEmoji = formatPriorityEmoji(task.priority);
  const recurringLabel = task.reminder_interval_hours != null
    ? `\n🔁 תזכורת חוזרת כל ${formatInterval(task.reminder_interval_hours)}`
    : '';

  let message = `🔔 תזכורת!\n\n`;
  message += `${priorityEmoji} ${task.title}\n`;
  if (task.description) message += `📝 ${task.description}\n`;
  if (task.due_date) message += `📅 יעד: ${new Date(task.due_date).toLocaleDateString('he-IL')}\n`;
  message += recurringLabel;
  message += `\n🆔 #${task.id}`;

  try {
    await bot.api.sendMessage(chatId, message, {
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error(`Failed to send reminder for task #${task.id}:`, err);
  }
}
