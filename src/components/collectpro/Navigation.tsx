import React from "react";
import type { Tab } from "@/lib/collectpro/types";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// BatchBar — סרגל פעולות מרובות
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
                                      <div dir="rtl" className="batch-bar fixed bottom-16 md:bottom-0 inset-x-0 z-30 flex items-center justify-between gap-2 px-4 py-3 bg-gray-900/95 backdrop-blur-xl border-t border-gray-700 shadow-2xl">
                                            <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-white">{count} נבחרו</span>
                                                            <button onClick={onClear} className="text-xs text-gray-500 hover:text-white">✕ נקה</button>
                                                                  </div>
                                                                        <div className="flex gap-2 flex-wrap">
                                                                                <Button size="sm" variant="outline" onClick={onStatusUpdate}>סטטוס</Button>
                                                                                        <Button size="sm" variant="outline" onClick={onPriceUpdate}>מחיר</Button>
                                                                                                <Button size="sm" variant="outline" onClick={onAIPriceRefresh} title="רענון מחירי שוק באמצעות AI">📊 מחירי AI</Button>
                                                                                                        <Button size="sm" variant="outline" onClick={onPartnerReassign} title="שיוך מחדש לשותף אחר">שותף</Button>
                                                                                                                <Button size="sm" variant="outline" onClick={onExport}>ייצוא</Button>
                                                                                                                        <Button size="sm" variant="destructive" onClick={onDelete}>מחק הכל</Button>
                                                                                                                              </div>
                                                                                                                                  </div>
                                                                                                                                    );
                                                                                                                                    }

                                                                                                                                    // ─────────────────────────────────────────────────────────────────────────────
                                                                                                                                    // BottomNav — ניווט תחתון לנייד
                                                                                                                                    // ─────────────────────────────────────────────────────────────────────────────

                                                                                                                                    export function BottomNav({ tab, setTab, isAdmin }: { tab: Tab; setTab: (t: Tab) => void; isAdmin: boolean }) {
                                                                                                                                      const tabs: { key: Tab; icon: string; label: string }[] = [
                                                                                                                                          { key: "brain", icon: "🧠", label: "מוח" },
                                                                                                                                              { key: "inventory", icon: "📦", label: "מלאי" },
                                                                                                                                                  { key: "roi", icon: "📈", label: "תשואה" },
                                                                                                                                                      { key: "arena", icon: "⚔️", label: "זירה" },
                                                                                                                                                          { key: "market", icon: "🌐", label: "שוק" },
                                                                                                                                                              { key: "grade", icon: "🔬", label: "דירוג" },
                                                                                                                                                                  { key: "partners", icon: "🤝", label: "שותפים" },
                                                                                                                                                                      ...(isAdmin ? [{ key: "admin" as Tab, icon: "🔐", label: "ניהול" }] : []),
                                                                                                                                                                        ];
                                                                                                                                                                          return (
                                                                                                                                                                              <nav dir="rtl" className="fixed bottom-0 inset-x-0 z-40 flex border-t border-gray-800 bg-gray-950/95 backdrop-blur-xl md:hidden bottom-nav-safe">
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