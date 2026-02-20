import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Loader2, Bot, Database, Zap, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ForensicHealth {
  status: string;
  forensicScore: number;
  services: {
    signalForgeAgent: { status: string; label: string };
    database: { status: string; label: string };
    inngest: { status: string; label: string; note?: string };
  };
  timestamp: string;
}

const ENDPOINT = 'https://42db220e-5803-46ef-b732-23785edabd76.replit.app/forensic-health';

function CircularGauge({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;

  const color =
    score >= 70 ? 'hsl(160 84% 39%)' : score >= 40 ? 'hsl(38 92% 50%)' : 'hsl(0 72% 51%)';

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
        {/* Track */}
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="hsl(217 33% 17%)"
          strokeWidth="10"
        />
        {/* Progress */}
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease',
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        />
      </svg>
      <div className="relative flex flex-col items-center">
        <span className="text-3xl font-bold font-mono" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-muted-foreground tracking-widest">/100</span>
      </div>
    </div>
  );
}

function ServiceIndicator({
  icon: Icon,
  label,
  status,
  glowColor,
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  status: string;
  glowColor: string;
  tooltip?: string;
}) {
  const isOk = status === 'ok' || status === 'healthy' || status === 'connected';
  const isWarn = status === 'warning' || status === 'warn' || status === 'degraded';

  const dotColor = isOk
    ? 'bg-success shadow-[0_0_8px_hsl(142_76%_36%)]'
    : isWarn
    ? 'bg-warning shadow-[0_0_8px_hsl(38_92%_50%)]'
    : 'bg-destructive shadow-[0_0_8px_hsl(0_72%_51%)]';

  const iconColor = isOk
    ? 'text-success'
    : isWarn
    ? 'text-warning'
    : 'text-destructive';

  const bgColor = isOk
    ? 'bg-success/10 border-success/20'
    : isWarn
    ? 'bg-warning/10 border-warning/20'
    : 'bg-destructive/10 border-destructive/20';

  const content = (
    <div className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg border', bgColor)}>
      <div className="relative flex-shrink-0">
        <Icon className={cn('w-4 h-4', iconColor)} />
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full',
            dotColor
          )}
        />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground capitalize">{status}</p>
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

export function ForensicHealthCard() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery<ForensicHealth>({
    queryKey: ['forensic-health'],
    queryFn: async () => {
      const res = await fetch(ENDPOINT);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  const score = data?.forensicScore ?? 0;
  const isOperational = score > 70;

  return (
    <Card className="glass-card border-border/60 relative overflow-hidden">
      {/* Subtle glow backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-64 h-64 -translate-y-1/2 translate-x-1/2 rounded-full opacity-10"
          style={{
            background:
              'radial-gradient(circle, hsl(160 84% 39% / 0.4), transparent 70%)',
          }}
        />
      </div>

      <CardHeader className="pb-3 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">System Status</CardTitle>
            {data && isOperational && (
              <Badge className="bg-success/20 text-success border border-success/30 text-[10px] px-2 py-0 h-5 font-mono tracking-widest">
                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                SYSTEM: OPERATIONAL
              </Badge>
            )}
            {data && !isOperational && (
              <Badge className="bg-warning/20 text-warning border border-warning/30 text-[10px] px-2 py-0 h-5 font-mono">
                DEGRADED
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
          </Button>
        </div>
        {dataUpdatedAt > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
          </p>
        )}
      </CardHeader>

      <CardContent className="relative">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <p className="text-sm text-destructive">Failed to reach Replit endpoint</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Gauge */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <CircularGauge score={score} />
              <p className="text-xs text-muted-foreground font-mono">Forensic Score</p>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px self-stretch bg-border/60" />
            <div className="sm:hidden w-full h-px bg-border/60" />

            {/* Service indicators */}
            <div className="flex-1 w-full space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3 font-mono">
                Service Health
              </p>
              <ServiceIndicator
                icon={Bot}
                label="signalForgeAgent"
                status={data?.services?.signalForgeAgent?.status ?? 'unknown'}
                glowColor="green"
              />
              <ServiceIndicator
                icon={Database}
                label="PostgreSQL"
                status={data?.services?.database?.status ?? 'unknown'}
                glowColor="blue"
              />
              <ServiceIndicator
                icon={Zap}
                label="Inngest"
                status={data?.services?.inngest?.status ?? 'unknown'}
                glowColor="amber"
                tooltip={
                  data?.services?.inngest?.note ??
                  'Missing Event Key – Restricted Autonomy'
                }
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
