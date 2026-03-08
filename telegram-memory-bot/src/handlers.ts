import { Context, InlineKeyboard } from 'grammy';
import * as db from './db';
import * as ai from './ai';
import { Memory, MemorySource, Task } from './types';
import { formatPriority, formatImportance, formatInterval } from './utils';

// === Pending Actions Cache with TTL ===

interface CachedAction {
  action: ai.AnalyzedAction;
  expiresAt: number;
}

const ACTION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const pendingActions = new Map<string, CachedAction>();

function setPendingAction(key: string, action: ai.AnalyzedAction): void {
  // Cleanup expired entries (max 50 checked per call to avoid blocking)
  let cleaned = 0;
  const now = Date.now();
  for (const [k, v] of pendingActions) {
    if (v.expiresAt < now) { pendingActions.delete(k); cleaned++; }
    if (cleaned >= 50) break;
  }
  pendingActions.set(key, { action, expiresAt: now + ACTION_TTL_MS });
}

function getPendingAction(key: string): ai.AnalyzedAction | undefined {
  const cached = pendingActions.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt < Date.now()) {
    pendingActions.delete(key);
    return undefined;
  }
  return cached.action;
}

function deletePendingAction(key: string): void {
  pendingActions.delete(key);
}

// Safe helper to get chat ID
function chatId(ctx: Context): number {
  const id = ctx.chat?.id;
  if (id == null) throw new Error('No chat ID in context');
  return id;
}

// Telegram has a 4096 character limit per message
const TELEGRAM_MAX_LENGTH = 4096;

async function safeSend(ctx: Context, text: string, options?: any): Promise<void> {
  if (text.length <= TELEGRAM_MAX_LENGTH) {
    await ctx.reply(text, options);
    return;
  }
  // Split into chunks at newline boundaries
  let remaining = text;
  while (remaining.length > 0) {
    let chunk: string;
    if (remaining.length <= TELEGRAM_MAX_LENGTH) {
      chunk = remaining;
      remaining = '';
    } else {
      const cutAt = remaining.lastIndexOf('\n', TELEGRAM_MAX_LENGTH);
      const splitAt = cutAt > TELEGRAM_MAX_LENGTH * 0.5 ? cutAt : TELEGRAM_MAX_LENGTH;
      chunk = remaining.substring(0, splitAt);
      remaining = remaining.substring(splitAt).trimStart();
    }
    // Only attach reply_markup to the last chunk
    const isLast = remaining.length === 0;
    await ctx.reply(chunk, isLast ? options : undefined);
  }
}

// === Memory Storage ===

export async function handleStoreMemory(ctx: Context, text: string, source: MemorySource = 'direct'): Promise<void> {
  const thinking = await ctx.reply('🧠 מעבד...');

  try {
    const metadata = await ai.extractMetadata(text);

    const memory = db.insertMemory({
      content: text,
      category: metadata.category,
      topic: metadata.topic,
      tags: metadata.tags,
      source,
      importance: metadata.importance,
    });

    if (metadata.is_task && metadata.task_details) {
      const task = db.insertTask({
        title: metadata.task_details.title,
        description: metadata.task_details.description,
        priority: metadata.task_details.priority,
        due_date: metadata.task_details.due_date || undefined,
        reminder_at: metadata.task_details.reminder_at || metadata.task_details.due_date || undefined,
        reminder_interval_hours: metadata.task_details.reminder_interval_hours ?? 24,
        category: metadata.category,
      });

      const keyboard = new InlineKeyboard()
        .text('✅ בוצע', `task_done:${task.id}`)
        .text('❌ מחק', `task_delete:${task.id}`);

      let msg = `✅ נשמר בזיכרון + נוסף כמשימה\n\n` +
        `📁 ${metadata.category} → ${metadata.topic}\n` +
        `🏷️ ${metadata.tags.join(', ') || 'ללא תגיות'}\n` +
        `📋 משימה: ${task.title}\n` +
        `⚡ עדיפות: ${formatPriority(task.priority)}\n`;
      if (task.reminder_at) {
        const rDate = new Date(task.reminder_at);
        msg += `🔔 תזכורת: ${rDate.toLocaleDateString('he-IL')} ${rDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}\n`;
      }
      if (task.reminder_interval_hours) {
        msg += `🔁 חוזרת כל ${formatInterval(task.reminder_interval_hours)}\n`;
      }
      msg += `🆔 זיכרון #${memory.id} | משימה #${task.id}`;

      await ctx.api.editMessageText(chatId(ctx), thinking.message_id, msg, {
        reply_markup: keyboard,
      });
    } else {
      await ctx.api.editMessageText(
        chatId(ctx),
        thinking.message_id,
        `✅ נשמר בזיכרון\n\n` +
        `📁 ${metadata.category} → ${metadata.topic}\n` +
        `🏷️ ${metadata.tags.join(', ') || 'ללא תגיות'}\n` +
        `📊 חשיבות: ${formatImportance(metadata.importance)}\n` +
        `🆔 #${memory.id}`
      );
    }
  } catch (error) {
    console.error('Store memory error:', error);
    await ctx.api.editMessageText(chatId(ctx), thinking.message_id, '❌ שגיאה בשמירה. נסה שוב.');
  }
}

