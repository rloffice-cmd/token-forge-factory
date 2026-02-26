"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Package,
  Star,
  Briefcase,
  CheckSquare,
  BarChart3,
  Settings,
  Send,
  Paperclip,
  User,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const NAV_ITEMS: readonly { label: string; icon: typeof LayoutDashboard; active?: boolean }[] = [
  { label: "Command Center", icon: LayoutDashboard, active: true },
  { label: "מלאי", icon: Package },
  { label: "הערכות", icon: Star },
  { label: "פורטפוליו", icon: Briefcase },
  { label: "משימות", icon: CheckSquare },
  { label: "דוחות", icon: BarChart3 },
  { label: "הגדרות", icon: Settings },
];

const QUICK_ACTIONS = [
  { emoji: "📦", label: "הוסף פריט חדש", command: "הוסף פריט חדש למלאי" },
  { emoji: "🔍", label: "הערכה 7.4", command: "הפעל הערכה אוטומטית 7.4" },
  { emoji: "🚚", label: "לוגיסטיקה", command: "פתח מעקב לוגיסטיקה" },
  { emoji: "📊", label: "דוחות", command: "הצג דוח פורטפוליו שבועי" },
  { emoji: "✅", label: "משימות", command: "הצג משימות פתוחות" },
] as const;

const MOCK_RESPONSES: Record<string, string> = {
  "הוסף פריט חדש למלאי":
    "מוכן להוסיף פריט חדש. אנא ציין את שם הקלף, הסט, המצב (grading), והמחיר הרצוי.",
  "הפעל הערכה אוטומטית 7.4":
    "מפעיל מנוע הערכה 7.4... סורק 3 מקורות מחירים. הערכה תהיה מוכנה תוך מספר שניות.",
  "פתח מעקב לוגיסטיקה":
    "מערכת לוגיסטיקה פעילה. אין משלוחים ממתינים כרגע. רוצה ליצור משלוח חדש?",
  "הצג דוח פורטפוליו שבועי":
    "דוח שבועי: 0 פריטים בפורטפוליו. אין פעילות השבוע. המערכת מוכנה לקליטת פריטים חדשים.",
  "הצג משימות פתוחות":
    "אין משימות פתוחות כרגע. רוצה ליצור משימה חדשה?",
};

const DEFAULT_RESPONSE =
  "קיבלתי את הפקודה. אני מעבד את הבקשה שלך. האם תרצה פרטים נוספים?";

