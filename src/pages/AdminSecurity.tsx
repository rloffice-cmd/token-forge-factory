import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Shield, Plus, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DenylistEntry {
  id: string;
  type: string;
  value: string;
  reason: string | null;
  active: boolean;
  created_at: string;
}

interface SecurityAlert {
  id: string;
  event_type: string;
  message: string;
  created_at: string;
  metadata: any;
}

export default function AdminSecurity() {
  const { toast } = useToast();
  const [denylist, setDenylist] = useState<DenylistEntry[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New entry form
  const [newType, setNewType] = useState<string>('wallet');
  const [newValue, setNewValue] = useState('');
  const [newReason, setNewReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load denylist
      const { data: denylistData } = await supabase
        .from('denylist')
        .select('*')
        .order('created_at', { ascending: false });

      setDenylist(denylistData || []);

      // Load recent security alerts
      const { data: alertsData } = await supabase
        .from('notifications')
        .select('id, event_type, message, created_at, metadata')
        .eq('event_type', 'security_alert')
        .order('created_at', { ascending: false })
        .limit(50);

      setAlerts(alertsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToList = async () => {
    if (!newValue.trim()) {
      toast({
        title: 'Error',
        description: 'ערך הינו שדה חובה',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('denylist')
      .insert({
        type: newType,
        value: newValue.trim(),
        reason: newReason.trim() || null,
        active: true,
      });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Added',
        description: `${newType} added to denylist`,
      });
      setDialogOpen(false);
      setNewValue('');
      setNewReason('');
      loadData();
    }
  };

  const toggleEntry = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('denylist')
      .update({ active: !currentActive })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      loadData();
    }
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase
      .from('denylist')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Deleted',
        description: 'Entry removed from denylist',
      });
      loadData();
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">אבטחה</h1>
          </div>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Denylist Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>רשימת חסימה</CardTitle>
                <CardDescription>חסימת ארנקים, IPs, או מפתחות API</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>הוסף לרשימת החסימה</DialogTitle>
                    <DialogDescription>
                      Block a wallet address, IP, or API key
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Type</label>
                      <Select value={newType} onValueChange={setNewType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wallet">כתובת ארנק</SelectItem>
                          <SelectItem value="ip">כתובת IP</SelectItem>
                          <SelectItem value="api_key">מזהה מפתח API</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">ערך</label>
                      <Input
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder={newType === 'wallet' ? '0x...' : newType === 'ip' ? '192.168.1.1' : 'uuid'}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">סיבה (אופציונלי)</label>
                      <Input
                        value={newReason}
                        onChange={(e) => setNewReason(e.target.value)}
                        placeholder="למה זה חסום?"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={addToList}>הוסף לרשימת החסימה</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {denylist.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No entries in denylist
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>ערך</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {denylist.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant="outline">{entry.type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate">
                        {entry.value}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.reason || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.active ? 'destructive' : 'secondary'}>
                          {entry.active ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(entry.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleEntry(entry.id, entry.active)}
                          >
                            {entry.active ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteEntry(entry.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Security Alerts Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Recent Security Alerts
            </CardTitle>
            <CardDescription>
              Last 50 security events
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                ✅ No security alerts
              </p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 border rounded-lg bg-yellow-50/50 dark:bg-yellow-900/10"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{alert.message}</p>
                        {alert.metadata && (
                          <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">
                            {JSON.stringify(alert.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(alert.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
