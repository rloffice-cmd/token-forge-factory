/**
 * Customer Portal Component
 * Shows credit balance, job creation, and history
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Coins, 
  Play, 
  History, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface CustomerPortalProps {
  customerEmail: string;
}

export function CustomerPortal({ customerEmail }: CustomerPortalProps) {
  const [taskInput, setTaskInput] = useState('');
  const queryClient = useQueryClient();

  // Get customer
  const { data: customer } = useQuery({
    queryKey: ['customer', customerEmail],
    queryFn: async () => {
      const { data } = await supabase
        .from('users_customers')
        .select('*')
        .eq('email', customerEmail)
        .single();
      return data;
    },
    enabled: !!customerEmail,
  });

  // Get credit balance
  const { data: wallet } = useQuery({
    queryKey: ['credit-wallet', customer?.id],
    queryFn: async () => {
      if (!customer?.id) return null;
      const { data } = await supabase
        .from('credit_wallets')
        .select('*')
        .eq('customer_id', customer.id)
        .single();
      return data;
    },
    enabled: !!customer?.id,
  });

  // Get customer jobs
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['customer-jobs', customer?.id],
    queryFn: async () => {
      if (!customer?.id) return [];
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!customer?.id,
  });

  // Create job mutation
  const createJob = useMutation({
    mutationFn: async (taskName: string) => {
      if (!customer?.id) throw new Error('לקוח לא נמצא');
      if (!wallet || wallet.credits_balance < 1) {
        throw new Error('אין מספיק קרדיטים');
      }

      // Create task first
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          name: taskName,
          policy_json: { source: 'customer_portal' },
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Create job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          task_id: task.id,
          customer_id: customer.id,
          cost_credits: 1,
          status: 'CREATED',
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Deduct credits
      await supabase
        .from('credit_wallets')
        .update({
          credits_balance: wallet.credits_balance - 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id);

      return job;
    },
    onSuccess: () => {
      toast.success('Job נוצר בהצלחה');
      setTaskInput('');
      queryClient.invalidateQueries({ queryKey: ['customer-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['credit-wallet'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'שגיאה ביצירת Job');
    },
  });

  const creditsBalance = wallet?.credits_balance || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-success"><CheckCircle2 className="w-3 h-3 mr-1" /> הושלם</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> נכשל</Badge>;
      case 'RUNNING':
        return <Badge className="bg-info"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> רץ</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> ממתין</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Credit Balance */}
      <Card className="glass-card glow-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Coins className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">יתרת קרדיטים</p>
                <p className="text-3xl font-bold text-primary">
                  {creditsBalance.toLocaleString()}
                </p>
              </div>
            </div>
            <Badge variant={creditsBalance > 0 ? 'default' : 'destructive'}>
              {creditsBalance > 0 ? 'פעיל' : 'אין קרדיטים'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Create Job */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            הרץ Job חדש
          </CardTitle>
          <CardDescription>
            כל Job צורך קרדיט אחד
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>תיאור המשימה</Label>
            <Textarea
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="תאר את המשימה שברצונך לבצע..."
              rows={3}
            />
          </div>
          <Button
            onClick={() => createJob.mutate(taskInput)}
            disabled={!taskInput.trim() || creditsBalance < 1 || createJob.isPending}
            className="w-full gap-2"
          >
            {createJob.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                יוצר Job...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                הרץ (1 קרדיט)
              </>
            )}
          </Button>
          {creditsBalance < 1 && (
            <p className="text-sm text-destructive text-center">
              אין מספיק קרדיטים. רכוש חבילה להמשך.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Job History */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            היסטוריית Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div>
                    <p className="font-mono text-sm">{job.id.substring(0, 8)}...</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleDateString('he-IL', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {job.score && (
                      <span className="text-sm font-medium">
                        {(job.score * 100).toFixed(0)}%
                      </span>
                    )}
                    {getStatusBadge(job.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              אין Jobs עדיין
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
