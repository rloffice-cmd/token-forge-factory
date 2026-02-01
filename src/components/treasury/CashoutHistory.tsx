/**
 * Cashout History Component
 * Shows withdrawal request history with status
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, History, Clock, CheckCircle2, XCircle, Send, FileSignature } from 'lucide-react';
import { useCashoutRequests } from '@/hooks/useTreasury';
import { getEtherscanUrl, formatAddress } from '@/lib/web3';
import { Skeleton } from '@/components/ui/skeleton';


const statusConfig: Record<string, { 
  label: string; 
  icon: React.ReactNode; 
  className: string;
}> = {
  pending: { 
    label: 'ממתין', 
    icon: <Clock className="w-3 h-3" />,
    className: 'bg-muted text-muted-foreground',
  },
  signed: { 
    label: 'נחתם', 
    icon: <FileSignature className="w-3 h-3" />,
    className: 'bg-info/20 text-info border-info/30',
  },
  submitted: { 
    label: 'נשלח', 
    icon: <Send className="w-3 h-3" />,
    className: 'bg-warning/20 text-warning border-warning/30',
  },
  confirmed: { 
    label: 'אושר', 
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: 'bg-success/20 text-success border-success/30',
  },
  failed: { 
    label: 'נכשל', 
    icon: <XCircle className="w-3 h-3" />,
    className: 'bg-destructive/20 text-destructive border-destructive/30',
  },
  cancelled: { 
    label: 'בוטל', 
    icon: <XCircle className="w-3 h-3" />,
    className: 'bg-muted text-muted-foreground',
  },
};

const defaultStatus = {
  label: 'לא ידוע',
  icon: <Clock className="w-3 h-3" />,
  className: 'bg-muted text-muted-foreground',
};

export function CashoutHistory() {
  const { data: requests, isLoading } = useCashoutRequests();
  
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>היסטוריית משיכות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!requests || requests.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            היסטוריית משיכות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            אין בקשות משיכה עדיין
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          היסטוריית משיכות
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.map((request) => {
            const status = statusConfig[request.status] || defaultStatus;
            
            return (
              <div
                key={request.id}
                className="p-4 rounded-lg bg-muted/30 space-y-3"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <Badge className={`gap-1 ${status.className}`}>
                    {status.icon}
                    {status.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(request.created_at).toLocaleDateString('he-IL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                
                {/* Amount Row */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg">
                      {request.amount_dtf.toFixed(2)} DTF
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ≈ ${request.amount_usd.toFixed(2)} USD / {request.amount_eth?.toFixed(6) || '?'} ETH
                    </p>
                  </div>
                  
                  {/* TX Hash Link */}
                  {request.tx_hash && (
                    <a
                      href={getEtherscanUrl(request.tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-mono text-sm"
                    >
                      {formatAddress(request.tx_hash)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                
                {/* Destination */}
                <div className="text-xs text-muted-foreground font-mono">
                  → {formatAddress(request.wallet_address)}
                </div>
                
                {/* Error Message */}
                {request.error_message && (
                  <p className="text-sm text-destructive">
                    {request.error_message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
