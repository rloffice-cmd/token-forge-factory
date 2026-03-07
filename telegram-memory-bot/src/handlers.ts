import { Context } from 'grammy';
import * as db from './db';
import * as ai from './ai';
import { Memory, MemorySource } from './types';

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
        category: metadata.category,
      });

      await ctx.api.editMessageText(
        ctx.chat!.id,
        thinking.message_id,
        `✅ נשמר בזיכרון + נוסף כמשימה\n\n` +
        `📁 ${metadata.category} → ${metadata.topic}\n` +
        `🏷️ ${metadata.tags.join(', ') || 'ללא תגיות'}\n` +
        `📋 משימה: ${task.title}\n` +
        `⚡ עדיפות: ${formatPriority(task.priority)}\n` +
        `🆔 זיכרון #${memory.id} | משימה #${task.id}`
      );
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

    let response = `📋 משימה נוספה!\n\n`;
    response += `📌 ${task.title}\n`;
    response += `⚡ עדיפות: ${formatPriority(task.priority)}\n`;
    if (task.due_date) response += `📅 תאריך יעד: ${new Date(task.due_date).toLocaleDateString('he-IL')}\n`;
    response += `🆔 #${task.id}`;

    await ctx.api.editMessageText(ctx.chat!.id, thinking.message_id, response);
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

    tasks.forEach((task, i) => {
      const status = task.status === 'in_progress' ? '🔄' : '⬜';
      const priority = formatPriority(task.priority);
      const due = task.due_date ? ` | 📅 ${new Date(task.due_date).toLocaleDateString('he-IL')}` : '';
      response += `${status} *${task.title}* ${priority}${due}\n`;
      response += `   סיום: \`בוצע ${task.id}\`\n\n`;
    });

    await ctx.reply(response, { parse_mode: 'Markdown' });
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

  // Try to detect source
  const forwardFrom = ctx.message?.forward_origin;
  if (forwardFrom) {
    // Check if it's from a known channel/contact type
    const forwardText = JSON.stringify(forwardFrom).toLowerCase();
    if (forwardText.includes('whatsapp')) source = 'whatsapp';
    else if (forwardText.includes('mail') || forwardText.includes('email')) source = 'email';
  }

  const enrichedText = text;
  await handleStoreMemory(ctx, enrichedText, source);
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

*משימות:*
• "תזכיר לי לחזור לדוד" - הוספת משימה
• "צריך לקנות חלב" - הוספת משימה
• "משימות" - רשימת משימות פתוחות
• "בוצע 5" - סימון משימה #5 כהושלמה

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

