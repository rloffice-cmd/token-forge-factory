/**
 * Telegram Notification Utilities
 * Client-side utilities for building notification messages
 * Actual sending is done via Edge Functions with proper secrets
 */

/**
 * Mask wallet address for privacy
 */
function maskWallet(addr: string): string {
  if (!addr || addr.length < 10) return addr || '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Build cashout alert message
 */
export function buildCashoutAlert(params: {
  totalDTF: number;
  thresholdDTF: number;
  network: string;
  wallet: string;
}): string {
  return [
    `💰 <b>Cashout Alert</b>`,
    ``,
    `סך הכל: <b>${params.totalDTF.toFixed(2)} DTF</b>`,
    `סף: <b>${params.thresholdDTF.toFixed(2)} DTF</b>`,
    `רשת: <b>${params.network}</b>`,
    `ארנק: <b>${maskWallet(params.wallet)}</b>`,
    ``,
    `🔒 כרגע: <b>מימוש ידני</b> (בטוח).`,
    `אם תרצה אוטומציה מלאה בהמשך — נוסיף חתימות + Kill Switch.`,
  ].join('\n');
}

/**
 * Build daily report message
 */
export function buildDailyReportMessage(params: {
  jobsToday: number;
  passRate: number;
  tokensEarned: number;
  failedCount: number;
  topFailures?: Array<{ category: string; count: number }>;
}): string {
  const lines = [
    `📊 <b>דוח יומי - Factory Pipeline</b>`,
    ``,
    `📦 ג'ובים היום: <b>${params.jobsToday}</b>`,
    `✅ אחוז הצלחה: <b>${params.passRate}%</b>`,
    `💰 טוקנים שנצברו: <b>${params.tokensEarned.toFixed(2)} DTF</b>`,
    `❌ נפילות: <b>${params.failedCount}</b>`,
  ];
  
  if (params.topFailures && params.topFailures.length > 0) {
    lines.push(``);
    lines.push(`🔍 <b>סוגי כשלונות נפוצים:</b>`);
    params.topFailures.slice(0, 3).forEach((f, i) => {
      lines.push(`  ${i + 1}. ${f.category}: ${f.count}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Build job completion notification
 */
export function buildJobNotification(params: {
  jobId: string;
  status: string;
  score?: number | null;
  reward?: number;
}): string {
  const emoji = params.status === 'SETTLED' ? '✅' : 
                params.status === 'DROPPED' ? '🚨' : 
                params.status === 'FAILED' ? '❌' : '📦';
  
  const lines = [
    `${emoji} <b>Job ${params.status}</b>`,
    `ID: <code>${params.jobId.slice(0, 8)}</code>`,
  ];
  
  if (params.score !== undefined && params.score !== null) {
    lines.push(`ציון: ${(params.score * 100).toFixed(0)}%`);
  }
  
  if (params.reward !== undefined && params.reward > 0) {
    lines.push(`תגמול: +${params.reward.toFixed(2)} DTF`);
  }
  
  return lines.join('\n');
}
