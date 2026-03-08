/**
 * GradingStudio v3 — Professional Multi-Item Pre-Grading Assessment System
 *
 * Upgrades over v2:
 *  1. Per-item-type capture flows (card / box / case / sealed / other)
 *  2. Type-specific phase labels, scan steps, and analysis steps
 *  3. Professional grade overlays for sealed/box items (6 sides)
 *  4. Type-aware result display (centering hidden for non-cards)
 *  5. Seal integrity & tamper evidence fields in results
 *
 * Flow:  intro → [type-specific phases] → analyzing → result
 *        User can skip optional phases or tap "Analyze now" after 2 captures
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { gradeItem, type GradingImage, type GradingResult, type GradingIssue } from "@/lib/collectpro/ai";
import type { CollectionItem } from "@/lib/collectpro/types";

// ─────────────────────────────────────────────────────────────────────────────
// Phase union type — all possible capture phases across all item types
// ─────────────────────────────────────────────────────────────────────────────

type GradingPhase =
  | "intro"
  | "front" | "back"
  // Card-specific
  | "corner_tl" | "corner_tr" | "corner_bl" | "corner_br"
  | "edge_top"  | "edge_bottom" | "edge_left" | "edge_right"
  // Box / Case / Sealed
  | "side_left" | "side_right" | "top" | "bottom"
  | "seal_front" | "seal_tab" | "seal_detail"
  // Generic details
  | "detail_1" | "detail_2"
  | "analyzing" | "result" | "history" | "error";

// ─────────────────────────────────────────────────────────────────────────────
// Per-item-type configuration
// ─────────────────────────────────────────────────────────────────────────────

interface ItemTypeConfig {
  label: string;
  icon: string;
  gradeScale: string;
  sequence: GradingPhase[];
  /** Phases from this index onward can be skipped */
  optionalFromIdx: number;
  phaseLabels: Partial<Record<GradingPhase, string>>;
  phaseGuideType: Partial<Record<GradingPhase, "full" | "corner" | "edge" | "closeup" | "side">>;
  scanSteps: string[];
  analysisSteps: string[];
  subgradeLabels: { centering: string; corners: string; edges: string; surfaces: string };
  showCentering: boolean;
  introHint: string;
}

