import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExtractedMetadata, Memory } from './types';

let genAI: GoogleGenerativeAI;
let proModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
let flashModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

export function initAI(): void {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');
  genAI = new GoogleGenerativeAI(apiKey);
  // Pro for smart answers, Flash for quick tasks
  proModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-06-05' });
  flashModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });
}

async function callAI(prompt: string, useFlash = false, retries = 3): Promise<string> {
  const model = useFlash ? flashModel : proModel;
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err: any) {
      lastError = err;
      console.error(`AI call attempt ${i + 1}/${retries} failed:`, err?.message || err);
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  // If pro fails, try flash as fallback
  if (!useFlash) {
    console.log('Pro model failed, falling back to flash...');
    try {
      const result = await flashModel.generateContent(prompt);
      return result.response.text().trim();
    } catch (err: any) {
      console.error('Flash fallback also failed:', err?.message || err);
    }
  }
  throw lastError;
}

// === Metadata Extraction ===

export async function extractMetadata(text: string): Promise<ExtractedMetadata> {
  const prompt = `אתה מנתח מידע אישי. המשתמש שלח את ההודעה הבאה לבוט הזיכרון האישי שלו.
נתח את ההודעה וחלץ מטאדטה.

ההודעה:
"${text}"

החזר JSON בלבד (בלי markdown, בלי backticks) בפורמט הבא:
{
  "category": "קטגוריה בעברית (לדוגמה: בריאות, עבודה, כספים, רעיונות, אנשים, פגישות, המלצות, מחירים, תובנות, טכנולוגיה, לימודים, אישי)",
  "topic": "נושא ספציפי בעברית (לדוגמה: ריטלין, פגישה עם דוד, מחיר לפטופ)",
  "tags": ["תגית1", "תגית2", "תגית3"],
  "importance": "low/medium/high/critical",
  "is_task": false,
  "summary": "תקציר קצר בעברית של ההודעה"
}

אם ההודעה מכילה משימה, בקשה, תזכורת או דבר שצריך לעשות, הוסף:
{
  "is_task": true,
  "task_details": {
    "title": "כותרת המשימה",
    "description": "תיאור מפורט",
    "priority": "low/medium/high/urgent",
    "due_date": "YYYY-MM-DD אם צוין תאריך, אחרת null"
  }
}

חשוב: החזר רק JSON תקין, בלי שום טקסט נוסף.`;

  try {
    const response = await callAI(prompt, true); // flash for quick extraction
    const cleaned = response.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as ExtractedMetadata;
    return parsed;
  } catch (error) {
    console.error('AI extraction failed:', error);
    return {
      category: 'כללי',
      topic: text.substring(0, 50),
      tags: [],
      importance: 'medium',
      is_task: false,
      summary: text.substring(0, 100),
    };
  }
}

// === Natural Language Search ===

export async function answerQuestion(
  question: string,
  memories: Memory[]
): Promise<string> {
  if (memories.length === 0) {
    return answerGeneralQuestion(question);
  }

  const memoriesText = memories
    .map((m, i) => {
      const date = new Date(m.created_at).toLocaleDateString('he-IL');
      return `[${i + 1}] (${date}) [${m.category}/${m.topic}] ${m.content}`;
    })
    .join('\n\n');

  const prompt = `אתה "המוח השני" - עוזר אישי חכם ומתוחכם שמנהל את הזיכרון האישי של המשתמש.
אתה חושב לעומק, מחבר בין פרטים, ונותן תשובות חכמות ומדויקות.

השאלה: "${question}"

המידע שנמצא בזיכרון:
${memoriesText}

הנחיות:
- ענה בצורה ישירה, חכמה ומדויקת בעברית
- אם יש תשובה חד-משמעית, תן אותה ישירות
- חבר בין פרטים שונים אם רלוונטי - תן תובנות
- ציין תאריכים אם רלוונטי
- אם השאלה כללית (כמו "מי אתה?") - ענה על זה בנוסף למידע מהזיכרון
- היה תמציתי אבל מלא - אל תחזור על השאלה
- אם המידע לא רלוונטי לשאלה, התעלם ממנו וענה על השאלה ישירות`;

  try {
    return await callAI(prompt);
  } catch (error) {
    console.error('AI answer failed:', error);
    // Fallback: return memories as list
    let fallback = '📋 הנה מה שמצאתי בזיכרון:\n\n';
    memories.slice(0, 5).forEach((m, i) => {
      const date = new Date(m.created_at).toLocaleDateString('he-IL');
      fallback += `${i + 1}. [${date}] ${m.category}: ${m.content.substring(0, 100)}\n`;
    });
    return fallback;
  }
}

