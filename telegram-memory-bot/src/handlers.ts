import { Context, InlineKeyboard } from 'grammy';
import * as db from './db';
import * as ai from './ai';
import { Memory, MemorySource, Task } from './types';

// In-memory cache for pending analysis actions (cleared on restart)
const pendingActions = new Map<string, ai.AnalyzedAction>();

// === Memory Storage ===

export async function handleStoreMemory(ctx: Context, text: string, source: MemorySource = 'direct'): Promise<void> {
  const thinking = await ctx.reply('🧠 מעבד...');

  try {
    const metadata = await ai.extractMetadata(text);

    // Store as memory
    const memory = await db.insertMemory({
      content: text,
      category: metadata.category,
      topic: metadata.topic,
      tags: metadata.tags,
      source,
      importance: metadata.importance,
    });

    // If it's also a task, create a task entry
    if (metadata.is_task && metadata.task_details) {
      const task = await db.insertTask({
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

      await ctx.api.editMessageText(ctx.chat!.id, thinking.message_id, msg, {
        reply_markup: keyboard,
      });
    } else {
      await ctx.api.editMessageText(
        ctx.chat!.id,
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
    await ctx.api.editMessageText(ctx.chat!.id, thinking.message_id, '❌ שגיאה בשמירה. נסה שוב.');
  }
}

// === Question Answering ===

export async function handleQuestion(ctx: Context, question: string): Promise<void> {
  const thinking = await ctx.reply('🔍 מחפש בזיכרון...');

  try {
    // Extract keywords and search
    const keywords = await ai.extractSearchKeywords(question);
    let allMemories: Memory[] = [];

    // Search by each keyword
    for (const keyword of keywords) {
      const results = await db.searchMemories(keyword, 10);
      allMemories.push(...results);
    }

    // Also get recent memories for context
    const recent = await db.getRecentMemories(10);
    allMemories.push(...recent);

    // Deduplicate by ID
    const seen = new Set<number>();
    const unique = allMemories.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    const answer = await ai.answerQuestion(question, unique);

    await ctx.api.editMessageText(ctx.chat!.id, thinking.message_id, answer);
  } catch (error) {
    console.error('Question error:', error);
    await ctx.api.editMessageText(ctx.chat!.id, thinking.message_id, '❌ שגיאה בחיפוש. נסה שוב.');
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

    const task = await db.insertTask({
      title: taskDetails.title,
      description: taskDetails.description,
      priority: taskDetails.priority,
      due_date: taskDetails.due_date || undefined,
      reminder_at: taskDetails.reminder_at || taskDetails.due_date || undefined,
      reminder_interval_hours: taskDetails.reminder_interval_hours ?? 24,
      category: metadata.category,
    });

    // Also store as memory
    await db.insertMemory({
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

    await ctx.api.editMessageText(ctx.chat!.id, thinking.message_id, response, {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Task add error:', error);
    await ctx.api.editMessageText(ctx.chat!.id, thinking.message_id, '❌ שגיאה בהוספת משימה. נסה שוב.');
  }
}

export async function handleTaskList(ctx: Context): Promise<void> {
  try {
    const tasks = await db.getTasks();

    if (tasks.length === 0) {
      await ctx.reply('📋 אין משימות פתוחות! 🎉');
      return;
    }

    let response = `📋 *משימות פתוחות* (${tasks.length})\n\n`;

    const keyboard = new InlineKeyboard();

    tasks.forEach((task) => {
      const status = task.status === 'in_progress' ? '🔄' : '⬜';
      const priority = formatPriority(task.priority);
      const due = task.due_date ? ` | 📅 ${new Date(task.due_date).toLocaleDateString('he-IL')}` : '';
      const reminder = task.reminder_at ? ' | 🔔' : '';
      response += `${status} *${task.title}* ${priority}${due}${reminder}\n`;
      response += `   🆔 #${task.id}\n\n`;

      keyboard.text(`✅ #${task.id}`, `task_done:${task.id}`);
    });

    await ctx.reply(response, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch (error) {
    console.error('Task list error:', error);
    await ctx.reply('❌ שגיאה בטעינת משימות.');
  }
}

export async function handleTaskComplete(ctx: Context, text: string): Promise<void> {
  try {
    // Extract task ID from text
    const match = text.match(/(\d+)/);
    if (!match) {
      await ctx.reply('❌ ציין מספר משימה. לדוגמה: `בוצע 5`', { parse_mode: 'Markdown' });
      return;
    }

    const taskId = parseInt(match[1]);
    const task = await db.updateTaskStatus(taskId, 'done');

    if (!task) {
      await ctx.reply(`❌ משימה #${taskId} לא נמצאה.`);
      return;
    }

    await ctx.reply(`✅ משימה הושלמה!\n\n📌 ~~${task.title}~~\n🆔 #${task.id}`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Task complete error:', error);
    await ctx.reply('❌ שגיאה בעדכון משימה.');
  }
}

// === Stats ===

export async function handleStats(ctx: Context): Promise<void> {
  try {
    const stats = await db.getMemoryStats();
    const tasks = await db.getTasks();
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;

    let response = `📊 *סטטיסטיקות המוח השני*\n\n`;
    response += `🧠 סה"כ זכרונות: ${stats.total}\n`;
    response += `📅 ב-7 ימים אחרונים: ${stats.recent_count}\n\n`;

    if (stats.categories.length > 0) {
      response += `📁 *קטגוריות:*\n`;
      stats.categories.forEach(c => {
        response += `  • ${c.category}: ${c.count}\n`;
      });
      response += '\n';
    }

    response += `📋 *משימות:*\n`;
    response += `  • ממתינות: ${pendingTasks}\n`;
    response += `  • בביצוע: ${inProgressTasks}\n`;

    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Stats error:', error);
    await ctx.reply('❌ שגיאה בטעינת סטטיסטיקות.');
  }
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

  // Short messages - just store normally
  if (text.length < 100) {
    await handleStoreMemory(ctx, text, source);
    return;
  }

  // Long messages - deep analysis
  const thinking = await ctx.reply('🔍 מנתח את ההודעה לעומק...');

  try {
    const analysis = await ai.analyzeMessage(text);

    // Store the full message as memory
    const memory = await db.insertMemory({
      content: text,
      category: analysis.category,
      topic: analysis.topic,
      tags: analysis.tags,
      source,
      importance: analysis.importance,
    });

    // Build the analysis response
    let response = `📨 *הודעה נותחה ונשמרה*\n\n`;
    response += `👤 שולח: ${analysis.sender}\n`;
    response += `📁 ${analysis.category} → ${analysis.topic}\n`;
    response += `📊 חשיבות: ${formatImportance(analysis.importance)}\n`;
    response += `🆔 #${memory.id}\n\n`;

    response += `📝 *תקציר:*\n${analysis.summary}\n`;

    // Key information
    if (analysis.key_info.length > 0) {
      response += `\n💡 *נקודות מפתח:*\n`;
      analysis.key_info.forEach(info => {
        response += `• ${info}\n`;
      });
    }

    // Detected actions
    if (analysis.actions.length > 0) {
      response += `\n🎯 *פעולות שזוהו:*\n`;
      const keyboard = new InlineKeyboard();

      analysis.actions.forEach((action, i) => {
        const typeEmoji = action.type === 'event' ? '📅' : action.type === 'reminder' ? '🔔' : action.type === 'link' ? '🔗' : '📋';
        response += `\n${typeEmoji} *${action.title}*\n`;
        if (action.description && action.description !== action.title) {
          response += `   ${action.description}\n`;
        }
        if (action.date) response += `   📅 ${action.date}`;
        if (action.time) response += ` ⏰ ${action.time}`;
        if (action.date || action.time) response += '\n';
        if (action.link) response += `   🔗 ${action.link}\n`;
        response += `   ⚡ ${formatPriority(action.priority)}\n`;

        // Store action for callback and add button
        const actionKey = `action_${memory.id}_${i}`;
        pendingActions.set(actionKey, action);

        const btnLabel = action.type === 'event' ? `📅 צור תזכורת: ${action.title.substring(0, 20)}` :
                         action.type === 'link' ? `🔗 שמור: ${action.title.substring(0, 20)}` :
                         `📋 צור משימה: ${action.title.substring(0, 20)}`;
        keyboard.text(btnLabel, `create_action:${actionKey}`).row();
      });

      keyboard.text('✅ צור הכל', `create_all:${memory.id}_${analysis.actions.length}`).row();

      await ctx.api.editMessageText(ctx.chat!.id, thinking.message_id, response, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } else {
      await ctx.api.editMessageText(ctx.chat!.id, thinking.message_id, response + '\n✅ לא זוהו פעולות נדרשות.', {
        parse_mode: 'Markdown',
      });
    }
  } catch (error) {
    console.error('Forward analysis error:', error);
    // Fallback to simple store
    await handleStoreMemory(ctx, text, source);
  }
}

// Also handle pasted long messages (non-forwarded) that look like emails/messages
export async function handleAnalyzeMessage(ctx: Context, text: string): Promise<void> {
  // Reuse forwarded handler logic for pasted content
  const thinking = await ctx.reply('🔍 מנתח את ההודעה לעומק...');

  try {
    const analysis = await ai.analyzeMessage(text);

    const memory = await db.insertMemory({
      content: text,
      category: analysis.category,
      topic: analysis.topic,
      tags: analysis.tags,
      source: 'direct',
      importance: analysis.importance,
    });

    let response = `📨 *הודעה נותחה ונשמרה*\n\n`;
    response += `👤 שולח: ${analysis.sender}\n`;
    response += `📁 ${analysis.category} → ${analysis.topic}\n`;
    response += `📊 חשיבות: ${formatImportance(analysis.importance)}\n`;
    response += `🆔 #${memory.id}\n\n`;
    response += `📝 *תקציר:*\n${analysis.summary}\n`;

    if (analysis.key_info.length > 0) {
      response += `\n💡 *נקודות מפתח:*\n`;
      analysis.key_info.forEach(info => {
        response += `• ${info}\n`;
      });
    }

    if (analysis.actions.length > 0) {
      response += `\n🎯 *פעולות שזוהו:*\n`;
      const keyboard = new InlineKeyboard();

      analysis.actions.forEach((action, i) => {
        const typeEmoji = action.type === 'event' ? '📅' : action.type === 'reminder' ? '🔔' : action.type === 'link' ? '🔗' : '📋';
        response += `\n${typeEmoji} *${action.title}*\n`;
        if (action.description && action.description !== action.title) {
          response += `   ${action.description}\n`;
        }
        if (action.date) response += `   📅 ${action.date}`;
        if (action.time) response += ` ⏰ ${action.time}`;
        if (action.date || action.time) response += '\n';
        if (action.link) response += `   🔗 ${action.link}\n`;
        response += `   ⚡ ${formatPriority(action.priority)}\n`;

        const actionKey = `action_${memory.id}_${i}`;
        pendingActions.set(actionKey, action);

        const btnLabel = action.type === 'event' ? `📅 צור תזכורת: ${action.title.substring(0, 20)}` :
                         action.type === 'link' ? `🔗 שמור: ${action.title.substring(0, 20)}` :
                         `📋 צור משימה: ${action.title.substring(0, 20)}`;
        keyboard.text(btnLabel, `create_action:${actionKey}`).row();
      });

      keyboard.text('✅ צור הכל', `create_all:${memory.id}_${analysis.actions.length}`).row();

      await ctx.api.editMessageText(ctx.chat!.id, thinking.message_id, response, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } else {
      await ctx.api.editMessageText(ctx.chat!.id, thinking.message_id, response + '\n✅ לא זוהו פעולות נדרשות.', {
        parse_mode: 'Markdown',
      });
    }
  } catch (error) {
    console.error('Analyze message error:', error);
    await handleStoreMemory(ctx, text);
  }
}

// === Help ===

export async function handleHelp(ctx: Context): Promise<void> {
  const help = `🧠 *המוח השני - מדריך שימוש*

*שמירת מידע:*
פשוט שלח הודעה - הבוט ישמור ויקטלג אוטומטית.

*שליפת מידע:*
שאל שאלה רגילה, לדוגמה:
• "מה הדוזאג' של הריטלין?"
• "מה הייתה המסקנה מהפגישה עם דוד?"
• "כמה עלה הלפטופ?"

*משימות ותזכורות:*
• "תזכיר לי לקנות חלב ביום רביעי ב-12:00" - משימה + תזכורת
• "צריך לקנות חלב" - משימה עם תזכורת חוזרת כל 24 שעות
• "תזכיר לי מחר בבוקר לקחת תרופות" - תזכורת חד-פעמית
• "משימות" - רשימת משימות פתוחות עם כפתורי סימון
• "בוצע 5" - סימון משימה #5 כהושלמה
• לחץ ✅ בכפתור - סימון מהיר
• לחץ ⏰ - דחיית תזכורת (שעה/3 שעות/מחר)

*העברת הודעות:*
העבר הודעות מ-WhatsApp, מייל או צ'אטים אחרים - הכל יישמר ויקוטלג.

*סטטיסטיקות:*
שלח "סטטיסטיקה" או "סיכום" לסקירת המוח השני.

*פקודות:*
/start - התחלה
/help - מדריך
/stats - סטטיסטיקות
/tasks - משימות
/recent - זכרונות אחרונים`;

  await ctx.reply(help, { parse_mode: 'Markdown' });
}

// === Recent Memories ===

export async function handleRecent(ctx: Context): Promise<void> {
  try {
    const memories = await db.getRecentMemories(10);

    if (memories.length === 0) {
      await ctx.reply('🧠 הזיכרון ריק. שלח הודעה כדי להתחיל!');
      return;
    }

    let response = `🕐 *זכרונות אחרונים:*\n\n`;
    memories.forEach((m) => {
      const date = new Date(m.created_at).toLocaleDateString('he-IL');
      const time = new Date(m.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      const preview = m.content.length > 80 ? m.content.substring(0, 80) + '...' : m.content;
      response += `📁 *${m.category}* | ${date} ${time}\n`;
      response += `${preview}\n`;
      response += `🏷️ ${m.tags.join(', ') || '-'} | 🆔 #${m.id}\n\n`;
    });

    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Recent error:', error);
    await ctx.reply('❌ שגיאה בטעינת זכרונות אחרונים.');
  }
}

// === Delete Memory ===

export async function handleDelete(ctx: Context, text: string): Promise<void> {
  const match = text.match(/(\d+)/);
  if (!match) {
    await ctx.reply('❌ ציין מספר זיכרון למחיקה. לדוגמה: `מחק 5`', { parse_mode: 'Markdown' });
    return;
  }

  const id = parseInt(match[1]);
  const deleted = await db.deleteMemory(id);

  if (deleted) {
    await ctx.reply(`🗑️ זיכרון #${id} נמחק.`);
  } else {
    await ctx.reply(`❌ זיכרון #${id} לא נמצא.`);
  }
}

// === Callback Query Handlers (Inline Buttons) ===

export async function handleCallbackQuery(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  try {
    if (data.startsWith('task_done:')) {
      const taskId = parseInt(data.split(':')[1]);
      const task = await db.updateTaskStatus(taskId, 'done');
      if (task) {
        await ctx.answerCallbackQuery({ text: `✅ משימה "${task.title}" הושלמה!` });
        await ctx.editMessageText(
          `✅ *הושלם!*\n\n~~${task.title}~~\n🆔 #${task.id}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.answerCallbackQuery({ text: '❌ משימה לא נמצאה' });
      }
    } else if (data.startsWith('task_snooze:')) {
      const parts = data.split(':');
      const taskId = parseInt(parts[1]);
      const hours = parseFloat(parts[2]);
      const task = await db.snoozeTask(taskId, hours);
      if (task) {
        const label = hours >= 24 ? `${Math.round(hours / 24)} ימים` : `${hours} שעות`;
        await ctx.answerCallbackQuery({ text: `⏰ נדחה ל-${label}` });
        const snoozeTime = new Date(Date.now() + hours * 3600000);
        await ctx.editMessageText(
          `⏰ *נדחה!*\n\n📌 ${task.title}\n⏰ תזכורת הבאה: ${snoozeTime.toLocaleDateString('he-IL')} ${snoozeTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}\n🆔 #${task.id}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.answerCallbackQuery({ text: '❌ משימה לא נמצאה' });
      }
    } else if (data.startsWith('create_action:')) {
      const actionKey = data.replace('create_action:', '');
      const action = pendingActions.get(actionKey);
      if (action) {
        const task = await createTaskFromAction(action);
        pendingActions.delete(actionKey);
        await ctx.answerCallbackQuery({ text: `✅ נוצר: ${task.title}` });
        // Update the button to show it was created
        try {
          const text = (ctx.callbackQuery as any)?.message?.text || '';
          const newText = text + `\n\n✅ *נוצרה משימה:* ${task.title} (🆔 #${task.id})`;
          await ctx.editMessageText(newText, { parse_mode: 'Markdown' });
        } catch { /* message might be too old */ }
      } else {
        await ctx.answerCallbackQuery({ text: '❌ פעולה כבר בוצעה או פגה' });
      }
    } else if (data.startsWith('create_all:')) {
      const parts = data.replace('create_all:', '').split('_');
      const memoryId = parseInt(parts[0]);
      const count = parseInt(parts[1]);
      let created = 0;
      for (let i = 0; i < count; i++) {
        const actionKey = `action_${memoryId}_${i}`;
        const action = pendingActions.get(actionKey);
        if (action) {
          await createTaskFromAction(action);
          pendingActions.delete(actionKey);
          created++;
        }
      }
      await ctx.answerCallbackQuery({ text: `✅ נוצרו ${created} משימות/תזכורות` });
      try {
        const text = (ctx.callbackQuery as any)?.message?.text || '';
        await ctx.editMessageText(text + `\n\n✅ *נוצרו ${created} משימות/תזכורות!*`, { parse_mode: 'Markdown' });
      } catch { /* message might be too old */ }
    } else if (data.startsWith('task_delete:')) {
      const taskId = parseInt(data.split(':')[1]);
      const deleted = await db.deleteTask(taskId);
      if (deleted) {
        await ctx.answerCallbackQuery({ text: '🗑️ משימה נמחקה' });
        await ctx.editMessageText(`🗑️ משימה #${taskId} נמחקה.`);
      } else {
        await ctx.answerCallbackQuery({ text: '❌ משימה לא נמצאה' });
      }
    }
  } catch (error) {
    console.error('Callback query error:', error);
    await ctx.answerCallbackQuery({ text: '❌ שגיאה' });
  }
}

// === Action to Task ===

async function createTaskFromAction(action: ai.AnalyzedAction): Promise<Task> {
  let reminderAt = action.reminder_at;
  if (!reminderAt && action.date) {
    // Create reminder from date + time (30 min before if time specified)
    const timeStr = action.time || '09:00';
    const dateTime = new Date(`${action.date}T${timeStr}:00`);
    if (action.time) {
      dateTime.setMinutes(dateTime.getMinutes() - 30); // 30 min before
    }
    reminderAt = dateTime.toISOString();
  }

  const task = await db.insertTask({
    title: action.title,
    description: action.description + (action.link ? `\n🔗 ${action.link}` : ''),
    priority: action.priority,
    due_date: action.date || undefined,
    reminder_at: reminderAt || undefined,
    reminder_interval_hours: action.type === 'event' ? undefined : 24,
  });

  return task;
}

// === Helpers ===

function formatPriority(p: string): string {
  switch (p) {
    case 'urgent': return '🔴 דחוף';
    case 'high': return '🟠 גבוה';
    case 'medium': return '🟡 בינוני';
    case 'low': return '🟢 נמוך';
    default: return p;
  }
}

function formatImportance(i: string): string {
  switch (i) {
    case 'critical': return '🔴 קריטי';
    case 'high': return '🟠 גבוה';
    case 'medium': return '🟡 בינוני';
    case 'low': return '🟢 נמוך';
    default: return i;
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

