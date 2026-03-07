import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExtractedMetadata, Memory } from './types';

let genAI: GoogleGenerativeAI;
let model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

export function initAI(): void {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
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
    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();
    // Clean potential markdown code block wrapping
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
    return 'לא מצאתי מידע רלוונטי בזיכרון. נסה לשאול בצורה אחרת או בדוק שהמידע נשמר.';
  }

  const memoriesText = memories
    .map((m, i) => {
      const date = new Date(m.created_at).toLocaleDateString('he-IL');
      return `[${i + 1}] (${date}) [${m.category}/${m.topic}] ${m.content}`;
    })
    .join('\n\n');

  const prompt = `אתה עוזר אישי חכם. המשתמש שואל שאלה על המידע ששמר בעבר.

השאלה: "${question}"

המידע שנמצא בזיכרון:
${memoriesText}

ענה על השאלה בצורה ישירה, ברורה ומדויקת בעברית.
- אם יש תשובה חד-משמעית, תן אותה ישירות
- אם יש כמה פריטים רלוונטיים, ציין את כולם
- ציין את התאריך של המידע אם רלוונטי
- אם המידע לא מספיק לתשובה מלאה, ציין מה חסר
- היה תמציתי - אל תחזור על השאלה`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('AI answer failed:', error);
    return 'מצטער, נתקלתי בבעיה בעיבוד השאלה. נסה שוב.';
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
    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();
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
