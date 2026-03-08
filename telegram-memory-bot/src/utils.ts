// === Shared Utilities ===

/** Escape text for Telegram Markdown to prevent parse errors */
export function escapeMarkdown(text: string): string {
  return text.replace(/([*_`\[\]()~>#+\-=|{}.!\\])/g, '\\$1');
}

/** Escape LIKE special characters in SQL queries */
export function escapeLike(query: string): string {
  return query.replace(/[%_\\]/g, '\\$&');
}

export function formatPriority(p: string): string {
  switch (p) {
    case 'urgent': return '🔴 דחוף';
    case 'high': return '🟠 גבוה';
    case 'medium': return '🟡 בינוני';
    case 'low': return '🟢 נמוך';
    default: return p;
  }
}

export function formatPriorityEmoji(p: string): string {
  switch (p) {
    case 'urgent': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '📌';
  }
}

export function formatImportance(i: string): string {
  switch (i) {
    case 'critical': return '🔴 קריטי';
    case 'high': return '🟠 גבוה';
    case 'medium': return '🟡 בינוני';
    case 'low': return '🟢 נמוך';
    default: return i;
  }
}

export function formatInterval(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} דקות`;
  if (hours === 1) return 'שעה';
  if (hours < 24) return `${hours} שעות`;
  if (hours === 24) return 'יום';
  const days = Math.round(hours / 24);
  return `${days} ימים`;
}

/** Sanitize user input for AI prompts to prevent injection */
export function sanitizeForPrompt(text: string): string {
  // Replace sequences that could be interpreted as prompt instructions
  return text
    .replace(/```/g, '\'\'\'')
    .replace(/"""/g, '\'\'\'');
}

const VALID_IMPORTANCE = ['low', 'medium', 'high', 'critical'] as const;
const VALID_PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;

export function validateImportance(value: string): 'low' | 'medium' | 'high' | 'critical' {
  return (VALID_IMPORTANCE as readonly string[]).includes(value)
    ? value as 'low' | 'medium' | 'high' | 'critical'
    : 'medium';
}

export function validatePriority(value: string): 'low' | 'medium' | 'high' | 'urgent' {
  return (VALID_PRIORITY as readonly string[]).includes(value)
    ? value as 'low' | 'medium' | 'high' | 'urgent'
    : 'medium';
}