// === Question Answering ===

export async function handleQuestion(ctx: Context, question: string): Promise<void> {
  const thinking = await ctx.reply('🔍 מחפש בזיכרון...');

  try {
    const keywords = await ai.extractSearchKeywords(question);
    const seen = new Set<number>();
    const unique: Memory[] = [];

    // Search by all keywords
    for (const keyword of keywords) {
      const results = db.searchMemories(keyword, 10);
      for (const m of results) {
        if (!seen.has(m.id)) { seen.add(m.id); unique.push(m); }
      }
    }

    // Add recent memories for context
    const recent = db.getRecentMemories(10);
    for (const m of recent) {
      if (!seen.has(m.id)) { seen.add(m.id); unique.push(m); }
    }

    const answer = await ai.answerQuestion(question, unique);

    await ctx.api.editMessageText(chatId(ctx), thinking.message_id, answer);
  } catch (error) {
    console.error('Question error:', error);
    await ctx.api.editMessageText(chatId(ctx), thinking.message_id, '❌ שגיאה בחיפוש. נסה שוב.');
  }
}

// === Task Management ===

export async function handleTaskAdd(ctx: Context, text: string): Promise<void> {
  const thinking = await ctx.reply('📋 מוסיף משימה...');

  try {
    const metadata = await ai.extractMetadata(text);
    const taskDetails = metadata.task_details || {
      title: text.replace(/^(תזכיר|צריך ל|חייב ל|לא לשכוח|משימה:|todo:|remind)\s*/i, ''),
      description: text,
      priority: 'medium',
    };

    const task = db.insertTask({
      title: taskDetails.title,
      description: taskDetails.description,
      priority: taskDetails.priority,
      due_date: taskDetails.due_date || undefined,
      reminder_at: taskDetails.reminder_at || taskDetails.due_date || undefined,
      reminder_interval_hours: taskDetails.reminder_interval_hours ?? 24,
      category: metadata.category,
    });

    db.insertMemory({
      content: text,
      category: metadata.category,
      topic: metadata.topic,
      tags: [...metadata.tags, 'משימה'],
      source: 'direct',
      importance: metadata.importance,
    });

    const keyboard = new InlineKeyboard()
      .text('✅ בוצע', `task_done:${task.id}`)
      .text('❌ מחק', `task_delete:${task.id}`);

    let response = `📋 משימה נוספה!\n\n`;
    response += `📌 ${task.title}\n`;
    response += `⚡ עדיפות: ${formatPriority(task.priority)}\n`;
    if (task.due_date) response += `📅 תאריך יעד: ${new Date(task.due_date).toLocaleDateString('he-IL')}\n`;
    if (task.reminder_at) {
      const rDate = new Date(task.reminder_at);
      response += `🔔 תזכורת: ${rDate.toLocaleDateString('he-IL')} ${rDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}\n`;
    }
    if (task.reminder_interval_hours) {
      response += `🔁 חוזרת כל ${formatInterval(task.reminder_interval_hours)}\n`;
    }
    response += `🆔 #${task.id}`;

    await ctx.api.editMessageText(chatId(ctx), thinking.message_id, response, {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Task add error:', error);
    await ctx.api.editMessageText(chatId(ctx), thinking.message_id, '❌ שגיאה בהוספת משימה. נסה שוב.');
  }
}

export async function handleTaskList(ctx: Context): Promise<void> {
  try {
    const tasks = db.getTasks();

    if (tasks.length === 0) {
      await ctx.reply('📋 אין משימות פתוחות! 🎉');
      return;
    }

    let response = `📋 משימות פתוחות (${tasks.length})\n\n`;
    const keyboard = new InlineKeyboard();

    tasks.forEach((task, idx) => {
      const status = task.status === 'in_progress' ? '🔄' : '⬜';
      const priority = formatPriority(task.priority);
      const due = task.due_date ? ` | 📅 ${new Date(task.due_date).toLocaleDateString('he-IL')}` : '';
      const reminder = task.reminder_at ? ' | 🔔' : '';
      response += `${status} ${task.title} ${priority}${due}${reminder}\n`;
      response += `   🆔 #${task.id}\n\n`;

      keyboard.text(`✅ #${task.id}`, `task_done:${task.id}`);
      // 3 buttons per row to avoid overflow
      if ((idx + 1) % 3 === 0) keyboard.row();
    });

    await safeSend(ctx, response, { reply_markup: keyboard });
  } catch (error) {
    console.error('Task list error:', error);
    await ctx.reply('❌ שגיאה בטעינת משימות.');
  }
}

export async function handleTaskComplete(ctx: Context, text: string): Promise<void> {
  try {
    const match = text.match(/(\d+)/);
    if (!match) {
      await ctx.reply('❌ ציין מספר משימה. לדוגמה: בוצע 5');
      return;
    }

    const taskId = parseInt(match[1], 10);
    if (isNaN(taskId)) {
      await ctx.reply('❌ מספר משימה לא תקין.');
      return;
    }

    const task = db.updateTaskStatus(taskId, 'done');

    if (!task) {
      await ctx.reply(`❌ משימה #${taskId} לא נמצאה.`);
      return;
    }

    await ctx.reply(`✅ משימה הושלמה!\n\n📌 ${task.title}\n🆔 #${task.id}`);
  } catch (error) {
    console.error('Task complete error:', error);
    await ctx.reply('❌ שגיאה בעדכון משימה.');
  }
}

// === Stats ===

export async function handleStats(ctx: Context): Promise<void> {
  try {
    const stats = db.getMemoryStats();
    const tasks = db.getTasks();
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;

    let response = `📊 סטטיסטיקות המוח השני\n\n`;
    response += `🧠 סה"כ זכרונות: ${stats.total}\n`;
    response += `📅 ב-7 ימים אחרונים: ${stats.recent_count}\n\n`;

    if (stats.categories.length > 0) {
      response += `📁 קטגוריות:\n`;
      stats.categories.forEach(c => {
        response += `  • ${c.category}: ${c.count}\n`;
      });
      response += '\n';
    }

    response += `📋 משימות:\n`;
    response += `  • ממתינות: ${pendingTasks}\n`;
    response += `  • בביצוע: ${inProgressTasks}\n`;

    await ctx.reply(response);
  } catch (error) {
    console.error('Stats error:', error);
    await ctx.reply('❌ שגיאה בטעינת סטטיסטיקות.');
  }
}

// === Analysis Response Builder ===

function buildAnalysisResponse(
  analysis: ai.MessageAnalysis,
  memoryId: number
): { text: string; keyboard: InlineKeyboard | undefined } {
  let response = `📨 הודעה נותחה ונשמרה\n\n`;
  response += `👤 שולח: ${analysis.sender}\n`;
  response += `📁 ${analysis.category} → ${analysis.topic}\n`;
  response += `📊 חשיבות: ${formatImportance(analysis.importance)}\n`;
  response += `🆔 #${memoryId}\n\n`;
  response += `📝 תקציר:\n${analysis.summary}\n`;

  if (analysis.key_info.length > 0) {
    response += `\n💡 נקודות מפתח:\n`;
    analysis.key_info.forEach(info => {
      response += `• ${info}\n`;
    });
  }

  if (analysis.actions.length === 0) {
    return { text: response + '\n✅ לא זוהו פעולות נדרשות.', keyboard: undefined };
  }

  response += `\n🎯 פעולות שזוהו:\n`;
  const keyboard = new InlineKeyboard();

  analysis.actions.forEach((action, i) => {
    const typeEmoji = action.type === 'event' ? '📅' : action.type === 'reminder' ? '🔔' : action.type === 'link' ? '🔗' : '📋';
    response += `\n${typeEmoji} ${action.title}\n`;
    if (action.description && action.description !== action.title) {
      response += `   ${action.description}\n`;
    }
    if (action.date) response += `   📅 ${action.date}`;
    if (action.time) response += ` ⏰ ${action.time}`;
    if (action.date || action.time) response += '\n';
    if (action.link) response += `   🔗 ${action.link}\n`;
    response += `   ⚡ ${formatPriority(action.priority)}\n`;

    const actionKey = `action_${memoryId}_${i}`;
    setPendingAction(actionKey, action);

    const shortTitle = action.title.substring(0, 20);
    const btnLabel = action.type === 'event' ? `📅 תזכורת: ${shortTitle}` :
                     action.type === 'link' ? `🔗 שמור: ${shortTitle}` :
                     `📋 משימה: ${shortTitle}`;
    keyboard.text(btnLabel, `create_action:${actionKey}`).row();
  });

  keyboard.text('✅ צור הכל', `create_all:${memoryId}_${analysis.actions.length}`).row();

  return { text: response, keyboard };
}

// === Forwarded Messages ===

export async function handleForwardedMessage(ctx: Context): Promise<void> {
  const text = ctx.message?.text || ctx.message?.caption || '';
  if (!text) {
    await ctx.reply('❌ לא הצלחתי לקרוא את ההודעה המועברת. נסה להעתיק את הטקסט ולשלוח ישירות.');
    return;
  }

  let source: MemorySource = 'forwarded';
  const forwardFrom = ctx.message?.forward_origin;
  if (forwardFrom) {
    const forwardText = JSON.stringify(forwardFrom).toLowerCase();
    if (forwardText.includes('whatsapp')) source = 'whatsapp';
    else if (forwardText.includes('mail') || forwardText.includes('email')) source = 'email';
  }

  if (text.length < 100) {
    await handleStoreMemory(ctx, text, source);
    return;
  }

  const thinking = await ctx.reply('🔍 מנתח את ההודעה לעומק...');

  try {
    const analysis = await ai.analyzeMessage(text);

    const memory = db.insertMemory({
      content: text,
      category: analysis.category,
      topic: analysis.topic,
      tags: analysis.tags,
      source,
      importance: analysis.importance,
    });

    const { text: responseText, keyboard } = buildAnalysisResponse(analysis, memory.id);

    await ctx.api.editMessageText(chatId(ctx), thinking.message_id, responseText,
      keyboard ? { reply_markup: keyboard } : undefined
    );
  } catch (error) {
    console.error('Forward analysis error:', error);
    await handleStoreMemory(ctx, text, source);
  }
}

export async function handleAnalyzeMessage(ctx: Context, text: string): Promise<void> {
  const thinking = await ctx.reply('🔍 מנתח את ההודעה לעומק...');

  try {
    const analysis = await ai.analyzeMessage(text);

    const memory = db.insertMemory({
      content: text,
      category: analysis.category,
      topic: analysis.topic,
      tags: analysis.tags,
      source: 'direct',
      importance: analysis.importance,
    });

    const { text: responseText, keyboard } = buildAnalysisResponse(analysis, memory.id);

    await ctx.api.editMessageText(chatId(ctx), thinking.message_id, responseText,
      keyboard ? { reply_markup: keyboard } : undefined
    );
  } catch (error) {
    console.error('Analyze message error:', error);
    await handleStoreMemory(ctx, text);
  }
}

// === Help ===

export async function handleHelp(ctx: Context): Promise<void> {
  try {
  const help = `🧠 המוח השני - מדריך שימוש

שמירת מידע:
פשוט שלח הודעה - הבוט ישמור ויקטלג אוטומטית.

שליפת מידע:
שאל שאלה רגילה, לדוגמה:
• "מה הדוזאג' של הריטלין?"
• "מה הייתה המסקנה מהפגישה עם דוד?"
• "כמה עלה הלפטופ?"

משימות ותזכורות:
• "תזכיר לי לקנות חלב ביום רביעי ב-12:00" - משימה + תזכורת
• "צריך לקנות חלב" - משימה עם תזכורת חוזרת כל 24 שעות
• "תזכיר לי מחר בבוקר לקחת תרופות" - תזכורת חד-פעמית
• "משימות" - רשימת משימות פתוחות עם כפתורי סימון
• "בוצע 5" - סימון משימה #5 כהושלמה
• לחץ ✅ בכפתור - סימון מהיר
• לחץ ⏰ - דחיית תזכורת (שעה/3 שעות/מחר)

ניתוח הודעות:
העבר הודעה ארוכה (מייל, וואטסאפ) - הבוט ינתח, יזהה פעולות ויציע ליצור משימות/תזכורות.

סטטיסטיקות:
שלח "סטטיסטיקה" או "סיכום" לסקירה.

מחיקה:
• "מחק 5" - מחיקת זיכרון #5
• /delete 5 - מחיקת זיכרון מספר 5

פקודות:
/start - התחלה
/help - מדריך
/stats - סטטיסטיקות
/tasks - משימות
/recent - זכרונות אחרונים
/delete - מחיקת זיכרון`;

  await ctx.reply(help);
  } catch (error) {
    console.error('Help error:', error);
    await ctx.reply('❌ שגיאה בטעינת מדריך.');
  }
}

// === Recent Memories ===

export async function handleRecent(ctx: Context): Promise<void> {
  try {
    const memories = db.getRecentMemories(10);

    if (memories.length === 0) {
      await ctx.reply('🧠 הזיכרון ריק. שלח הודעה כדי להתחיל!');
      return;
    }

    let response = `🕐 זכרונות אחרונים:\n\n`;
    memories.forEach((m) => {
      const date = new Date(m.created_at).toLocaleDateString('he-IL');
      const time = new Date(m.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      const preview = m.content.length > 80 ? m.content.substring(0, 80) + '...' : m.content;
      response += `📁 ${m.category} | ${date} ${time}\n`;
      response += `${preview}\n`;
      response += `🏷️ ${m.tags.join(', ') || '-'} | 🆔 #${m.id}\n\n`;
    });

    await safeSend(ctx, response);
  } catch (error) {
    console.error('Recent error:', error);
    await ctx.reply('❌ שגיאה בטעינת זכרונות אחרונים.');
  }
}

// === Delete Memory ===

export async function handleDelete(ctx: Context, text: string): Promise<void> {
  try {
    const match = text.match(/(\d+)/);
    if (!match) {
      await ctx.reply('❌ ציין מספר זיכרון למחיקה. לדוגמה: מחק 5');
      return;
    }

    const id = parseInt(match[1], 10);
    if (isNaN(id)) {
      await ctx.reply('❌ מספר לא תקין.');
      return;
    }

    const deleted = db.deleteMemory(id);

    if (deleted) {
      await ctx.reply(`🗑️ זיכרון #${id} נמחק.`);
    } else {
      await ctx.reply(`❌ זיכרון #${id} לא נמצא.`);
    }
  } catch (error) {
    console.error('Delete error:', error);
    await ctx.reply('❌ שגיאה במחיקה.');
  }
}

// === Callback Query Handlers (Inline Buttons) ===

export async function handleCallbackQuery(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  try {
    if (data.startsWith('task_done:')) {
      const taskId = parseInt(data.split(':')[1], 10);
      if (isNaN(taskId)) return;
      const task = db.updateTaskStatus(taskId, 'done');
      if (task) {
        await ctx.answerCallbackQuery({ text: `✅ "${task.title}" הושלמה!` });
        await ctx.editMessageText(`✅ הושלם!\n\n${task.title}\n🆔 #${task.id}`);
      } else {
        await ctx.answerCallbackQuery({ text: '❌ משימה לא נמצאה' });
      }
    } else if (data.startsWith('task_snooze:')) {
      const parts = data.split(':');
      const taskId = parseInt(parts[1], 10);
      const hours = parseFloat(parts[2]);
      if (isNaN(taskId) || isNaN(hours)) return;
      const task = db.snoozeTask(taskId, hours);
      if (task) {
        const label = hours >= 24 ? `${Math.round(hours / 24)} ימים` : `${hours} שעות`;
        await ctx.answerCallbackQuery({ text: `⏰ נדחה ל-${label}` });
        const snoozeTime = new Date(Date.now() + hours * 3600000);
        await ctx.editMessageText(
          `⏰ נדחה!\n\n📌 ${task.title}\n⏰ תזכורת הבאה: ${snoozeTime.toLocaleDateString('he-IL')} ${snoozeTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}\n🆔 #${task.id}`
        );
      } else {
        await ctx.answerCallbackQuery({ text: '❌ משימה לא נמצאה' });
      }
    } else if (data.startsWith('create_action:')) {
      const actionKey = data.replace('create_action:', '');
      const action = getPendingAction(actionKey);
      if (action) {
        const task = await createTaskFromAction(action);
        deletePendingAction(actionKey);
        await ctx.answerCallbackQuery({ text: `✅ נוצר: ${task.title}` });
        try {
          const msgText = (ctx.callbackQuery as any)?.message?.text || '';
          await ctx.editMessageText(msgText + `\n\n✅ נוצרה משימה: ${task.title} (🆔 #${task.id})`);
        } catch { /* message might be too old */ }
      } else {
        await ctx.answerCallbackQuery({ text: '❌ פעולה כבר בוצעה או פגה' });
      }
    } else if (data.startsWith('create_all:')) {
      const parts = data.replace('create_all:', '').split('_');
      const memoryId = parseInt(parts[0], 10);
      const count = parseInt(parts[1], 10);
      if (isNaN(memoryId) || isNaN(count)) return;
      let created = 0;
      for (let i = 0; i < count; i++) {
        const actionKey = `action_${memoryId}_${i}`;
        const action = getPendingAction(actionKey);
        if (action) {
          await createTaskFromAction(action);
          deletePendingAction(actionKey);
          created++;
        }
      }
      await ctx.answerCallbackQuery({ text: `✅ נוצרו ${created} משימות/תזכורות` });
      try {
        const msgText = (ctx.callbackQuery as any)?.message?.text || '';
        await ctx.editMessageText(msgText + `\n\n✅ נוצרו ${created} משימות/תזכורות!`);
      } catch { /* message might be too old */ }
    } else if (data.startsWith('task_delete:')) {
      const taskId = parseInt(data.split(':')[1], 10);
      if (isNaN(taskId)) return;
      const deleted = db.deleteTask(taskId);
      if (deleted) {
        await ctx.answerCallbackQuery({ text: '🗑️ משימה נמחקה' });
        await ctx.editMessageText(`🗑️ משימה #${taskId} נמחקה.`);
      } else {
        await ctx.answerCallbackQuery({ text: '❌ משימה לא נמצאה' });
      }
    }
  } catch (error) {
    console.error('Callback query error:', error);
    try { await ctx.answerCallbackQuery({ text: '❌ שגיאה' }); } catch { /* ignore */ }
  }
}

// === Action to Task ===

async function createTaskFromAction(action: ai.AnalyzedAction): Promise<Task> {
  let reminderAt = action.reminder_at;
  if (!reminderAt && action.date) {
    // Normalize time: strip seconds if already present (e.g. "09:00:00" -> "09:00")
    const rawTime = action.time || '09:00';
    const timeStr = /^\d{1,2}:\d{2}:\d{2}$/.test(rawTime) ? rawTime.replace(/:\d{2}$/, '') : rawTime;
    const dateTime = new Date(`${action.date}T${timeStr}:00`);
    if (!isNaN(dateTime.getTime())) {
      if (action.time) {
        dateTime.setMinutes(dateTime.getMinutes() - 30);
      }
      reminderAt = dateTime.toISOString();
    }
  }

  return db.insertTask({
    title: action.title,
    description: action.description + (action.link ? `\n🔗 ${action.link}` : ''),
    priority: action.priority,
    due_date: action.date || undefined,
    reminder_at: reminderAt || undefined,
    reminder_interval_hours: action.type === 'event' ? undefined : 24,
  });
}
