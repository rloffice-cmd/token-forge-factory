import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  const variantStyles = {
    default: 'from-primary/10 to-transparent',
    success: 'from-success/10 to-transparent',
    warning: 'from-warning/10 to-transparent',
    danger: 'from-destructive/10 to-transparent',
  };

  const iconStyles = {
    default: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    danger: 'text-destructive bg-destructive/10',
  };

  return (
    <div
      className={cn(
        'stat-card relative overflow-hidden p-4 lg:p-6',
        'bg-gradient-to-bl',
        variantStyles[variant],
        className
      )}
    >
      {/* Glow effect */}
      <div className="absolute top-0 left-0 w-24 lg:w-32 h-24 lg:h-32 -translate-x-1/2 -translate-y-1/2 bg-gradient-radial from-primary/20 to-transparent blur-2xl opacity-50" />
      
      <div className="relative flex items-start justify-between gap-2">
        <div className="space-y-1 lg:space-y-2 min-w-0 flex-1">
          <p className="text-xs lg:text-sm text-muted-foreground truncate">{title}</p>
          <p className="text-xl lg:text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-[10px] lg:text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                'text-[10px] lg:text-xs font-medium',
                trend.isPositive ? 'text-success' : 'text-destructive'
              )}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        
        <div className={cn('p-2 lg:p-3 rounded-lg lg:rounded-xl flex-shrink-0', iconStyles[variant])}>
          <Icon className="w-4 h-4 lg:w-6 lg:h-6" />
        </div>
      </div>
    </div>
  );
}
