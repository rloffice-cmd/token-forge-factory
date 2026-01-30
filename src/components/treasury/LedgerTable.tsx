/**
 * Treasury Ledger Table
 * Shows IN/OUT transactions with TX hashes
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ArrowDownLeft, ArrowUpRight, List } from 'lucide-react';
import { useTreasuryLedger } from '@/hooks/useTreasury';
import { getEtherscanUrl, formatAddress } from '@/lib/web3';
import { Skeleton } from '@/components/ui/skeleton';

export function LedgerTable() {
  const { data: entries, isLoading } = useTreasuryLedger();
  
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>היסטוריית טרנזקציות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!entries || entries.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="w-5 h-5" />
            היסטוריית טרנזקציות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            אין טרנזקציות עדיין
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <List className="w-5 h-5" />
          היסטוריית טרנזקציות
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">סוג</TableHead>
              <TableHead className="text-right">סכום</TableHead>
              <TableHead className="text-right">Job ID</TableHead>
              <TableHead className="text-right">TX Hash</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-right">
                  {new Date(entry.created_at).toLocaleDateString('he-IL', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <Badge 
                    variant={entry.direction === 'IN' ? 'default' : 'secondary'}
                    className={`gap-1 ${
                      entry.direction === 'IN' 
                        ? 'bg-success/20 text-success border-success/30' 
                        : 'bg-warning/20 text-warning border-warning/30'
                    }`}
                  >
                    {entry.direction === 'IN' ? (
                      <ArrowDownLeft className="w-3 h-3" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3" />
                    )}
                    {entry.direction === 'IN' ? 'נכנס' : 'יוצא'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  <span className={entry.direction === 'IN' ? 'text-success' : 'text-warning'}>
                    {entry.direction === 'IN' ? '+' : '-'}{entry.amount.toFixed(2)} {entry.asset}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-xs text-muted-foreground">
                    {entry.job_id ? formatAddress(entry.job_id) : '-'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {entry.tx_hash ? (
                    <a
                      href={getEtherscanUrl(entry.tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-mono text-xs"
                    >
                      {formatAddress(entry.tx_hash)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
