/**
 * GradingStudio v2 — Professional Pre-Grading Assessment System
 *
 * Critical fixes over v1:
 *  1. Camera stays alive across ALL capture phases (no restart between front/back/corners/edges)
 *  2. Auto-capture trigger moved OUT of state updater (no side-effects in setState)
 *  3. triggerCaptureRef / startAnalysisRef prevent stale closures in setInterval
 *  4. autoCaptureCountRef mirrors autoCapture state for safe interval access
 *  5. Capture flash (white → fade) as tactile feedback
 *
 * Flow:  intro → front → back → corners (×4) → edges (×4) → analyzing → result
 *        User can skip corner/edge phases or tap "Analyze now" after front+back
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { gradeItem, type GradingImage, type GradingResult, type GradingIssue } from "@/lib/collectpro/ai";
import type { CollectionItem } from "@/lib/collectpro/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants (outside component = stable references)
// ─────────────────────────────────────────────────────────────────────────────

type GradingPhase =
  | "intro"
  | "front" | "back"
  | "corner_tl" | "corner_tr" | "corner_bl" | "corner_br"
  | "edge_top"  | "edge_bottom" | "edge_left" | "edge_right"
  | "analyzing" | "result" | "history" | "error";

const CORNER_PHASES: GradingPhase[] = ["corner_tl", "corner_tr", "corner_bl", "corner_br"];
const EDGE_PHASES:   GradingPhase[] = ["edge_top", "edge_bottom", "edge_left", "edge_right"];

const FULL_SEQUENCE: GradingPhase[] = [
  "front", "back",
  "corner_tl", "corner_tr", "corner_bl", "corner_br",
  "edge_top", "edge_bottom", "edge_left", "edge_right",
];

const CAPTURE_PHASES = new Set<GradingPhase>(FULL_SEQUENCE);

const PHASE_LABELS: Record<GradingPhase, string> = {
  intro:       "התחלה",
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
  analyzing:   "מנתח...",
  result:      "תוצאה",
  history:     "היסטוריה",
  error:       "שגיאה",
};

const ANALYSIS_STEPS = [
  "מנתח ריכוז ומרכוז...",
  "בודק מצב פינות...",
  "בודק מצב שפות...",
  "בודק מצב פני השטח...",
  "בודק אותנטיות ופרינט...",
  "מזהה זיופים ברמת מומחה...",
  "מחשב ציון סופי...",
];

const ITEM_TYPES = [
  { value: "card",   label: "קלף" },
  { value: "box",    label: "בוקס" },
  { value: "sealed", label: "אייטם אטום" },
  { value: "case",   label: "קייס" },
  { value: "other",  label: "אחר" },
];

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
  const cls = severity === "minor" ? "bg-yellow-900/60 text-yellow-300 border-yellow-700"
    : severity === "moderate"      ? "bg-orange-900/60 text-orange-300 border-orange-700"
    :                                "bg-red-900/60    text-red-300    border-red-700";
  return <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${cls}`}>{severity === "minor" ? "קל" : severity === "moderate" ? "בינוני" : "חמור"}</span>;
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

function PhaseGuide({ phase }: { phase: GradingPhase }) {
  if (phase === "front" || phase === "back") return <FullCardGuide />;
  if (CORNER_PHASES.includes(phase)) return <CornerGuide phase={phase} />;
  if (EDGE_PHASES.includes(phase))   return <EdgeGuide   phase={phase} />;
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
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{rec.item_name || "—"}</p>
          <p className="text-gray-500 text-xs">{new Date(rec.created_at).toLocaleDateString("he-IL")}</p>
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
              {["PSA","BGS","CGC","SGC","Other"].map(g => <option key={g}>{g}</option>)}
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

  // When initialItem is supplied we start directly in "front" phase (skip intro)
  const startPhase: GradingPhase = initialItem ? "front" : "intro";

  // ── Phase (ref-synced to avoid stale closures) ───────────────────────────
  const [phase, _setPhase] = useState<GradingPhase>(startPhase);
  const phaseRef = useRef<GradingPhase>(startPhase);
  const setPhase = useCallback((p: GradingPhase) => { phaseRef.current = p; _setPhase(p); }, []);

  // ── Setup ─────────────────────────────────────────────────────────────────
  const [itemType,  setItemType]  = useState("card");
  const [itemName,  setItemName]  = useState(initialItem?.name ?? "");
  const [linkedId,  setLinkedId]  = useState(initialItem?.id ?? "");

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
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);   // high-res capture
  const analysisRef   = useRef<HTMLCanvasElement>(null);   // 320×180 analysis

  // ── Lifecycle refs ────────────────────────────────────────────────────────
  const streamRef         = useRef<MediaStream | null>(null);
  const loopRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevFrameRef      = useRef<ImageData | null>(null);
  const capturedRef       = useRef<GradingImage[]>([]);
  const autoCaptureRef    = useRef(false);       // prevents double-fire when ring hits 100
  const autoCaptureCount  = useRef(0);           // mirrors autoCapture state for safe interval reads
  const itemTypeRef       = useRef(itemType);    // always-fresh itemType for callbacks
  useEffect(() => { itemTypeRef.current = itemType; }, [itemType]);

  // ── Stable callback refs (prevent stale closures across re-renders) ───────
  const triggerCaptureRef = useRef<(() => void) | null>(null);
  const startAnalysisRef  = useRef<(() => Promise<void>) | null>(null);

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
      // Prefer back camera on mobile; fall back gracefully
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        // Some iOS versions require a user-gesture to play — muted + playsInline handles this
        await video.play();
      }
    } catch {
      setPhase("error");
      setErrorMsg("לא ניתן לגשת למצלמה. אפשר גישה בהגדרות הדפדפן ונסה שוב.");
    }
  }, [setPhase]);

  // ─────────────────────────────────────────────────────────────────────────
  // Frame analysis loop (300 ms)
  // KEY FIX: all callbacks called via refs — no stale closure risk
  // KEY FIX: trigger auto-capture OUTSIDE state updater
  // ─────────────────────────────────────────────────────────────────────────

  const startAnalysisLoop = useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    autoCaptureRef.current    = false;
    autoCaptureCount.current  = 0;
    prevFrameRef.current      = null;

    loopRef.current = setInterval(() => {
      const video     = videoRef.current;
      const offscreen = analysisRef.current;
      if (!video || !offscreen || !streamRef.current) return;
      if (phaseRef.current === "analyzing") return;

      // ── Luminance ──────────────────────────────────────────────────────────
      const AW = 320, AH = 180;
      offscreen.width  = AW;
      offscreen.height = AH;
      const ctx = offscreen.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, AW, AH);

      const lum        = analyseLuminance(offscreen);
      const newLighting = Math.min(100, Math.max(0, (lum - 15) / 0.6)); // 15→0%, 75→100%
      setLighting(Math.round(newLighting));

      // ── Stability (pixel diff) ─────────────────────────────────────────────
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

      // ── Hebrew guidance ─────────────────────────────────────────────────────
      if (newLighting < 25) {
        setGuidance("💡 שפר תאורה — הקלף כהה מדי");
      } else if (newLighting > 92) {
        setGuidance("🌟 הפחת תאורה — בהיר מדי");
      } else if (diffScore < 35) {
        setGuidance("✋ החזק את הקלף יציב...");
      } else if (diffScore < 60) {
        setGuidance("⏳ המשך להחזיק יציב...");
      } else {
        const ph = phaseRef.current;
        if      (ph === "front")             setGuidance("📷 כוון את חזית הקלף למסגרת");
        else if (ph === "back")              setGuidance("🔄 הפוך את הקלף — כוון גב הקלף");
        else if (CORNER_PHASES.includes(ph)) setGuidance(`🔍 קרב לפינה: ${PHASE_LABELS[ph]}`);
        else if (EDGE_PHASES.includes(ph))   setGuidance(`📏 כוון: ${PHASE_LABELS[ph]}`);
        else                                  setGuidance("✓ מוכן!");
      }

      // ── Auto-capture progress ──────────────────────────────────────────────
      // KEY FIX: use ref for counter; trigger capture OUTSIDE setState
      const isGood = newLighting >= 25 && newLighting <= 92 && diffScore >= 60;
      const prevAC = autoCaptureCount.current;
      const newAC  = isGood ? Math.min(prevAC + 9, 100) : Math.max(prevAC - 20, 0);
      autoCaptureCount.current = newAC;
      setAutoCapture(newAC);

      if (newAC >= 100 && !autoCaptureRef.current) {
        autoCaptureRef.current = true;
        // Brief delay: let the ring visually reach 100% before capture flash
        setTimeout(() => triggerCaptureRef.current?.(), 120);
      }
    }, 300);
  }, []); // no deps — uses only refs

  // ─────────────────────────────────────────────────────────────────────────
  // Capture frame
  // KEY FIX: calls startAnalysisRef.current (always latest) instead of direct call
  // ─────────────────────────────────────────────────────────────────────────

  const triggerCapture = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ph     = phaseRef.current;
    if (!video || !canvas || !CAPTURE_PHASES.has(ph)) return;

    const b64 = captureFrame(video, canvas, 0.87);
    capturedRef.current = [...capturedRef.current, { label: PHASE_LABELS[ph], base64: b64, media_type: "image/jpeg" }];
    setCapturedCount(c => c + 1);

    // Reset capture state
    setAutoCapture(0);
    autoCaptureCount.current  = 0;
    autoCaptureRef.current    = false;
    prevFrameRef.current      = null;

    // Flash feedback
    setFlashCapture(true);
    setTimeout(() => setFlashCapture(false), 220);

    // Advance phase
    const seqIdx = FULL_SEQUENCE.indexOf(ph);
    const next   = seqIdx < FULL_SEQUENCE.length - 1 ? FULL_SEQUENCE[seqIdx + 1] : null;
    if (next) {
      setPhase(next);
    } else if (capturedRef.current.length >= 2) {
      startAnalysisRef.current?.();
    }
  }, [setPhase]); // stable — all mutable state accessed via refs

  // Keep triggerCaptureRef always pointing to latest triggerCapture
  useEffect(() => { triggerCaptureRef.current = triggerCapture; }, [triggerCapture]);

  // ─────────────────────────────────────────────────────────────────────────
  // AI analysis
  // ─────────────────────────────────────────────────────────────────────────

  const startAnalysis = useCallback(async () => {
    stopCamera();
    setPhase("analyzing");
    setAnalysisStep(0);
    ANALYSIS_STEPS.forEach((_, i) => setTimeout(() => setAnalysisStep(i), i * 900));

    try {
      const res = await gradeItem(capturedRef.current, itemTypeRef.current);
      setResult(res);
      setPhase("result");
    } catch (err) {
      setPhase("error");
      setErrorMsg((err as Error).message);
    }
  }, [stopCamera, setPhase]); // itemType read via ref — no dep needed

  // Keep startAnalysisRef always pointing to latest startAnalysis
  useEffect(() => { startAnalysisRef.current = startAnalysis; }, [startAnalysis]);

  // ─────────────────────────────────────────────────────────────────────────
  // Camera lifecycle
  // KEY FIX: keep stream alive across capture phases (no restart between front/back/corners)
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const inCapture = CAPTURE_PHASES.has(phase);
    if (!inCapture) {
      stopCamera();
      return;
    }
    // If stream is already running, just reset the analysis loop (new phase → reset stability)
    if (streamRef.current) {
      autoCaptureCount.current = 0;
      autoCaptureRef.current   = false;
      prevFrameRef.current     = null;
      setAutoCapture(0);
      setGuidance("");
      return;
    }
    // First capture phase — start camera and loop
    startCamera().then(() => startAnalysisLoop());
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), []); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [result, itemName, linkedId]);

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
    // If opened via initialItem, restart directly to scan (not intro)
    setPhase(initialItem ? "front" : "intro");
  }, [setPhase, initialItem]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived
  // ─────────────────────────────────────────────────────────────────────────

  const captureIdx   = FULL_SEQUENCE.indexOf(phase as GradingPhase);
  const phaseIsCapture = CAPTURE_PHASES.has(phase);
  const canAnalyze   = capturedCount >= 2;

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
            <p className="text-white font-bold text-sm leading-tight">סטודיו דירוג מקצועי</p>
            {phaseIsCapture && (
              <p className="text-gray-500 text-xs">
                {itemName ? `${itemName} — ` : ""}{PHASE_LABELS[phase]}
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
          <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-800/50 rounded-2xl p-5">
            <p className="text-blue-300 font-bold mb-1">מה זה סטודיו דירוג?</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              סורק את הקלף מכל הזוויות ומעניק ציון AI ברמת PSA / BGS / CGC — כולל זיהוי זיופים ברמת מומחה.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">שם הפריט</label>
            <input
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              placeholder="לדוגמה: Charizard Base Set Holo"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">סוג הפריט</label>
            <div className="flex gap-2 flex-wrap">
              {ITEM_TYPES.map(t => (
                <button key={t.value} onClick={() => setItemType(t.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    itemType === t.value ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
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

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">מה יסרק:</p>
            {["חזית הקלף (סריקה מלאה)", "גב הקלף (סריקה מלאה)", "4 פינות (זום צמוד)", "4 שפות (אופציונלי)"].map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs">{i + 1}</span>
                {s}
              </div>
            ))}
          </div>

          <button onClick={() => setPhase("front")} disabled={!itemName.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform">
            התחל סריקה →
          </button>
        </div>
      )}

      {/* ══ CAPTURE PHASES ═════════════════════════════════════════════════════ */}
      {phaseIsCapture && (
        <div className="flex-1 flex flex-col min-h-0">

          {/* Progress bar */}
          <div className="px-4 py-2 bg-gray-900/70 shrink-0">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{PHASE_LABELS[phase]}</span>
              <span>{Math.max(captureIdx, 0) + 1} / {FULL_SEQUENCE.length}</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(Math.max(captureIdx, 0) / FULL_SEQUENCE.length) * 100}%` }} />
            </div>
          </div>

          {/* Video area */}
          <div className="relative flex-1 bg-black min-h-0 overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

            {/* Capture flash */}
            {flashCapture && <div className="absolute inset-0 bg-white pointer-events-none" style={{ opacity: 0.7, transition: "opacity 0.22s ease-out" }} />}

            {/* Phase guide overlay */}
            <PhaseGuide phase={phase} />

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
              {(CORNER_PHASES.includes(phase) || EDGE_PHASES.includes(phase)) && (
                <button
                  onClick={() => {
                    const next = FULL_SEQUENCE[captureIdx + 1];
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
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="space-y-2 text-center w-full max-w-xs">
            {ANALYSIS_STEPS.map((step, i) => (
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
      {phase === "result" && result && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">

          {/* Grade badge */}
          <div className={`rounded-2xl p-6 bg-gradient-to-br ${gradeBg(result.grade)} text-center`}>
            <p className="text-white/75 text-sm font-medium mb-1">ציון AI מקצועי</p>
            <p className="text-white text-7xl font-black leading-none mb-1">{result.grade.toFixed(1)}</p>
            <p className="text-white/90 text-lg font-semibold">{result.grade_label}</p>
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
                {result.authenticity === "genuine" ? "מקורי — אותנטי" : result.authenticity === "suspect" ? "חשוד — נדרשת בדיקה נוספת" : "זיוף מזוהה!"}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">{result.authenticity_confidence.toFixed(0)}% ביטחון · {result.authenticity_notes}</p>
            </div>
          </div>

          {/* Subgrades */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">ציוני משנה</p>
            <SubgradeBar label="ריכוז"    value={result.subgrades.centering} />
            <SubgradeBar label="פינות"    value={result.subgrades.corners} />
            <SubgradeBar label="שפות"     value={result.subgrades.edges} />
            <SubgradeBar label="פני שטח" value={result.subgrades.surfaces} />
          </div>

          {/* Centering */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">ניתוח ריכוז</p>
            <div className="flex gap-6 text-sm">
              <div><span className="text-gray-500">שמאל/ימין: </span><span className="text-white font-medium">{result.centering.left_right}/{100 - result.centering.left_right}</span></div>
              <div><span className="text-gray-500">עליון/תחתון: </span><span className="text-white font-medium">{result.centering.top_bottom}/{100 - result.centering.top_bottom}</span></div>
            </div>
          </div>

          {/* Issues */}
          {result.issues.length > 0 && (
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
      )}

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
              {/* Accuracy stats */}
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
