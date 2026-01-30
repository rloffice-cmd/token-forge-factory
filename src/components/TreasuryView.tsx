import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import type { TreasuryEntry } from '@/types';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TreasuryViewProps {
  entries: TreasuryEntry[];
}

export function TreasuryView({ entries }: TreasuryViewProps) {
  const [copied, setCopied] = useState(false);
  
  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const walletAddress = '0x1234...5678'; // Mock watch-only address

  const handleCopy = () => {
    navigator.clipboard.writeText('0x1234567890abcdef1234567890abcdef12345678');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Total balance card */}
      <Card className="glass-card glow-border">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">יתרה כוללת</p>
              <p className="text-4xl font-bold text-primary">
                {totalAmount.toFixed(2)} <span className="text-lg">DTF</span>
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">{walletAddress}</span>
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <Button className="w-full sm:w-auto">
              <ExternalLink className="w-4 h-4 ml-2" />
              למימוש ב-CEX
            </Button>
            <p className="text-xs text-muted-foreground">
              * מצב MOCK - אין העברה אמיתית
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Transaction history */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>היסטוריית תגמולים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold text-sm">+</span>
                  </div>
                  <div>
                    <p className="font-mono text-sm">{entry.job_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleDateString('he-IL', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-bold text-primary">+{entry.amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{entry.asset}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="glass-card border-info/30">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 shrink-0 rounded-full bg-info/20 flex items-center justify-center">
              <span className="text-info text-lg">ℹ</span>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">מצב Watch-Only</h3>
              <p className="text-sm text-muted-foreground">
                הקופה פועלת במצב Watch-Only בלבד. אין מפתחות פרטיים (Private Keys) 
                בשרת. כדי לממש את הטוקנים, יש להעביר אותם לכתובת CEX שלך באופן ידני.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
