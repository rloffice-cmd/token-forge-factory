import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Key, RefreshCw, Ban } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiKeyWithCustomer {
  id: string;
  key_prefix: string;
  status: string;
  rate_limit_tier: string;
  created_at: string;
  last_used_at: string | null;
  label: string | null;
  users_customers: {
    email: string;
    name: string | null;
  } | null;
}

export default function AdminApiKeys() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeyWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; keyId: string | null }>({
    open: false,
    keyId: null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select(`
          id,
          key_prefix,
          status,
          rate_limit_tier,
          created_at,
          last_used_at,
          label,
          users_customers (
            email,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast({
        title: 'Error',
        description: 'טעינת מפתחות API נכשלה',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async () => {
    if (!revokeDialog.keyId) return;

    const { error } = await supabase
      .from('api_keys')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_reason: 'בוטל ע"י מנהל',
      })
      .eq('id', revokeDialog.keyId);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Revoked',
        description: 'מפתח ה-API בוטל',
      });
      setRevokeDialog({ open: false, keyId: null });
      loadData();
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeCount = apiKeys.filter((k) => k.status === 'active').length;
  const revokedCount = apiKeys.filter((k) => k.status === 'revoked').length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">מפתחות API</h1>
          </div>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{apiKeys.length}</p>
                <p className="text-sm text-muted-foreground">סה״כ מפתחות</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-destructive">{revokedCount}</p>
                <p className="text-sm text-muted-foreground">Revoked</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Keys Table */}
        <Card>
          <CardHeader>
            <CardTitle>כל מפתחות ה-API</CardTitle>
            <CardDescription>ניהול מפתחות API של לקוחות</CardDescription>
          </CardHeader>
          <CardContent>
            {apiKeys.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No API keys issued yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>לקוח</TableHead>
                    <TableHead>רמה</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>נוצר</TableHead>
                    <TableHead>שימוש אחרון</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-mono text-sm">
                        {key.key_prefix}...
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {key.users_customers?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {key.users_customers?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{key.rate_limit_tier}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={key.status === 'active' ? 'default' : 'destructive'}
                        >
                          {key.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(key.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(key.last_used_at)}
                      </TableCell>
                      <TableCell>
                        {key.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRevokeDialog({ open: true, keyId: key.id })}
                          >
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Revoke Confirmation Dialog */}
        <Dialog
          open={revokeDialog.open}
          onOpenChange={(open) => setRevokeDialog({ open, keyId: null })}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>לבטל מפתח API?</DialogTitle>
              <DialogDescription>
                This will immediately block all API requests using this key.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRevokeDialog({ open: false, keyId: null })}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={revokeKey}>
                Revoke Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