const ITEM_TYPE_CONFIG: Record<string, ItemTypeConfig> = {
  card: {
    label: "קלף",
    icon: "🃏",
    gradeScale: "PSA / BGS / CGC",
    sequence: [
      "front", "back",
      "corner_tl", "corner_tr", "corner_bl", "corner_br",
      "edge_top", "edge_bottom", "edge_left", "edge_right",
    ],
    optionalFromIdx: 2, // corners onward are optional
    phaseLabels: {
      front:       "חזית הקלף",
      back:        "גב הקלף",
      corner_tl:   "פינה שמאל-עליון",
      corner_tr:   "פינה ימין-עליון",
      corner_bl:   "פינה שמאל-תחתון",
      corner_br:   "פינה ימין-תחתון",
      edge_top:    "שפה עליונה",
      edge_bottom: "שפה תחתונה",
      edge_left:   "שפה שמאלית",
      edge_right:  "שפה ימנית",
    },
    phaseGuideType: {
      front: "full", back: "full",
      corner_tl: "corner", corner_tr: "corner", corner_bl: "corner", corner_br: "corner",
      edge_top: "edge", edge_bottom: "edge", edge_left: "edge", edge_right: "edge",
    },
    scanSteps: [
      "חזית הקלף (סריקה מלאה)",
      "גב הקלף (סריקה מלאה)",
      "4 פינות בזום צמוד (אופציונלי)",
      "4 שפות בזום (אופציונלי)",
    ],
    analysisSteps: [
      "מנתח ריכוז ומרכוז לפי תקן PSA...",
      "בודק מצב פינות תחת הגדלה...",
      "בודק שפות ובדיקת ספריות...",
      "בודק פני שטח — שריטות ופגמי הדפסה...",
      "מזהה פגמי פרינט ו-Rosette Pattern...",
      "מזהה זיופים ברמת מומחה...",
      "מחשב ציון PSA / BGS סופי...",
    ],
    subgradeLabels: { centering: "ריכוז", corners: "פינות", edges: "שפות", surfaces: "פני שטח" },
    showCentering: true,
    introHint: "סורק את הקלף מכל הזוויות ומעניק ציון ברמת PSA / BGS / CGC — כולל זיהוי זיופים ב-Rosette Pattern.",
  },

  box: {
    label: "בוקס",
    icon: "📦",
    gradeScale: "Pack Fresh",
    sequence: ["front", "back", "side_left", "side_right", "top", "bottom", "seal_detail"],
    optionalFromIdx: 2, // sides onward optional
    phaseLabels: {
      front:       "חזית הבוקס",
      back:        "גב הבוקס",
      side_left:   "צד שמאל",
      side_right:  "צד ימין",
      top:         "חלק עליון",
      bottom:      "חלק תחתון",
      seal_detail: "חותמת / פרט",
    },
    phaseGuideType: {
      front: "full", back: "full",
      side_left: "side", side_right: "side",
      top: "side", bottom: "side",
      seal_detail: "closeup",
    },
    scanSteps: [
      "חזית הבוקס (סריקה מלאה)",
      "גב הבוקס (סריקה מלאה)",
      "4 צדדים — עליון, תחתון, שמאל, ימין (אופציונלי)",
      "חותמת / פרטי אבטחה (אופציונלי)",
    ],
    analysisSteps: [
      "בודק שלמות מבנה הקופסה...",
      "בודק 8 פינות הבוקס...",
      "בודק 12 שפות הבוקס...",
      "מזהה נזקי שינוע ולחץ...",
      "בודק עדות לפתיחה והחזרה...",
      "מנתח חותמות ומדבקות אבטחה...",
      "מחשב ציון Pack Fresh סופי...",
    ],
    subgradeLabels: { centering: "חותמת", corners: "פינות בוקס", edges: "שפות בוקס", surfaces: "פני השטח" },
    showCentering: false,
    introHint: "בודק את מצב הבוקס מכל 6 הצדדים — פינות, שפות, נזקי שינוע, עדות פתיחה וחותמות.",
  },

  sealed: {
    label: "אייטם אטום",
    icon: "🔒",
    gradeScale: "Pack Fresh",
    sequence: ["front", "back", "side_left", "side_right", "seal_front", "seal_tab"],
    optionalFromIdx: 2,
    phaseLabels: {
      front:      "חזית האריזה",
      back:       "גב האריזה",
      side_left:  "צד שמאל",
      side_right: "צד ימין",
      seal_front: "חותמת ראשית",
      seal_tab:   "לשונית פתיחה",
    },
    phaseGuideType: {
      front: "full", back: "full",
      side_left: "side", side_right: "side",
      seal_front: "closeup", seal_tab: "closeup",
    },
    scanSteps: [
      "חזית האריזה (סריקה מלאה)",
      "גב האריזה (סריקה מלאה)",
      "2 צדדים (אופציונלי)",
      "חותמת ולשונית פתיחה (אופציונלי)",
    ],
    analysisSteps: [
      "בודק שלמות האריזה...",
      "מחפש עדות לפתיחה מחדש...",
      "מנתח מצב החותמת והסלופן...",
      "בודק לשונית פתיחה...",
      "מזהה מניפולציות re-sealing...",
      "בודק טריות הפאק...",
      "מחשב ציון Pack Fresh סופי...",
    ],
    subgradeLabels: { centering: "חותמת", corners: "פינות", edges: "שפות", surfaces: "אריזה" },
    showCentering: false,
    introHint: "בודק את שלמות האטימה, מחפש עדות פתיחה מחדש, ומעריך את מצב הפאק / הבוסטר.",
  },

  case: {
    label: "קייס",
    icon: "📫",
    gradeScale: "Case Grade",
    sequence: ["front", "back", "side_left", "side_right", "top", "bottom"],
    optionalFromIdx: 2,
    phaseLabels: {
      front:      "חזית הקייס",
      back:        "גב הקייס",
      side_left:  "צד שמאל",
      side_right: "צד ימין",
      top:        "חלק עליון",
      bottom:     "חלק תחתון",
    },
    phaseGuideType: {
      front: "full", back: "full",
      side_left: "side", side_right: "side",
      top: "side", bottom: "side",
    },
    scanSteps: [
      "חזית הקייס",
      "גב הקייס",
      "4 צדדים (אופציונלי)",
    ],
    analysisSteps: [
      "בודק מבנה ושלמות הקייס...",
      "בודק פינות ושפות...",
      "מנתח אטימת הקייס...",
      "בודק תווית ומק\"ט...",
      "מחפש נזקי שינוע...",
      "בודק שלמות תכולה פנימית...",
      "מחשב ציון Case Grade סופי...",
    ],
    subgradeLabels: { centering: "תווית", corners: "פינות", edges: "שפות", surfaces: "מצב כולל" },
    showCentering: false,
    introHint: "בודק את הקייס מכל הצדדים — פינות, שפות, אטימה, תווית וסימני שינוע.",
  },

  other: {
    label: "אחר",
    icon: "🎴",
    gradeScale: "Grade",
    sequence: ["front", "back", "detail_1", "detail_2"],
    optionalFromIdx: 2,
    phaseLabels: {
      front:    "צד ראשי",
      back:     "צד שני",
      detail_1: "פרט ראשון",
      detail_2: "פרט שני",
    },
    phaseGuideType: {
      front: "full", back: "full",
      detail_1: "closeup", detail_2: "closeup",
    },
    scanSteps: [
      "צד ראשי",
      "צד שני",
      "2 פרטים לבחירתך (אופציונלי)",
    ],
    analysisSteps: [
      "בודק מצב כללי...",
      "מנתח פגמים ושחיקה...",
      "בודק אותנטיות...",
      "מעריך ערך שוק...",
      "מחשב ציון...",
    ],
    subgradeLabels: { centering: "מרכוז", corners: "פינות", edges: "שפות", surfaces: "פני שטח" },
    showCentering: true,
    introHint: "הערכת מצב מקצועית לכל סוג פריט — ניתוח AI מלא עם זיהוי פגמים וזיופים.",
  },
};

const ITEM_TYPES = Object.entries(ITEM_TYPE_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  icon: cfg.icon,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  items: CollectionItem[];
  /** When set, pre-fills the form and auto-starts the scan (skips intro) */
  initialItem?: CollectionItem | null;
  onClose: () => void;
}

interface GradingRecord {
  id: string;
  item_id: string | null;
  item_type: string;
  item_name: string;
  ai_grade: number | null;
  ai_grade_label: string | null;
  ai_subgrades: GradingResult["subgrades"] | null;
  centering_analysis: GradingResult["centering"] | null;
  authenticity: string | null;
  authenticity_confidence: number | null;
  authenticity_notes: string | null;
  issues: GradingIssue[] | null;
  summary: string | null;
  recommendations: string | null;
  actual_grade: number | null;
  actual_grader: string | null;
  grade_delta: number | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (outside component)
// ─────────────────────────────────────────────────────────────────────────────

function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement, quality = 0.87): string {
  canvas.width  = Math.min(video.videoWidth  || 1280, 1280);
  canvas.height = Math.min(video.videoHeight || 720,  720);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality).split(",")[1];
}

