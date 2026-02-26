import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileCode2,
  Wallet,
  Settings,
  Zap,
  ChevronRight,
  ShoppingCart,
  Activity,
  DollarSign,
  ExternalLink,
  Shield,
  Key,
  Brain,
  Compass,
  Rss,
  Radio,
  BarChart2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppSidebarProps {
  onClose?: () => void;
}

const navItems = [
  { icon: Zap, label: 'Token Forge', href: '/forge/money-machine' },
  { icon: Radio, label: 'M2M PPL Engine', href: '/forge/m2m-dashboard' },
  { icon: DollarSign, label: 'Money Machine', href: '/' },
  { icon: Brain, label: 'Brain Dashboard', href: '/brain' },
  { icon: Rss, label: 'מקורות', href: '/sources' },
  { icon: Wallet, label: 'קופה', href: '/treasury' },
  { icon: Activity, label: 'מערכת', href: '/system' },
  { icon: Settings, label: 'הגדרות', href: '/settings' },
];

const adminItems = [
  { icon: Shield, label: 'אבטחה', href: '/admin/security' },
  { icon: Key, label: 'API Keys', href: '/admin/api-keys' },
  { icon: FileCode2, label: 'דוח אבחון', href: '/admin/diagnostic-report' },
];

export function AppSidebar({ onClose }: AppSidebarProps) {
  const location = useLocation();

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-l border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-4 lg:p-6 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Data-to-Token</h1>
              <p className="text-xs text-muted-foreground">Factory v0.1</p>
            </div>
          </div>
          {/* Close button - mobile only */}
          {onClose && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 lg:p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={handleNavClick}
              className={cn(
                'nav-link group',
                isActive && 'active'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
              )}
            </Link>
          );
        })}
        
        {/* Admin Section */}
        <div className="pt-4 mt-4 border-t border-sidebar-border">
          <p className="px-3 text-xs font-semibold text-muted-foreground mb-2">ADMIN</p>
          {adminItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={handleNavClick}
                className={cn(
                  'nav-link group',
                  isActive && 'active'
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {isActive && (
                  <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
        
        {/* RMINT – External Link */}
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link text-muted-foreground hover:text-foreground mt-4"
          onClick={handleNavClick}
        >
          <BarChart2 className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1 truncate">RMINT</span>
          <ExternalLink className="w-3 h-3 opacity-50 flex-shrink-0" />
        </a>

        {/* Quick link to landing page */}
        <a
          href="/landing"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link text-muted-foreground hover:text-foreground"
          onClick={handleNavClick}
        >
          <ExternalLink className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1 truncate">דף נחיתה</span>
        </a>
      </nav>

      {/* Status indicator */}
      <div className="p-3 lg:p-4 border-t border-sidebar-border">
        <div className="glass-card p-3 lg:p-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">מערכת פעילה</p>
              <p className="text-xs text-muted-foreground">Production Mode</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
