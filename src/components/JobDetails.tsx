import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Play, RefreshCw, Download, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import type { Job, SkepticTest, JudgeResult } from '@/types';
import { mockSkepticTests, mockSolutionCode, mockJudgeResult, getTaskById } from '@/data/mockData';
import { cn } from '@/lib/utils';

interface JobDetailsProps {
  job: Job;
}

export function JobDetails({ job }: JobDetailsProps) {
  const task = getTaskById(job.task_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{job.id}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-muted-foreground">
            {task?.name || 'Unknown Task'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 ml-2" />
            הרץ מחדש
          </Button>
          <Button size="sm">
            <Play className="w-4 h-4 ml-2" />
            Run Factory
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="task" dir="rtl" className="w-full">
        <TabsList className="w-full justify-start bg-muted/30 p-1">
          <TabsTrigger value="task" className="tab-trigger">משימה</TabsTrigger>
          <TabsTrigger value="code" className="tab-trigger">קוד</TabsTrigger>
          <TabsTrigger value="skeptic" className="tab-trigger">טסטים</TabsTrigger>
          <TabsTrigger value="sandbox" className="tab-trigger">סנדבוקס</TabsTrigger>
          <TabsTrigger value="judge" className="tab-trigger">שיפוט</TabsTrigger>
          <TabsTrigger value="proof" className="tab-trigger">Proof Pack</TabsTrigger>
        </TabsList>

        <TabsContent value="task" className="mt-6">
          <TaskTab task={task} />
        </TabsContent>

        <TabsContent value="code" className="mt-6">
          <CodeTab code={mockSolutionCode} />
        </TabsContent>

        <TabsContent value="skeptic" className="mt-6">
          <SkepticTab tests={mockSkepticTests} />
        </TabsContent>

        <TabsContent value="sandbox" className="mt-6">
          <SandboxTab job={job} />
        </TabsContent>

        <TabsContent value="judge" className="mt-6">
          <JudgeTab result={mockJudgeResult} />
        </TabsContent>

        <TabsContent value="proof" className="mt-6">
          <ProofPackTab jobId={job.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TaskTab({ task }: { task?: import('@/types').Task }) {
  if (!task) return <p>לא נמצאה משימה</p>;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{task.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">פונקציה</h3>
          <code className="code-block block">
            {task.policy_json.function_name}({task.policy_json.input_type}) → {task.policy_json.output_type}
          </code>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">חוקים</h3>
          <ul className="space-y-2">
            {task.policy_json.rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                {rule}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">אסור</h3>
          <ul className="space-y-2">
            {task.policy_json.forbidden.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">טווח תאריכים</h3>
          <p className="text-sm font-mono">
            {task.policy_json.date_range.min} — {task.policy_json.date_range.max}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CodeTab({ code }: { code: string }) {
  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>solution.py</CardTitle>
        <Button variant="ghost" size="sm">
          <Download className="w-4 h-4 ml-2" />
          הורד
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="code-block text-sm overflow-x-auto max-h-[500px]">
          {code}
        </pre>
      </CardContent>
    </Card>
  );
}

function SkepticTab({ tests }: { tests: SkepticTest[] }) {
  const categories = [...new Set(tests.map(t => t.category))];

  return (
    <div className="space-y-6">
      {categories.map(category => {
        const categoryTests = tests.filter(t => t.category === category);
        const hasKillGate = categoryTests.some(t => t.is_kill_gate);
        
        return (
          <Card key={category} className={cn('glass-card', hasKillGate && 'border-destructive/50')}>
            <CardHeader className="flex flex-row items-center gap-3">
              <CardTitle className="font-mono text-base">{category}</CardTitle>
              {hasKillGate && (
                <span className="px-2 py-0.5 rounded bg-destructive/20 text-destructive text-xs font-medium">
                  KILL GATE
                </span>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryTests.map(test => (
                  <div key={test.id} className="p-4 rounded-lg bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">{test.id}</span>
                      {test.is_kill_gate && (
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                    <p className="text-sm">{test.description}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">קלט</p>
                        <code className="code-block text-xs block truncate">
                          {test.input.length > 50 ? test.input.slice(0, 50) + '...' : test.input}
                        </code>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">פלט צפוי</p>
                        <code className="code-block text-xs block">
                          {JSON.stringify(test.expected_output)}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SandboxTab({ job }: { job: Job }) {
  const isRunning = job.status === 'SANDBOX_RUNNING';

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>תוצאות סנדבוקס</CardTitle>
      </CardHeader>
      <CardContent>
        {isRunning ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-muted-foreground">מריץ בדיקות...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">זמן ריצה: 1.23s</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <span className="text-sm">12/12 טסטים עברו</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">stdout</h3>
              <pre className="code-block text-xs">
                Running skeptic tests...
                {'\n'}Test test-amb-001: PASS
                {'\n'}Test test-amb-002: PASS
                {'\n'}Test test-inv-001: PASS
                {'\n'}...
                {'\n'}All tests passed!
              </pre>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">stderr</h3>
              <pre className="code-block text-xs text-muted-foreground">
                (empty)
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JudgeTab({ result }: { result: JudgeResult }) {
  return (
    <div className="space-y-6">
      {/* Score overview */}
      <Card className={cn('glass-card', result.passed ? 'border-success/50' : 'border-destructive/50')}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">ציון כולל</p>
              <p className="text-4xl font-bold">{(result.score * 100).toFixed(0)}%</p>
            </div>
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center',
              result.passed ? 'bg-success/20' : 'bg-destructive/20'
            )}>
              {result.passed ? (
                <CheckCircle2 className="w-8 h-8 text-success" />
              ) : (
                <XCircle className="w-8 h-8 text-destructive" />
              )}
            </div>
          </div>

          {result.kill_gate_triggered && (
            <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">Kill Gate הופעל</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.kill_gate_reason}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category scores */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>ציונים לפי קטגוריה</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(result.category_scores).map(([category, score]) => (
              <div key={category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm">{category}</span>
                  <span className="text-sm">{(score * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      score === 1 ? 'bg-success' : score >= 0.8 ? 'bg-warning' : 'bg-destructive'
                    )}
                    style={{ width: `${score * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProofPackTab({ jobId }: { jobId: string }) {
  const files = [
    { name: 'solution.py', size: '1.2 KB' },
    { name: 'skeptic.json', size: '3.8 KB' },
    { name: 'pytest_report.json', size: '2.1 KB' },
    { name: 'judge.json', size: '0.9 KB' },
    { name: 'metadata.json', size: '0.4 KB' },
  ];

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Proof Pack</CardTitle>
        <Button size="sm">
          <Download className="w-4 h-4 ml-2" />
          הורד הכל
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.name}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-mono text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{file.size}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