async function answerGeneralQuestion(question: string): Promise<string> {
  const prompt = `אתה "המוח השני" - בוט טלגרם חכם שמשמש כזיכרון אישי ועוזר חכם.
המשתמש שואל אותך שאלה, אבל אין עדיין מידע שמור בזיכרון שרלוונטי.

השאלה: "${question}"

ענה בעברית בצורה חכמה וידידותית:
- אם השאלה היא על מי אתה / מה אתה עושה - הסבר שאתה המוח השני, עוזר אישי שזוכר הכל
- אם השאלה היא שאלת ידע כללי - ענה עליה ממה שאתה יודע
- אם השאלה היא על מידע שאמור להיות שמור - ציין שלא נמצא מידע רלוונטי ותציע לשמור
- היה חכם, תמציתי וידידותי`;

  try {
    return await callAI(prompt);
  } catch (error) {
    console.error('General question AI failed:', error);
    return 'אני המוח השני 🧠 - העוזר האישי שלך!\nשלח לי מידע ואני אזכור הכל. שאל אותי שאלות ואני אחפש בזיכרון.\nנסה: /help למדריך מלא.';
  }
}

// === Smart Search Keywords ===

export async function extractSearchKeywords(question: string): Promise<string[]> {
  const prompt = `חלץ מילות מפתח לחיפוש מהשאלה הבאה. החזר JSON array בלבד.

שאלה: "${question}"

דוגמה:
שאלה: "מה הייתה המסקנה מהפגישה עם דוד?"
תשובה: ["פגישה", "דוד", "מסקנה"]

שאלה: "כמה עולה הריטלין?"
תשובה: ["ריטלין", "מחיר", "עלות"]

החזר רק JSON array, בלי שום טקסט נוסף.`;

  try {
    const response = await callAI(prompt, true); // flash for speed
    const cleaned = response.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback: simple keyword split
    return question
      .replace(/[?؟!.,،]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }
}

// === Detect Intent ===

export type MessageIntent = 'store' | 'question' | 'task_add' | 'task_list' | 'task_complete' | 'stats' | 'help';

export async function detectIntent(text: string): Promise<MessageIntent> {
  const lower = text.trim();

  // Quick pattern matching before calling AI
  if (/^[/]/.test(lower)) return 'help';
  if (/^(משימות|רשימת משימות|מה יש לעשות|tasks)/i.test(lower)) return 'task_list';
  if (/^(סיימתי|בוצע|done|✅)\s/i.test(lower)) return 'task_complete';
  if (/^(סטטיסטיק|סטטוס|סיכום|stats)/i.test(lower)) return 'stats';

  // Question patterns
  if (/^(מה|מי|איפה|מתי|למה|כמה|איך|האם|אילו|עבור מה|what|who|where|when|why|how|which)\s/i.test(lower)) return 'question';
  if (/\?$/.test(lower)) return 'question';

  // Task patterns
  if (/^(תזכיר|צריך ל|חייב ל|לא לשכוח|משימה:|todo:|remind)/i.test(lower)) return 'task_add';

  // Default: store as memory
  return 'store';
}