function analyseLuminance(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 50;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 20) {
    sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    n++;
  }
  return n > 0 ? (sum / n / 255) * 100 : 50;
}

function gradeColor(g: number) {
  if (g >= 9.5) return "text-yellow-300";
  if (g >= 8.5) return "text-green-400";
  if (g >= 7)   return "text-blue-400";
  if (g >= 5)   return "text-orange-400";
  return "text-red-400";
}

function gradeBg(g: number) {
  if (g >= 9.5) return "from-yellow-500 to-amber-600";
  if (g >= 8.5) return "from-green-500 to-emerald-600";
  if (g >= 7)   return "from-blue-500 to-blue-700";
  if (g >= 5)   return "from-orange-500 to-orange-700";
  return "from-red-500 to-red-700";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function AutoCaptureRing({ progress }: { progress: number }) {
  const r = 28, cx = 36, cy = 36, circ = 2 * Math.PI * r;
  return (
    <svg width={72} height={72} className="absolute bottom-3 right-3 opacity-90 pointer-events-none">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={4} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={progress >= 80 ? "#4ade80" : "#facc15"}
        strokeWidth={4}
        strokeDasharray={`${(progress / 100) * circ} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.15s ease-out" }}
      />
      <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">
        {Math.round(progress)}%
      </text>
    </svg>
  );
}

function SubgradeBar({ label, value }: { label: string; value: number }) {
  const pct = ((value - 1) / 9) * 100;
  const color = value >= 9.5 ? "bg-yellow-400" : value >= 8 ? "bg-green-400" : value >= 6 ? "bg-blue-400" : "bg-orange-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 text-xs w-20 text-right shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: "width 0.8s ease-out" }} />
      </div>
      <span className={`text-sm font-bold w-8 shrink-0 ${gradeColor(value)}`}>{value.toFixed(1)}</span>
    </div>
  );
}

function IssueBadge({ severity }: { severity: GradingIssue["severity"] }) {
  const cls = severity === "minor"    ? "bg-yellow-900/60 text-yellow-300 border-yellow-700"
    : severity === "moderate"         ? "bg-orange-900/60 text-orange-300 border-orange-700"
    :                                   "bg-red-900/60    text-red-300    border-red-700";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${cls}`}>
      {severity === "minor" ? "קל" : severity === "moderate" ? "בינוני" : "חמור"}
    </span>
  );
}

// ── Phase overlay guides ──────────────────────────────────────────────────────

function FullCardGuide() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative border-2 border-yellow-400/70 rounded-sm" style={{ width: "55%", height: "78%" }}>
        <span className="absolute -top-0.5 -left-0.5  w-5 h-5 border-t-4 border-l-4 border-yellow-400" />
        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 border-yellow-400" />
        <span className="absolute -bottom-0.5 -left-0.5  w-5 h-5 border-b-4 border-l-4 border-yellow-400" />
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 border-yellow-400" />
      </div>
    </div>
  );
}