function formatTime(date: Date) {
  return date.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime() {
  return new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-6 animate-[fade-in_0.2s_ease-out]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
        R
      </div>
      <div className="rounded-2xl rounded-tr-sm bg-surface-hover px-4 py-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block h-2 w-2 rounded-full bg-muted"
              style={{
                animation: `typing-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 space-y-2.5">
      <div className="h-3 w-3/4 rounded bg-border animate-pulse" />
      <div className="h-2.5 w-1/2 rounded bg-border/60 animate-pulse" />
      <div className="h-2 w-1/3 rounded bg-border/40 animate-pulse" />
    </div>
  );
}

export default function CommandCenter() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [dateTime, setDateTime] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tick = () => setDateTime(formatDateTime());
    const frame = requestAnimationFrame(tick);
    const interval = setInterval(tick, 30_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      setTimeout(() => {
        const response = MOCK_RESPONSES[trimmed] || DEFAULT_RESPONSE;
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
      }, 1200);
    },
    [isTyping],
  );

  const handleQuickAction = (command: string) => {
    setInput(command);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* ── TOP HEADER BAR ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white shadow-[0_0_12px_rgba(59,130,246,0.35)]">
            R
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-wide text-white">
              RMINT
            </span>
            <span className="text-[11px] text-muted">מערכת ניהול קרן</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-xs text-muted">מחובר</span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-muted transition-colors hover:text-foreground">
            <User size={16} />
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground">
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* ── MAIN AREA ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="flex w-[260px] shrink-0 flex-col border-l border-border bg-surface">
          <div className="px-5 pt-5 pb-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">
              ניווט מהיר
            </span>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                    item.active
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <Icon
                    size={18}
                    className={cn(
                      "shrink-0",
                      item.active
                        ? "text-accent"
                        : "text-muted group-hover:text-foreground",
                    )}
                  />
                  <span>{item.label}</span>
                  {item.active && (
                    <span className="mr-auto h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
                  )}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-border px-5 py-4">
            <p className="text-[11px] text-muted">גרסה 0.1.0 • Preview</p>
          </div>
        </aside>

        {/* ── CENTER – CHAT ── */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex flex-1 flex-col overflow-y-auto py-6">
            {messages.length === 0 && !isTyping ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10 text-3xl font-bold text-accent shadow-[0_0_40px_rgba(59,130,246,0.15)]">
                  R
                </div>
                <h2 className="text-2xl font-semibold text-white">
                  שלום, איתי
                </h2>
                <p className="text-muted">במה אוכל לעזור היום?</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {QUICK_ACTIONS.slice(0, 3).map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.command)}
                      className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted transition-all hover:border-accent/40 hover:bg-surface-hover hover:text-foreground"
                    >
                      <span>{action.emoji}</span>
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 px-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex animate-[fade-in_0.25s_ease-out]",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                        R
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[520px] rounded-2xl px-4 py-3",
                        msg.role === "user"
                          ? "rounded-tl-sm bg-accent text-white"
                          : "rounded-tr-sm bg-surface-hover text-foreground",
                      )}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      <p
                        className={cn(
                          "mt-1.5 text-[10px]",
                          msg.role === "user"
                            ? "text-white/50"
                            : "text-muted",
                        )}
                      >
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-active text-xs text-muted">
                        <User size={14} />
                      </div>
                    )}
                  </div>
                ))}
                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border bg-surface px-6 py-4">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-2 transition-colors focus-within:border-accent/50"
            >
              <button
                type="button"
                className="shrink-0 text-muted transition-colors hover:text-foreground"
              >
                <Paperclip size={18} />
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="הקלד פקודה או שאלה..."
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/60"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
                  input.trim() && !isTyping
                    ? "bg-accent text-white hover:bg-accent-hover shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                    : "text-muted/30",
                )}
              >
                <Send size={16} className="rotate-180" />
              </button>
            </form>
          </div>
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside className="flex w-[300px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface px-5 py-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
            פאנל הקשר
          </h3>

          {/* Quick Actions */}
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-muted/80">
              פעולות מהירות
            </span>
            <div className="flex flex-col gap-1.5">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.command)}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-all hover:border-accent/30 hover:bg-surface-hover"
                >
                  <span className="text-base">{action.emoji}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Portfolio Snapshot */}
          <div className="space-y-3">
            <span className="text-[11px] font-medium text-muted/80">
              פורטפוליו פרטי
            </span>
            <div className="rounded-xl border border-border bg-background p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">השקעה</span>
                <span className="text-sm font-semibold text-foreground">
                  ₪0
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">רווח / הפסד</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground">
                    ₪0
                  </span>
                  <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-muted">
                    0%
                  </span>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">פריטים</span>
                <span className="text-sm font-semibold text-foreground">0</span>
              </div>
            </div>
          </div>

          {/* Recent Items */}
          <div className="space-y-3">
            <span className="text-[11px] font-medium text-muted/80">
              פריטים אחרונים
            </span>
            <div className="flex flex-col gap-2">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        </aside>
      </div>

      {/* ── BOTTOM STATUS BAR ── */}
      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-surface px-5 text-[11px] text-muted">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-[pulse-dot_2s_ease-in-out_infinite]" />
            <span>Agent 7.4 מוכן</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-[pulse-dot_2s_ease-in-out_infinite_0.5s]" />
            <span>Supabase מחובר</span>
          </div>
        </div>
        <span>{dateTime}</span>
      </footer>
    </div>
  );
}
