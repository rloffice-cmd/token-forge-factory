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
} from 'lucide-react';

const navItems = [
  { icon: DollarSign, label: 'Money Machine', href: '/' },
  { icon: Brain, label: 'אינטליגנציה', href: '/intelligence' },
  { icon: LayoutDashboard, label: 'דשבורד', href: '/dashboard' },
  { icon: FileCode2, label: 'ג׳ובים', href: '/jobs' },
  { icon: Wallet, label: 'קופה', href: '/treasury' },
  { icon: Activity, label: 'מערכת', href: '/system' },
  { icon: Settings, label: 'הגדרות', href: '/settings' },
];

const adminItems = [
  { icon: Shield, label: 'אבטחה', href: '/admin/security' },
  { icon: Key, label: 'API Keys', href: '/admin/api-keys' },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-l border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Data-to-Token</h1>
            <p className="text-xs text-muted-foreground">Factory v0.1</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'nav-link group',
                isActive && 'active'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 opacity-50" />
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
                className={cn(
                  'nav-link group',
                  isActive && 'active'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <ChevronRight className="w-4 h-4 opacity-50" />
                )}
              </Link>
            );
          })}
        </div>
        
        {/* Quick link to landing page */}
        <a
          href="/landing"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link text-muted-foreground hover:text-foreground mt-4"
        >
          <ExternalLink className="w-5 h-5" />
          <span className="flex-1">דף נחיתה</span>
        </a>
      </nav>

      {/* Status indicator */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-medium">מערכת פעילה</p>
              <p className="text-xs text-muted-foreground">Production Mode</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
