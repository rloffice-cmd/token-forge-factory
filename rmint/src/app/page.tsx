"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Package,
  Star,
  Briefcase,
  CheckSquare,
  BarChart2,
  Settings,
  Send,
  Paperclip,
  User,
  TrendingUp,
  Gem,
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

const NAV_ITEMS: readonly {
  label: string;
  icon: typeof LayoutDashboard;
  active?: boolean;
}[] = [
  { label: "Command Center", icon: LayoutDashboard, active: true },
  { label: "מלאי", icon: Package },
  { label: "הערכות", icon: Star },
  { label: "פורטפוליו", icon: Briefcase },
  { label: "משימות", icon: CheckSquare },
  { label: "דוחות", icon: BarChart2 },
  { label: "הגדרות", icon: Settings },
];

const QUICK_ACTIONS = [
  {
    label: "הוסף פריט חדש",
    command: "הוסף פריט חדש למלאי",
    icon: Gem,
    borderColor: "border-gold/40",
    hoverBorder: "hover:border-gold/70",
    iconColor: "text-gold",
  },
  {
    label: "הערכה 7.4",
    command: "הפעל הערכה אוטומטית 7.4",
    icon: TrendingUp,
    borderColor: "border-accent/30",
    hoverBorder: "hover:border-accent/60",
    iconColor: "text-accent",
  },
  {
    label: "לוגיסטיקה",
    command: "פתח מעקב לוגיסטיקה",
    icon: Package,
    borderColor: "border-border",
    hoverBorder: "hover:border-muted/40",
    iconColor: "text-muted",
  },
  {
    label: "דוחות",
    command: "הצג דוח פורטפוליו שבועי",
    icon: BarChart2,
    borderColor: "border-border",
    hoverBorder: "hover:border-muted/40",
    iconColor: "text-muted",
  },
  {
    label: "משימות",
    command: "הצג משימות פתוחות",
    icon: CheckSquare,
    borderColor: "border-border",
    hoverBorder: "hover:border-muted/40",
    iconColor: "text-muted",
  },
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

function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8d282" />
          <stop offset="50%" stopColor="#c9a84c" />
          <stop offset="100%" stopColor="#a08838" />
        </linearGradient>
        <linearGradient id="goldShine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#f0e0a0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <path
        d="M24 4L38 18L24 44L10 18L24 4Z"
        fill="url(#goldGrad)"
        stroke="url(#goldShine)"
        strokeWidth="1"
      />
      <path d="M10 18H38L24 44L10 18Z" fill="#a08838" fillOpacity="0.4" />
      <path d="M24 4L17 18H31L24 4Z" fill="#f0e0a0" fillOpacity="0.3" />
    </svg>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-6 animate-[fade-in_0.2s_ease-out]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
        <DiamondIcon className="h-5 w-5 animate-[diamond-pulse_2s_ease-in-out_infinite]" />
      </div>
      <div className="rounded-2xl rounded-tr-sm border-r-2 border-gold/20 bg-card px-4 py-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block h-2 w-2 rounded-full bg-gold/60"
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
    <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
      <div
        className="h-3 w-3/4 rounded"
        style={{
          background:
            "linear-gradient(90deg, #1e1e35 25%, #c9a84c18 50%, #1e1e35 75%)",
          backgroundSize: "200% 100%",
          animation: "gold-shimmer 2s ease-in-out infinite",
        }}
      />
      <div
        className="h-2.5 w-1/2 rounded"
        style={{
          background:
            "linear-gradient(90deg, #1e1e35 25%, #c9a84c12 50%, #1e1e35 75%)",
          backgroundSize: "200% 100%",
          animation: "gold-shimmer 2s ease-in-out 0.3s infinite",
        }}
      />
      <div
        className="h-2 w-1/3 rounded"
        style={{
          background:
            "linear-gradient(90deg, #1e1e35 25%, #c9a84c0d 50%, #1e1e35 75%)",
          backgroundSize: "200% 100%",
          animation: "gold-shimmer 2s ease-in-out 0.6s infinite",
        }}
      />
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
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* ── TOP HEADER BAR ── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
        <div className="flex items-center gap-3.5">
          <DiamondIcon className="h-8 w-8 animate-[diamond-pulse_3s_ease-in-out_infinite]" />
          <div className="flex flex-col leading-tight">
            <span
              className="text-sm font-bold text-gold"
              style={{ letterSpacing: "0.2em" }}
            >
              RMINT
            </span>
            <span
              className="text-[9px] text-muted"
              style={{ letterSpacing: "0.15em" }}
            >
              TCG FUND OPERATING SYSTEM
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full border border-pokemon/30 bg-pokemon/10 px-2.5 py-0.5 text-[10px] font-semibold text-pokemon">
            POKÉMON
          </span>
          <span className="rounded-full border border-onepiece/30 bg-onepiece/10 px-2.5 py-0.5 text-[10px] font-semibold text-onepiece">
            ONE PIECE
          </span>

          <div className="mr-2 h-5 w-px bg-border" />

          <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-xs text-muted">מחובר</span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted transition-colors hover:text-foreground hover:shadow-[0_0_12px_rgba(201,168,76,0.1)]">
            <User size={15} />
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-card hover:text-foreground">
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* ── MAIN AREA ── */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* ── LEFT SIDEBAR ── */}
        <aside
          className="flex w-[260px] shrink-0 flex-col border-l border-border"
          style={{
            background: "linear-gradient(180deg, #0f0f1a 0%, #080810 100%)",
          }}
        >
          <div className="px-5 pt-5 pb-3">
            <span
              className="text-[10px] font-semibold uppercase text-muted"
              style={{ letterSpacing: "0.15em" }}
            >
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
                      ? "border-r-2 border-gold bg-gold/5 font-medium text-gold"
                      : "text-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <Icon
                    size={17}
                    className={cn(
                      "shrink-0",
                      item.active
                        ? "text-gold"
                        : "text-muted group-hover:text-foreground",
                    )}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Gold separator */}
            <div className="my-3 mx-3 h-px bg-gradient-to-l from-transparent via-gold/20 to-transparent" />

            <button className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-all hover:bg-surface-hover hover:text-foreground">
              <Star size={17} className="shrink-0 text-muted group-hover:text-foreground" />
              <span>דירוג נכסים</span>
            </button>
          </nav>
          <div className="border-t border-border px-5 py-3">
            <p
              className="text-[9px] text-muted/50"
              style={{ letterSpacing: "0.1em" }}
            >
              FUND TRACKER v1.0
            </p>
          </div>
        </aside>

        {/* ── CENTER – CHAT ── */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex flex-1 flex-col overflow-y-auto py-6">
            {messages.length === 0 && !isTyping ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
                <div className="animate-[diamond-pulse_3s_ease-in-out_infinite]">
                  <DiamondIcon className="h-24 w-24" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">
                  שלום, איתי
                </h2>
                <p className="text-muted">מה נבדוק היום?</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {QUICK_ACTIONS.slice(0, 3).map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        onClick={() => handleQuickAction(action.command)}
                        className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted transition-all hover:border-gold/30 hover:bg-card hover:text-foreground hover:shadow-[0_0_20px_rgba(201,168,76,0.08)]"
                      >
                        <Icon size={14} className={action.iconColor} />
                        <span>{action.label}</span>
                      </button>
                    );
                  })}
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
                      <div className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <DiamondIcon className="h-5 w-5" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[520px] rounded-2xl px-4 py-3",
                        msg.role === "user"
                          ? "rounded-tl-sm border border-gold/25 bg-gold/8 text-foreground"
                          : "rounded-tr-sm border-r-2 border-gold/15 bg-card text-foreground",
                      )}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      <p
                        className={cn(
                          "mt-1.5 text-[10px]",
                          msg.role === "user" ? "text-gold/50" : "text-muted",
                        )}
                      >
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-xs text-muted">
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
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-2 transition-all focus-within:border-gold/40 focus-within:shadow-[0_0_16px_rgba(201,168,76,0.06)]"
            >
              <button
                type="button"
                className="shrink-0 text-muted transition-colors hover:text-foreground"
              >
                <Paperclip size={17} />
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="הקלד פקודה או שאלה..."
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
                  input.trim() && !isTyping
                    ? "bg-gold text-background hover:bg-gold-dim shadow-[0_0_14px_rgba(201,168,76,0.25)]"
                    : "text-muted/20",
                )}
              >
                <Send size={15} className="rotate-180" />
              </button>
            </form>
          </div>
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside className="flex w-[300px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface px-5 py-5">
          <h3
            className="text-[10px] font-semibold uppercase text-muted"
            style={{ letterSpacing: "0.15em" }}
          >
            פאנל הקשר
          </h3>

          {/* Quick Actions */}
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-muted/70">
              פעולות מהירות
            </span>
            <div className="flex flex-col gap-1.5">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.command)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground transition-all hover:shadow-[0_0_20px_rgba(201,168,76,0.06)]",
                      action.borderColor,
                      action.hoverBorder,
                    )}
                  >
                    <Icon size={15} className={action.iconColor} />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Portfolio Snapshot */}
          <div className="space-y-3">
            <span className="text-[11px] font-medium text-muted/70">
              פורטפוליו פרטי
            </span>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3" style={{ borderTop: "1px solid rgba(201,168,76,0.25)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">השקעה</span>
                <span className="text-sm font-semibold font-mono text-foreground">
                  ₪0
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">רווח / הפסד</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold font-mono text-foreground">
                    ₪0
                  </span>
                  <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] font-mono text-muted">
                    0%
                  </span>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">פריטים</span>
                <span className="text-sm font-semibold font-mono text-foreground">
                  0
                </span>
              </div>
            </div>
          </div>

          {/* Recent Items */}
          <div className="space-y-3">
            <span className="text-[11px] font-medium text-muted/70">
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
      <footer className="relative z-10 flex h-8 shrink-0 items-center justify-between bg-surface px-5 text-[11px] text-muted" style={{ borderTop: "1px solid rgba(201,168,76,0.15)" }}>
        <div className="flex items-center gap-5">
          <span
            className="text-[9px] font-semibold text-gold/50"
            style={{ letterSpacing: "0.15em" }}
          >
            RMINT FUND OS
          </span>
          <div className="h-3 w-px bg-border" />
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
