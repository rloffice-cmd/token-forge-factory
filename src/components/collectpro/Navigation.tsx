import React from "react";
import type { Tab } from "@/lib/collectpro/types";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// BatchBar
// ─────────────────────────────────────────────────────────────────────────────

export function BatchBar({
  count,
  onStatusUpdate,
  onPriceUpdate,
  onAIPriceRefresh,
  onPartnerReassign,
  onExport,
  onDelete,
  onClear,
}: {
  count: number;
  onStatusUpdate: () => void;
  onPriceUpdate: () => void;
  onAIPriceRefresh: () => void;
  onPartnerReassign: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div className="batch-bar fixed bottom-16 md:bottom-0 inset-x-0 z-30 flex items-center justify-between gap-2 px-4 py-3 bg-gray-900/95 backdrop-blur-xl border-t border-gray-700 shadow-2xl">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-white">{count} selected</span>
        <button onClick={onClear} className="text-xs text-gray-500 hover:text-white">✕ Clear</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={onStatusUpdate}>Status</Button>
        <Button size="sm" variant="outline" onClick={onPriceUpdate}>Price</Button>
        <Button size="sm" variant="outline" onClick={onAIPriceRefresh} title="Refresh market prices via AI web search">📊 AI Prices</Button>
        <Button size="sm" variant="outline" onClick={onPartnerReassign} title="Reassign to a different partner">Partner</Button>
        <Button size="sm" variant="outline" onClick={onExport}>Export</Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>Delete All</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BottomNav
// ─────────────────────────────────────────────────────────────────────────────

export function BottomNav({ tab, setTab, isAdmin }: { tab: Tab; setTab: (t: Tab) => void; isAdmin: boolean }) {
  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: "brain",     icon: "🧠", label: "Brain"    },
    { key: "inventory", icon: "📦", label: "Inv"      },
    { key: "roi",       icon: "📈", label: "ROI"      },
    { key: "arena",     icon: "⚔️", label: "Arena"    },
    { key: "market",    icon: "🌐", label: "Market"   },
    { key: "grade",     icon: "🔬", label: "Grade"    },
    { key: "partners",  icon: "🤝", label: "Partners" },
    ...(isAdmin ? [{ key: "admin" as Tab, icon: "🔐", label: "Admin" }] : []),
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex border-t border-gray-800 bg-gray-950/95 backdrop-blur-xl md:hidden bottom-nav-safe">
      {tabs.map(({ key, icon, label }) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
            tab === key ? "text-blue-400" : "text-gray-600 hover:text-gray-300"
          }`}
        >
          <span className="text-lg leading-none">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