/** For box/case — wider frame guide */
function SideGuide({ label }: { label?: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative border-2 border-cyan-400/70 rounded-sm" style={{ width: "80%", height: "70%" }}>
        <span className="absolute -top-0.5 -left-0.5  w-5 h-5 border-t-4 border-l-4 border-cyan-400" />
        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 border-cyan-400" />
        <span className="absolute -bottom-0.5 -left-0.5  w-5 h-5 border-b-4 border-l-4 border-cyan-400" />
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 border-cyan-400" />
        {label && (
          <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-cyan-300 text-xs bg-black/60 px-2 py-0.5 rounded">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/** Close-up guide for seal / detail shots */
function CloseupGuide() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative border-2 border-purple-400/80 rounded-sm" style={{ width: "50%", height: "50%" }}>
        <span className="absolute -top-0.5 -left-0.5  w-6 h-6 border-t-4 border-l-4 border-purple-400" />
        <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-purple-400" />
        <span className="absolute -bottom-0.5 -left-0.5  w-6 h-6 border-b-4 border-l-4 border-purple-400" />
        <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-purple-400" />
        {/* Cross hair */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-purple-400/30 -translate-y-1/2" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-purple-400/30 -translate-x-1/2" />
        </div>
      </div>
    </div>
  );
}

function CornerGuide({ phase }: { phase: GradingPhase }) {
  const pos: Record<string, { top?: string; bottom?: string; left?: string; right?: string }> = {
    corner_tl: { top: "12%",  left:  "12%" },
    corner_tr: { top: "12%",  right: "12%" },
    corner_bl: { bottom: "12%", left:  "12%" },
    corner_br: { bottom: "12%", right: "12%" },
  };
  const p = pos[phase] ?? { top: "12%", left: "12%" };
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute w-24 h-24 border-2 border-yellow-400/80" style={p}>
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-yellow-400/30 -translate-y-1/2" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-yellow-400/30 -translate-x-1/2" />
        </div>
      </div>
    </div>
  );
}

function EdgeGuide({ phase }: { phase: GradingPhase }) {
  const isH = phase === "edge_top" || phase === "edge_bottom";
  const style: React.CSSProperties = {
    position: "absolute",
    width:  isH ? "72%" : "9%",
    height: isH ? "9%"  : "72%",
    ...(phase === "edge_top"    ? { top:    "8%"  } : {}),
    ...(phase === "edge_bottom" ? { bottom: "8%"  } : {}),
    ...(phase === "edge_left"   ? { left:   "6%"  } : {}),
    ...(phase === "edge_right"  ? { right:  "6%"  } : {}),
    ...(isH ? { left: "14%" } : { top: "14%" }),
  };
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="border-2 border-yellow-400/80" style={style} />
    </div>
  );
}

function PhaseGuide({ phase, guideType }: { phase: GradingPhase; guideType: string | undefined }) {
  if (!guideType) return null;
  if (guideType === "full")    return <FullCardGuide />;
  if (guideType === "side")    return <SideGuide />;
  if (guideType === "closeup") return <CloseupGuide />;
  if (guideType === "corner")  return <CornerGuide phase={phase} />;
  if (guideType === "edge")    return <EdgeGuide phase={phase} />;
  return null;
}

// ── HistoryCard ────────────────────────────────────────────────────────────────

function HistoryCard({ rec, onUpdate }: { rec: GradingRecord; onUpdate: () => void }) {
  const [editing,     setEditing]     = useState(false);
  const [actualGrade, setActualGrade] = useState(rec.actual_grade?.toString() ?? "");
  const [grader,      setGrader]      = useState(rec.actual_grader ?? "PSA");
  const [saving,      setSaving]      = useState(false);

  const save = async () => {
    const g = parseFloat(actualGrade);
    if (isNaN(g) || g < 1 || g > 10) return;
    setSaving(true);
    await supabase.from("cp_grading_assessments").update({ actual_grade: g, actual_grader: grader }).eq("id", rec.id);
    setSaving(false);
    setEditing(false);
    onUpdate();
  };

  const auth = rec.authenticity ?? "genuine";
  const cfg  = ITEM_TYPE_CONFIG[rec.item_type] ?? ITEM_TYPE_CONFIG.other;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{cfg.icon}</span>
            <p className="text-white font-semibold text-sm">{rec.item_name || "—"}</p>
          </div>
          <p className="text-gray-500 text-xs">{cfg.gradeScale} · {new Date(rec.created_at).toLocaleDateString("he-IL")}</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-extrabold ${gradeColor(rec.ai_grade ?? 0)}`}>{rec.ai_grade?.toFixed(1) ?? "—"}</p>
          <p className="text-gray-500 text-xs">{rec.ai_grade_label}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-sm font-bold ${auth === "genuine" ? "text-green-400" : auth === "suspect" ? "text-yellow-400" : "text-red-400"}`}>
          {auth === "genuine" ? "✓ מקורי" : auth === "suspect" ? "⚠ חשוד" : "✗ זיוף"}
        </span>
        {rec.authenticity_confidence != null && (
          <span className="text-gray-500 text-xs">{rec.authenticity_confidence.toFixed(0)}% ביטחון</span>
        )}
      </div>

      {rec.actual_grade != null ? (
        <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
          <span className="text-gray-400 text-xs">ציון בפועל ({rec.actual_grader})</span>
          <span className={`font-bold ${gradeColor(rec.actual_grade)}`}>{rec.actual_grade.toFixed(1)}</span>
          {rec.grade_delta != null && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${Math.abs(rec.grade_delta) <= 0.5 ? "bg-green-900/60 text-green-300" : "bg-orange-900/60 text-orange-300"}`}>
              {rec.grade_delta > 0 ? "+" : ""}{rec.grade_delta.toFixed(1)}
            </span>
          )}
        </div>
      ) : editing ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number" min="1" max="10" step="0.5" value={actualGrade}
              onChange={e => setActualGrade(e.target.value)}
              placeholder="ציון"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm"
            />
            <select value={grader} onChange={e => setGrader(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm">
              {["PSA","BGS","CGC","SGC","VGA","Other"].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 py-1.5 rounded-lg border border-gray-700 text-gray-400 text-xs">ביטול</button>
            <button onClick={save} disabled={saving} className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold">
              {saving ? "שומר..." : "שמור"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          className="w-full py-1.5 rounded-lg border border-dashed border-gray-700 text-gray-500 text-xs hover:border-gray-500 transition-colors">
          + הוסף ציון שהתקבל מחברת דירוג
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function GradingStudio({ items, initialItem, onClose }: Props) {

  const startPhase: GradingPhase = initialItem ? "front" : "intro";

  // ── Phase (ref-synced to avoid stale closures) ───────────────────────────
  const [phase, _setPhase] = useState<GradingPhase>(startPhase);
  const phaseRef = useRef<GradingPhase>(startPhase);
  const setPhase = useCallback((p: GradingPhase) => { phaseRef.current = p; _setPhase(p); }, []);

  // ── Setup ─────────────────────────────────────────────────────────────────
  const [itemType,  setItemType]  = useState("card");
  const [itemName,  setItemName]  = useState(initialItem?.name ?? "");
  const [linkedId,  setLinkedId]  = useState(initialItem?.id ?? "");

  // Refs that always hold current item-type-derived values (for callbacks)
  const itemTypeRef       = useRef(itemType);
  const seqRef            = useRef<GradingPhase[]>(ITEM_TYPE_CONFIG.card.sequence);
  const captureSetRef     = useRef<Set<GradingPhase>>(new Set(ITEM_TYPE_CONFIG.card.sequence));
  const analysisStepsRef  = useRef<string[]>(ITEM_TYPE_CONFIG.card.analysisSteps);

  useEffect(() => {
    const cfg = ITEM_TYPE_CONFIG[itemType] ?? ITEM_TYPE_CONFIG.other;
    itemTypeRef.current      = itemType;
    seqRef.current           = cfg.sequence;
    captureSetRef.current    = new Set(cfg.sequence);
    analysisStepsRef.current = cfg.analysisSteps;
  }, [itemType]);

  // ── Camera / analysis UI state ────────────────────────────────────────────
  const [guidance,      setGuidance]      = useState("");
  const [stability,     setStability]     = useState(0);
  const [lighting,      setLighting]      = useState(0);
  const [autoCapture,   setAutoCapture]   = useState(0);
  const [capturedCount, setCapturedCount] = useState(0);
  const [flashCapture,  setFlashCapture]  = useState(false);

  // ── Analysis / result ─────────────────────────────────────────────────────
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result,       setResult]       = useState<GradingResult | null>(null);
  const [errorMsg,     setErrorMsg]     = useState("");

  // ── History ───────────────────────────────────────────────────────────────
  const [history,     setHistory]     = useState<GradingRecord[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [saving,      setSaving]      = useState(false);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const analysisRef = useRef<HTMLCanvasElement>(null);

  // ── Lifecycle refs ────────────────────────────────────────────────────────
  const streamRef        = useRef<MediaStream | null>(null);
  const loopRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevFrameRef     = useRef<ImageData | null>(null);
  const capturedRef      = useRef<GradingImage[]>([]);
  const autoCaptureRef   = useRef(false);
  const autoCaptureCount = useRef(0);

  // ── Stable callback refs ──────────────────────────────────────────────────
  const triggerCaptureRef  = useRef<(() => void) | null>(null);
  const startAnalysisRef   = useRef<(() => Promise<void>) | null>(null);
  const analysisTimerRefs  = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ─────────────────────────────────────────────────────────────────────────
  // Camera management
  // ─────────────────────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
    } catch {
      setPhase("error");
      setErrorMsg("לא ניתן לגשת למצלמה. אפשר גישה בהגדרות הדפדפן ונסה שוב.");
    }
  }, [setPhase]);

  // ─────────────────────────────────────────────────────────────────────────
  // Frame analysis loop (300 ms)
  // ─────────────────────────────────────────────────────────────────────────

  const startAnalysisLoop = useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    autoCaptureRef.current   = false;
    autoCaptureCount.current = 0;
    prevFrameRef.current     = null;

    loopRef.current = setInterval(() => {
      const video     = videoRef.current;
      const offscreen = analysisRef.current;
      if (!video || !offscreen || !streamRef.current) return;
      if (phaseRef.current === "analyzing") return;

      const AW = 320, AH = 180;
      offscreen.width  = AW;
      offscreen.height = AH;
      const ctx = offscreen.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, AW, AH);

      const lum        = analyseLuminance(offscreen);
      const newLighting = Math.min(100, Math.max(0, (lum - 15) / 0.6));
      setLighting(Math.round(newLighting));

      const currentFrame = ctx.getImageData(0, 0, AW, AH);
      let diffScore = 100;
      if (prevFrameRef.current) {
        const d1 = prevFrameRef.current.data, d2 = currentFrame.data;
        let diff = 0, n = 0;
        for (let i = 0; i < d1.length; i += 4 * 12) {
          diff += Math.abs(d1[i] - d2[i]) + Math.abs(d1[i+1] - d2[i+1]) + Math.abs(d1[i+2] - d2[i+2]);
          n++;
        }
        diffScore = Math.max(0, 100 - (diff / (n * 3 * 255)) * 100 * 9);
      }
      prevFrameRef.current = currentFrame;
      setStability(Math.round(Math.min(100, diffScore)));

      // Guidance — adapted per item type
      const cfg = ITEM_TYPE_CONFIG[itemTypeRef.current] ?? ITEM_TYPE_CONFIG.other;
      const ph  = phaseRef.current;
      const phLabel = cfg.phaseLabels[ph] ?? ph;

      if (newLighting < 25) {
        setGuidance("💡 שפר תאורה — הפריט כהה מדי");
      } else if (newLighting > 92) {
        setGuidance("🌟 הפחת תאורה — בהיר מדי");
      } else if (diffScore < 35) {
        setGuidance("✋ החזק את הפריט יציב...");
      } else if (diffScore < 60) {
        setGuidance("⏳ המשך להחזיק יציב...");
      } else {
        const guideType = cfg.phaseGuideType[ph];
        if (guideType === "full")    setGuidance(`📷 כוון את ${phLabel} למסגרת הצהובה`);
        else if (guideType === "side")    setGuidance(`📦 כוון: ${phLabel} — מלא את המסגרת`);
        else if (guideType === "closeup") setGuidance(`🔍 קרב לפרט: ${phLabel}`);
        else if (guideType === "corner")  setGuidance(`🔍 קרב לפינה: ${phLabel}`);
        else if (guideType === "edge")    setGuidance(`📏 כוון שפה: ${phLabel}`);
        else setGuidance("✓ מוכן!");
      }

      const isGood = newLighting >= 25 && newLighting <= 92 && diffScore >= 60;
      const prevAC = autoCaptureCount.current;
      const newAC  = isGood ? Math.min(prevAC + 9, 100) : Math.max(prevAC - 20, 0);
      autoCaptureCount.current = newAC;
      setAutoCapture(newAC);

      if (newAC >= 100 && !autoCaptureRef.current) {
        autoCaptureRef.current = true;
        setTimeout(() => triggerCaptureRef.current?.(), 120);
      }
    }, 300);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Capture frame — uses seqRef for dynamic sequence
  // ─────────────────────────────────────────────────────────────────────────

  const triggerCapture = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ph     = phaseRef.current;
    if (!video || !canvas || !captureSetRef.current.has(ph)) return;

    const cfg    = ITEM_TYPE_CONFIG[itemTypeRef.current] ?? ITEM_TYPE_CONFIG.other;
    const label  = cfg.phaseLabels[ph] ?? ph;
    const b64    = captureFrame(video, canvas, 0.87);
    capturedRef.current = [...capturedRef.current, { label, base64: b64, media_type: "image/jpeg" }];
    setCapturedCount(c => c + 1);

    setAutoCapture(0);
    autoCaptureCount.current = 0;
    autoCaptureRef.current   = false;
    prevFrameRef.current     = null;

    setFlashCapture(true);
    setTimeout(() => setFlashCapture(false), 220);

    // Advance to next phase in the type-specific sequence
    const seq    = seqRef.current;
    const seqIdx = seq.indexOf(ph);
    const next   = seqIdx < seq.length - 1 ? seq[seqIdx + 1] : null;
    if (next) {
      setPhase(next);
    } else if (capturedRef.current.length >= 2) {
      startAnalysisRef.current?.();
    }
  }, [setPhase]);

  useEffect(() => { triggerCaptureRef.current = triggerCapture; }, [triggerCapture]);

  // ─────────────────────────────────────────────────────────────────────────
  // AI analysis
  // ─────────────────────────────────────────────────────────────────────────

  const startAnalysis = useCallback(async () => {
    stopCamera();
    setPhase("analyzing");
    setAnalysisStep(0);
    analysisTimerRefs.current.forEach(clearTimeout);
    const steps = analysisStepsRef.current;
    analysisTimerRefs.current = steps.map((_, i) =>
      setTimeout(() => setAnalysisStep(i), i * 900)
    );

    try {
      const res = await gradeItem(capturedRef.current, itemTypeRef.current);
      setResult(res);
      setPhase("result");
    } catch (err) {
      setPhase("error");
      setErrorMsg((err as Error).message);
    }
  }, [stopCamera, setPhase]);

  useEffect(() => { startAnalysisRef.current = startAnalysis; }, [startAnalysis]);

  // ─────────────────────────────────────────────────────────────────────────
  // Camera lifecycle — uses captureSetRef for dynamic capture phase set
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const inCapture = captureSetRef.current.has(phase);
    if (!inCapture) {
      stopCamera();
      return;
    }
    if (streamRef.current) {
      autoCaptureCount.current = 0;
      autoCaptureRef.current   = false;
      prevFrameRef.current     = null;
      setAutoCapture(0);
      setGuidance("");
      return;
    }
    startCamera().then(() => { if (streamRef.current) startAnalysisLoop(); });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    stopCamera();
    analysisTimerRefs.current.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // Save result to DB
  // ─────────────────────────────────────────────────────────────────────────

  const saveResult = useCallback(async () => {
    if (!result) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    await supabase.from("cp_grading_assessments").insert({
      user_id:                 user.id,
      item_id:                 linkedId || null,
      item_type:               itemTypeRef.current,
      item_name:               itemName,
      ai_grade:                result.grade,
      ai_grade_label:          result.grade_label,
      ai_subgrades:            result.subgrades,
      centering_analysis:      result.centering,
      authenticity:            result.authenticity,
      authenticity_confidence: result.authenticity_confidence,
      authenticity_notes:      result.authenticity_notes,
      issues:                  result.issues,
      summary:                 result.summary,
      recommendations:         result.recommendations,
    });
    setSaving(false);
    loadHistory();
  }, [result, itemName, linkedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // History
  // ─────────────────────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    const { data } = await supabase
      .from("cp_grading_assessments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data ?? []) as GradingRecord[]);
    setHistLoading(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Restart session
  // ─────────────────────────────────────────────────────────────────────────

  const restart = useCallback(() => {
    capturedRef.current      = [];
    autoCaptureCount.current = 0;
    autoCaptureRef.current   = false;
    setCapturedCount(0);
    setResult(null);
    setAutoCapture(0);
    setStability(0);
    setLighting(0);
    setGuidance("");
    setPhase(initialItem ? "front" : "intro");
  }, [setPhase, initialItem]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived
  // ─────────────────────────────────────────────────────────────────────────

  const cfg          = ITEM_TYPE_CONFIG[itemType] ?? ITEM_TYPE_CONFIG.other;
  const seq          = cfg.sequence;
  const captureIdx   = seq.indexOf(phase as GradingPhase);
  const phaseIsCapture = captureSetRef.current.has(phase);
  const canAnalyze   = capturedCount >= 2;
  const isOptional   = captureIdx >= cfg.optionalFromIdx;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950 overflow-hidden" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
          <div>
            <p className="text-white font-bold text-sm leading-tight">
              {cfg.icon} סטודיו דירוג — {cfg.gradeScale}
            </p>
            {phaseIsCapture && (
              <p className="text-gray-500 text-xs">
                {itemName ? `${itemName} — ` : ""}{cfg.phaseLabels[phase] ?? phase}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phase !== "history" && (
            <button onClick={() => { loadHistory(); setPhase("history"); }}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700">
              היסטוריה
            </button>
          )}
          {phase === "history" && (
            <button onClick={() => setPhase("intro")}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700">
              ← חזרה
            </button>
          )}
        </div>
      </div>

      {/* ══ INTRO ══════════════════════════════════════════════════════════════ */}
      {phase === "intro" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Item type selector */}
          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">סוג הפריט</label>
            <div className="flex gap-2 flex-wrap">
              {ITEM_TYPES.map(t => (
                <button key={t.value} onClick={() => setItemType(t.value)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    itemType === t.value
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}>
                  <span>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hint for selected type */}
          <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-800/50 rounded-2xl p-5">
            <p className="text-blue-300 font-bold mb-1">{cfg.icon} מה בודקים עבור {cfg.label}?</p>
            <p className="text-gray-400 text-sm leading-relaxed">{cfg.introHint}</p>
            <p className="text-blue-400/70 text-xs mt-2 font-medium">סקאלת ציון: {cfg.gradeScale}</p>
          </div>

          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">שם הפריט</label>
            <input
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              placeholder={`לדוגמה: ${itemType === "card" ? "Charizard Base Set Holo" : itemType === "box" ? "Pokémon Base Set Booster Box" : "Scarlet & Violet Booster Pack"}`}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              <label className="text-gray-300 text-sm font-medium">קשר לפריט בתיק עבודות (אופציונלי)</label>
              <select value={linkedId}
                onChange={e => { setLinkedId(e.target.value); const it = items.find(i => i.id === e.target.value); if (it && !itemName) setItemName(it.name); }}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white">
                <option value="">— ללא קישור —</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.condition})</option>)}
              </select>
            </div>
          )}

          {/* Scan steps for this item type */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">מה יסרק:</p>
            {cfg.scanSteps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs shrink-0">{i + 1}</span>
                {s}
              </div>
            ))}
          </div>

          <button onClick={() => setPhase(seq[0])} disabled={!itemName.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform">
            {cfg.icon} התחל סריקת {cfg.label} →
          </button>
        </div>
      )}

      {/* ══ CAPTURE PHASES ═════════════════════════════════════════════════════ */}
      {phaseIsCapture && (
        <div className="flex-1 flex flex-col min-h-0">

          {/* Progress bar */}
          <div className="px-4 py-2 bg-gray-900/70 shrink-0">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{cfg.phaseLabels[phase] ?? phase}{isOptional ? " (אופציונלי)" : ""}</span>
              <span>{Math.max(captureIdx, 0) + 1} / {seq.length}</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(Math.max(captureIdx, 0) / seq.length) * 100}%` }} />
            </div>
          </div>

          {/* Video area */}
          <div className="relative flex-1 bg-black min-h-0 overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

            {/* Capture flash */}
            {flashCapture && <div className="absolute inset-0 bg-white pointer-events-none" style={{ opacity: 0.7, transition: "opacity 0.22s ease-out" }} />}

            {/* Phase guide overlay */}
            <PhaseGuide phase={phase} guideType={cfg.phaseGuideType[phase]} />

            {/* Stability + lighting */}
            <div className="absolute top-3 left-3 space-y-1.5 pointer-events-none">
              {[
                { label: "יציבות", val: stability, good: stability > 65 },
                { label: "תאורה",  val: lighting,  good: lighting > 25 && lighting < 90 },
              ].map(({ label, val, good }) => (
                <div key={label} className="flex items-center gap-1.5 bg-black/65 rounded-lg px-2 py-1">
                  <span className="text-gray-400 text-xs">{label}</span>
                  <div className="w-14 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-200 ${good ? "bg-green-400" : "bg-yellow-400"}`} style={{ width: `${val}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Captured count badge */}
            {capturedCount > 0 && (
              <div className="absolute top-3 right-14 bg-green-700/80 rounded-full px-2 py-0.5 text-white text-xs font-bold pointer-events-none">
                ✓ {capturedCount}
              </div>
            )}

            {/* Auto-capture ring */}
            <AutoCaptureRing progress={autoCapture} />
          </div>

          {/* Controls */}
          <div className="p-3 bg-gray-900/95 space-y-2 shrink-0">
            <p className="text-center text-yellow-300 text-sm font-medium min-h-[1.25rem]">{guidance}</p>
            <div className="flex gap-2">
              <button onClick={triggerCapture}
                className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm active:scale-95 transition-transform">
                📷 צלם
              </button>
              {isOptional && (
                <button
                  onClick={() => {
                    const next = seq[captureIdx + 1];
                    if (next) setPhase(next);
                    else if (canAnalyze) startAnalysisRef.current?.();
                  }}
                  className="px-4 py-3 rounded-xl border border-gray-700 text-gray-400 text-sm">
                  דלג
                </button>
              )}
              {canAnalyze && (
                <button onClick={() => startAnalysisRef.current?.()}
                  className="px-4 py-3 rounded-xl bg-blue-700 text-white font-bold text-sm active:scale-95 transition-transform">
                  נתח
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ ANALYZING ═══════════════════════════════════════════════════════════ */}
      {phase === "analyzing" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="text-4xl">{cfg.icon}</div>
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="space-y-2 text-center w-full max-w-xs">
            {analysisStepsRef.current.map((step, i) => (
              <p key={i} className={`text-sm transition-all duration-400 ${
                i < analysisStep ? "text-green-400" : i === analysisStep ? "text-white font-bold" : "text-gray-800"
              }`}>
                {i < analysisStep ? "✓ " : i === analysisStep ? "▸ " : "  "}{step}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ══ RESULT ══════════════════════════════════════════════════════════════ */}
      {phase === "result" && result && (() => {
        const resultCfg = ITEM_TYPE_CONFIG[itemType] ?? ITEM_TYPE_CONFIG.other;
        const sg = result.subgrades ?? {};
        return (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">

            {/* Grade badge */}
            <div className={`rounded-2xl p-6 bg-gradient-to-br ${gradeBg(result.grade)} text-center`}>
              <p className="text-white/75 text-sm font-medium mb-1">ציון AI — {resultCfg.gradeScale}</p>
              <p className="text-white text-7xl font-black leading-none mb-1">{result.grade.toFixed(1)}</p>
              <p className="text-white/90 text-lg font-semibold">{result.grade_label}</p>
              <p className="text-white/60 text-xs mt-1">{resultCfg.icon} {resultCfg.label}</p>
            </div>

            {/* Authenticity */}
            <div className={`rounded-xl p-4 flex items-center gap-3 border ${
              result.authenticity === "genuine"
                ? "bg-green-900/20 border-green-800/50"
                : result.authenticity === "suspect"
                ? "bg-yellow-900/20 border-yellow-800/50"
                : "bg-red-900/20 border-red-800/50"
            }`}>
              <span className="text-3xl">
                {result.authenticity === "genuine" ? "✅" : result.authenticity === "suspect" ? "⚠️" : "🚫"}
              </span>
              <div>
                <p className={`font-bold ${result.authenticity === "genuine" ? "text-green-300" : result.authenticity === "suspect" ? "text-yellow-300" : "text-red-300"}`}>
                  {result.authenticity === "genuine" ? "מקורי — אותנטי" : result.authenticity === "suspect" ? "חשוד — נדרשת בדיקה נוספת" : "זיוף / מניפולציה מזוהה!"}
                </p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {result.authenticity_confidence?.toFixed(0)}% ביטחון · {result.authenticity_notes}
                </p>
              </div>
            </div>

            {/* Subgrades */}
            {(sg.centering != null || sg.corners != null || sg.edges != null || sg.surfaces != null) && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">ציוני משנה</p>
                {sg.centering != null && <SubgradeBar label={resultCfg.subgradeLabels.centering} value={sg.centering} />}
                {sg.corners   != null && <SubgradeBar label={resultCfg.subgradeLabels.corners}   value={sg.corners} />}
                {sg.edges     != null && <SubgradeBar label={resultCfg.subgradeLabels.edges}      value={sg.edges} />}
                {sg.surfaces  != null && <SubgradeBar label={resultCfg.subgradeLabels.surfaces}   value={sg.surfaces} />}
              </div>
            )}

            {/* Centering — only for card/other */}
            {resultCfg.showCentering && result.centering && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">ניתוח ריכוז</p>
                <div className="flex gap-6 text-sm">
                  <div><span className="text-gray-500">שמאל/ימין: </span><span className="text-white font-medium">{result.centering.left_right}/{100 - result.centering.left_right}</span></div>
                  <div><span className="text-gray-500">עליון/תחתון: </span><span className="text-white font-medium">{result.centering.top_bottom}/{100 - result.centering.top_bottom}</span></div>
                </div>
              </div>
            )}

            {/* Issues */}
            {result.issues?.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">פגמים שזוהו ({result.issues.length})</p>
                {result.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <IssueBadge severity={issue.severity} />
                    <div>
                      <p className="text-white text-sm leading-snug">{issue.description}</p>
                      <p className="text-gray-600 text-xs">{issue.location} · {issue.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary + Recommendations */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-gray-300 text-sm leading-relaxed">{result.summary}</p>
              <div className="border-t border-gray-800 pt-3">
                <p className="text-blue-400 text-xs font-semibold mb-1">המלצה:</p>
                <p className="text-gray-400 text-sm">{result.recommendations}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={restart} className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 text-sm font-medium active:scale-95 transition-transform">
                סרוק שוב
              </button>
              <button onClick={saveResult} disabled={saving}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm active:scale-95 transition-transform">
                {saving ? "שומר..." : "💾 שמור דוח"}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ══ HISTORY ═════════════════════════════════════════════════════════════ */}
      {phase === "history" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {histLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-5xl mb-3">📋</p>
              <p className="text-gray-500">אין הערכות קודמות</p>
            </div>
          ) : (
            <>
              {(() => {
                const w = history.filter(r => r.actual_grade != null && r.ai_grade != null);
                if (!w.length) return null;
                const avgDelta = w.reduce((s, r) => s + Math.abs(r.grade_delta ?? 0), 0) / w.length;
                const exact    = w.filter(r => Math.abs(r.grade_delta ?? 9) <= 0.5).length;
                return (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 text-center mb-1">
                    <div className="flex-1">
                      <p className="text-green-400 text-xl font-bold">{((exact / w.length) * 100).toFixed(0)}%</p>
                      <p className="text-gray-500 text-xs">דיוק ±0.5</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-blue-400 text-xl font-bold">{avgDelta.toFixed(1)}</p>
                      <p className="text-gray-500 text-xs">סטיית ממוצע</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-xl font-bold">{w.length}</p>
                      <p className="text-gray-500 text-xs">דגימות</p>
                    </div>
                  </div>
                );
              })()}
              {history.map(rec => <HistoryCard key={rec.id} rec={rec} onUpdate={loadHistory} />)}
            </>
          )}
        </div>
      )}

      {/* ══ ERROR ════════════════════════════════════════════════════════════════ */}
      {phase === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-5xl">⚠️</p>
          <p className="text-red-300 font-bold text-lg">שגיאה</p>
          <p className="text-gray-400 text-sm">{errorMsg}</p>
          <button onClick={restart} className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm">
            נסה שוב
          </button>
        </div>
      )}

      {/* Hidden canvases */}
      <canvas ref={canvasRef}   className="hidden" />
      <canvas ref={analysisRef} className="hidden" />
    </div>
  );
}
