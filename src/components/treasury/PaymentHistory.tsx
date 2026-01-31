/**
 * Payment History Table
 * Shows all confirmed payments with on-chain links
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Receipt } from 'lucide-react';
import { useConfirmedPayments } from '@/hooks/useRevenueData';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

export function PaymentHistory() {
  const { data: payments, isLoading, error } = useConfirmedPayments();
  
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            היסטוריית תשלומים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="glass-card border-destructive/30">
        <CardContent className="pt-6">
          <p className="text-destructive">שגיאה בטעינת היסטוריית תשלומים</p>
        </CardContent>
      </Card>
    );
  }
  
  if (!payments || payments.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            היסטוריית תשלומים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>אין תשלומים מאושרים עדיין</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          היסטוריית תשלומים
          <Badge variant="secondary" className="mr-2">
            {payments.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">תאריך</TableHead>
                <TableHead className="text-right">סכום USD</TableHead>
                <TableHead className="text-right">סכום קריפטו</TableHead>
                <TableHead className="text-right">קרדיטים</TableHead>
                <TableHead className="text-right">לקוח</TableHead>
                <TableHead className="text-right">עסקה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-mono text-sm">
                    {format(new Date(payment.confirmed_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                  </TableCell>
                  <TableCell className="font-bold text-primary">
                    ${payment.amount_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    {payment.amount_eth 
                      ? `${payment.amount_eth.toFixed(6)} ${payment.currency || 'ETH'}`
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      +{payment.credits_purchased}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {payment.customer_email 
                      ? payment.customer_email.substring(0, 20) + (payment.customer_email.length > 20 ? '...' : '')
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    {payment.tx_hash ? (
                      <a
                        href={`https://etherscan.io/tx/${payment.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <span className="font-mono text-xs">
                          {payment.tx_hash.substring(0, 8)}...
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
