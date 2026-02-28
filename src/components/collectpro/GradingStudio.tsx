/**
 * GradingStudio — Professional Pre-Grading Assessment System
 *
 * Flow:
 *  intro → front → back → corners (×4) → edges → analyzing → result
 *
 * Each capture phase:
 *  • Live video stream via getUserMedia
 *  • Frame analysis loop (every 300ms): stability (pixel-diff) + lighting (luminance)
 *  • Circular progress fills when stable + well-lit → auto-capture
 *  • Phase-specific crosshair guide overlays
 *  • Hebrew real-time guidance text
 *
 * Result:
 *  • Grade badge, subgrade bars, authenticity verdict
 *  • Issues list, summary, recommendations
 *  • Save to DB — track accuracy when actual grade returned
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { gradeItem, type GradingImage, type GradingResult, type GradingIssue } from "@/lib/collectpro/ai";
import type { CollectionItem } from "@/lib/collectpro/types";

// ── Phase machine ─────────────────────────────────────────────────────────────

type GradingPhase =
  | "intro"
  | "front"
  | "back"
  | "corner_tl" | "corner_tr" | "corner_bl" | "corner_br"
  | "edge_top" | "edge_bottom" | "edge_left" | "edge_right"
  | "analyzing"
  | "result"
  | "history"
  | "error";

const CORNER_PHASES: GradingPhase[] = ["corner_tl", "corner_tr", "corner_bl", "corner_br"];
const EDGE_PHASES:   GradingPhase[] = ["edge_top", "edge_bottom", "edge_left", "edge_right"];
const CAPTURE_PHASES: GradingPhase[] = ["front", "back", ...CORNER_PHASES, ...EDGE_PHASES];

const PHASE_LABELS: Record<GradingPhase, string> = {
  intro:      "התחלה",
  front:      "חזית הקלף",
  back:       "גב הקלף",
  corner_tl:  "פינה שמאל-עליון",
  corner_tr:  "פינה ימין-עליון",
  corner_bl:  "פינה שמאל-תחתון",
  corner_br:  "פינה ימין-תחתון",
  edge_top:   "שפה עליונה",
  edge_bottom:"שפה תחתונה",
  edge_left:  "שפה שמאלית",
  edge_right: "שפה ימנית",
  analyzing:  "מנתח...",
  result:     "תוצאה",
  history:    "היסטוריה",
  error:      "שגיאה",
};

const ANALYSIS_STEPS = [
  "מנתח ריכוז ומרכוז...",
  "בודק מצב פינות...",
  "בודק מצב שפות...",
  "בודק מצב פני השטח...",
  "בודק אותנטיות...",
  "מזהה זיופים...",
  "מחשב ציון סופי...",
];

const ITEM_TYPES = [
  { value: "card",   label: "קלף בודד" },
  { value: "box",    label: "בוקס" },
  { value: "sealed", label: "אייטם אטום" },
  { value: "case",   label: "קייס" },
  { value: "other",  label: "אחר" },
];

// ── DB record type ────────────────────────────────────────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  items: CollectionItem[];
  onClose: () => void;
}

// ── Helper: capture canvas frame as base64 JPEG ───────────────────────────────

function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  quality = 0.85
): string {
  canvas.width  = Math.min(video.videoWidth || 1280, 1280);
  canvas.height = Math.min(video.videoHeight || 720, 720);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality).split(",")[1];
}

// ── Helper: analyse frame luminance (0–100) ───────────────────────────────────

function analyseLuminance(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 50;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let sum = 0;
  const step = 4 * 20; // sample every 20 pixels
  let count = 0;
  for (let i = 0; i < data.length; i += step) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    count++;
  }
  return count > 0 ? (sum / count / 255) * 100 : 50;
}

// ── Grade → colour mapping ────────────────────────────────────────────────────

function gradeColor(g: number): string {
  if (g >= 9.5) return "text-yellow-300";
  if (g >= 8.5) return "text-green-400";
  if (g >= 7)   return "text-blue-400";
  if (g >= 5)   return "text-orange-400";
  return "text-red-400";
}

function gradeBgColor(g: number): string {
  if (g >= 9.5) return "from-yellow-500 to-amber-600";
  if (g >= 8.5) return "from-green-500 to-emerald-600";
  if (g >= 7)   return "from-blue-500 to-blue-700";
  if (g >= 5)   return "from-orange-500 to-orange-700";
  return "from-red-500 to-red-700";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SubgradeBar({ label, value }: { label: string; value: number }) {
  const pct = ((value - 1) / 9) * 100;
  const color = value >= 9.5 ? "bg-yellow-400" : value >= 8 ? "bg-green-400" : value >= 6 ? "bg-blue-400" : "bg-orange-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 text-xs w-20 text-right">{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-bold w-8 ${gradeColor(value)}`}>{value.toFixed(1)}</span>
    </div>
  );
}

function AutoCaptureRing({ progress }: { progress: number }) {
  const r  = 28;
  const cx = 36;
  const cy = 36;
  const circ = 2 * Math.PI * r;
  const dash = (progress / 100) * circ;
  return (
    <svg width={72} height={72} className="absolute bottom-3 right-3 opacity-90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={4} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={progress >= 80 ? "#4ade80" : "#facc15"}
        strokeWidth={4}
        strokeDasharray={`${dash} ${circ - dash}`}
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

function IssueBadge({ severity }: { severity: GradingIssue["severity"] }) {
  const cls = severity === "minor" ? "bg-yellow-900/60 text-yellow-300 border-yellow-700"
    : severity === "moderate" ? "bg-orange-900/60 text-orange-300 border-orange-700"
    : "bg-red-900/60 text-red-300 border-red-700";
  const label = severity === "minor" ? "קל" : severity === "moderate" ? "בינוני" : "חמור";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>
  );
}

// ── Phase overlay guides ──────────────────────────────────────────────────────

function FullCardGuide() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="border-2 border-yellow-400/70 rounded-sm" style={{ width: "55%", height: "78%" }}>
        <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-yellow-400 rounded-tl" />
        <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-yellow-400 rounded-tr" />
        <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-yellow-400 rounded-bl" />
        <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-yellow-400 rounded-br" />
      </div>
    </div>
  );
}

function CornerGuide({ phase }: { phase: GradingPhase }) {
  const positions: Record<string, string> = {
    corner_tl: "top-[15%] left-[15%]",
    corner_tr: "top-[15%] right-[15%]",
    corner_bl: "bottom-[15%] left-[15%]",
    corner_br: "bottom-[15%] right-[15%]",
  };
  const pos = positions[phase] ?? "top-[15%] left-[15%]";
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className={`absolute w-20 h-20 border-2 border-yellow-400/80 rounded-sm ${pos}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1 h-full bg-yellow-400/30" />
          <div className="absolute h-1 w-full bg-yellow-400/30" />
        </div>
      </div>
    </div>
  );
}

function EdgeGuide({ phase }: { phase: GradingPhase }) {
  const isHorizontal = phase === "edge_top" || phase === "edge_bottom";
  const offset = phase === "edge_top" || phase === "edge_left" ? "10%" : undefined;
  const bottom = phase === "edge_bottom" ? "10%" : undefined;
  const right  = phase === "edge_right"  ? "10%" : undefined;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div
        className="border-2 border-yellow-400/80"
        style={{
          width:    isHorizontal ? "70%" : "8%",
          height:   isHorizontal ? "8%"  : "70%",
          position: "absolute",
          top:      offset,
          bottom,
          left:     !isHorizontal && !right ? offset : undefined,
          right,
        }}
      />
    </div>
  );
}

function PhaseGuide({ phase }: { phase: GradingPhase }) {
  if (phase === "front" || phase === "back") return <FullCardGuide />;
  if (CORNER_PHASES.includes(phase)) return <CornerGuide phase={phase} />;
  if (EDGE_PHASES.includes(phase)) return <EdgeGuide phase={phase} />;
  return null;
}

// ── History card sub-component ─────────────────────────────────────────────────

function HistoryCard({ rec, onUpdate }: { rec: GradingRecord; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [actualGrade, setActualGrade] = useState(rec.actual_grade?.toString() ?? "");
  const [grader, setGrader]   = useState(rec.actual_grader ?? "PSA");
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    setSaving(true);
    const g = parseFloat(actualGrade);
    if (isNaN(g) || g < 1 || g > 10) { setSaving(false); return; }
    await supabase
      .from("cp_grading_assessments")
      .update({ actual_grade: g, actual_grader: grader })
      .eq("id", rec.id);
    setSaving(false);
    setEditing(false);
    onUpdate();
  };

  const auth = rec.authenticity ?? "genuine";
  const authColor = auth === "genuine" ? "text-green-400" : auth === "suspect" ? "text-yellow-400" : "text-red-400";
  const authLabel = auth === "genuine" ? "✓ מקורי" : auth === "suspect" ? "⚠ חשוד" : "✗ זיוף";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{rec.item_name || "—"}</p>
          <p className="text-gray-500 text-xs">{new Date(rec.created_at).toLocaleDateString("he-IL")}</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-extrabold ${gradeColor(rec.ai_grade ?? 0)}`}>
            {rec.ai_grade?.toFixed(1) ?? "—"}
          </p>
          <p className="text-gray-500 text-xs">{rec.ai_grade_label}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className={`font-bold ${authColor}`}>{authLabel}</span>
        {rec.authenticity_confidence != null && (
          <span className="text-gray-500 text-xs">{rec.authenticity_confidence.toFixed(0)}% ביטחון</span>
        )}
      </div>

      {/* Actual grade section */}
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
              type="number" min="1" max="10" step="0.5"
              value={actualGrade}
              onChange={(e) => setActualGrade(e.target.value)}
              placeholder="ציון"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm"
            />
            <select
              value={grader}
              onChange={(e) => setGrader(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm"
            >
              {["PSA","BGS","CGC","SGC","Other"].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-1.5 rounded-lg border border-gray-700 text-gray-400 text-xs"
            >ביטול</button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold"
            >{saving ? "שומר..." : "שמור"}</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full py-1.5 rounded-lg border border-dashed border-gray-700 text-gray-500 text-xs hover:border-gray-500 transition-colors"
        >
          + הוסף ציון שהתקבל מחברת דירוג
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GradingStudio({ items, onClose }: Props) {
  // Phase state — using ref pattern to avoid stale closures in callbacks
  const [phase, _setPhase] = useState<GradingPhase>("intro");
  const phaseRef = useRef<GradingPhase>("intro");
  const setPhase = useCallback((p: GradingPhase) => {
    phaseRef.current = p;
    _setPhase(p);
  }, []);

  // Setup state
  const [itemType,  setItemType]  = useState("card");
  const [itemName,  setItemName]  = useState("");
  const [linkedId,  setLinkedId]  = useState("");

  // Camera + analysis state
  const [guidance,     setGuidance]     = useState("");
  const [stability,    setStability]    = useState(0);
  const [lighting,     setLighting]     = useState(0);
  const [autoCapture,  setAutoCapture]  = useState(0); // 0-100 progress
  const [capturedCount, setCapturedCount] = useState(0);

  // Analysis state
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result,       setResult]       = useState<GradingResult | null>(null);
  const [errorMsg,     setErrorMsg]     = useState("");

  // History
  const [history,      setHistory]      = useState<GradingRecord[]>([]);
  const [histLoading,  setHistLoading]  = useState(false);
  const [saving,       setSaving]       = useState(false);

  // Refs
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const analysisRef = useRef<HTMLCanvasElement>(null); // off-screen for pixel diff
  const streamRef   = useRef<MediaStream | null>(null);
  const loopRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const capturedRef  = useRef<GradingImage[]>([]);
  const autoCaptureRef = useRef(false); // prevents double-fire

  // ── Phase sequence ────────────────────────────────────────────────────────

  const FULL_SEQUENCE: GradingPhase[] = [
    "front", "back",
    "corner_tl", "corner_tr", "corner_bl", "corner_br",
    "edge_top", "edge_bottom", "edge_left", "edge_right",
  ];

  const nextCapturePhase = useCallback((current: GradingPhase): GradingPhase | null => {
    const idx = FULL_SEQUENCE.indexOf(current);
    if (idx === -1 || idx >= FULL_SEQUENCE.length - 1) return null;
    return FULL_SEQUENCE[idx + 1];
  }, []);

  // ── Stop camera ────────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // ── Start camera ────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setPhase("error");
      setErrorMsg("לא ניתן לגשת למצלמה. אפשר גישה בהגדרות הדפדפן.");
    }
  }, [setPhase]);

  // ── Frame analysis loop ────────────────────────────────────────────────────

  const startAnalysisLoop = useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    autoCaptureRef.current = false;

    loopRef.current = setInterval(() => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      const offscreen = analysisRef.current;
      if (!video || !canvas || !offscreen || phaseRef.current === "analyzing") return;

      // Draw small frame for analysis (320×180 is enough)
      const AW = 320, AH = 180;
      offscreen.width  = AW;
      offscreen.height = AH;
      const ctx = offscreen.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, AW, AH);

      // Luminance check
      const lum = analyseLuminance(offscreen);
      const newLighting = Math.min(100, Math.max(0, (lum - 20) / 0.55)); // 20 lux → 0%, 75 lux → 100%
      setLighting(Math.round(newLighting));

      // Stability check (pixel diff vs previous frame)
      const currentFrame = ctx.getImageData(0, 0, AW, AH);
      let diffScore = 100; // assume stable if no prev frame
      if (prevFrameRef.current) {
        let diff = 0;
        const d1 = prevFrameRef.current.data;
        const d2 = currentFrame.data;
        const step = 4 * 10; // sample every 10 pixels
        let n = 0;
        for (let i = 0; i < d1.length; i += step) {
          diff += Math.abs(d1[i] - d2[i]) + Math.abs(d1[i+1] - d2[i+1]) + Math.abs(d1[i+2] - d2[i+2]);
          n++;
        }
        const avgDiff = diff / (n * 3 * 255) * 100;
        diffScore = Math.max(0, 100 - avgDiff * 8); // scale
      }
      prevFrameRef.current = currentFrame;
      setStability(Math.round(Math.min(100, diffScore)));

      // Guidance text
      if (newLighting < 30) {
        setGuidance("💡 שפר תאורה — הקלף כהה מדי");
      } else if (newLighting > 90) {
        setGuidance("🌟 הפחת תאורה — בהיר מדי");
      } else if (diffScore < 40) {
        setGuidance("✋ החזק את הקלף יציב...");
      } else if (diffScore < 65) {
        setGuidance("⏳ המשך להחזיק יציב...");
      } else {
        const ph = phaseRef.current;
        if (ph === "front")   setGuidance("📷 כוון את חזית הקלף למסגרת");
        else if (ph === "back") setGuidance("🔄 הפוך את הקלף — כוון גב הקלף");
        else if (CORNER_PHASES.includes(ph)) setGuidance(`🔍 קרב לפינה: ${PHASE_LABELS[ph]}`);
        else if (EDGE_PHASES.includes(ph)) setGuidance(`📏 כוון את ${PHASE_LABELS[ph]} למסגרת`);
        else setGuidance("✓ מוכן!");
      }

      // Auto-capture progress
      const good = newLighting >= 30 && newLighting <= 90 && diffScore >= 65;
      setAutoCapture(prev => {
        const next = good ? Math.min(prev + 9, 100) : Math.max(prev - 20, 0);
        if (next >= 100 && !autoCaptureRef.current) {
          autoCaptureRef.current = true;
          // Trigger capture on next tick
          setTimeout(() => triggerCapture(), 0);
        }
        return next;
      });
    }, 300);
  }, []);

  // ── Capture frame ──────────────────────────────────────────────────────────

  const triggerCapture = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ph     = phaseRef.current;
    if (!video || !canvas || !CAPTURE_PHASES.includes(ph)) return;

    const b64   = captureFrame(video, canvas, 0.87);
    const label = PHASE_LABELS[ph] ?? ph;
    capturedRef.current = [...capturedRef.current, { label, base64: b64, media_type: "image/jpeg" }];
    setCapturedCount(c => c + 1);
    setAutoCapture(0);
    autoCaptureRef.current = false;
    prevFrameRef.current = null; // reset stability after capture

    // Advance to next phase
    const next = nextCapturePhase(ph);
    if (next) {
      setPhase(next);
    } else {
      // All optional — go straight to analysis if at least front+back captured
      if (capturedRef.current.length >= 2) {
        startAnalysis();
      }
    }
  }, [nextCapturePhase, setPhase]);

  // ── Start analysis ─────────────────────────────────────────────────────────

  const startAnalysis = useCallback(async () => {
    stopCamera();
    setPhase("analyzing");
    setAnalysisStep(0);

    // Animate analysis steps
    ANALYSIS_STEPS.forEach((_, i) => {
      setTimeout(() => setAnalysisStep(i), i * 800);
    });

    try {
      const res = await gradeItem(capturedRef.current, itemType);
      setResult(res);
      setPhase("result");
    } catch (err) {
      setPhase("error");
      setErrorMsg((err as Error).message);
    }
  }, [stopCamera, setPhase, itemType]);

  // ── Save result to DB ──────────────────────────────────────────────────────

  const saveResult = useCallback(async () => {
    if (!result) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    await supabase.from("cp_grading_assessments").insert({
      user_id:                user.id,
      item_id:                linkedId || null,
      item_type:              itemType,
      item_name:              itemName,
      ai_grade:               result.grade,
      ai_grade_label:         result.grade_label,
      ai_subgrades:           result.subgrades,
      centering_analysis:     result.centering,
      authenticity:           result.authenticity,
      authenticity_confidence: result.authenticity_confidence,
      authenticity_notes:     result.authenticity_notes,
      issues:                 result.issues,
      summary:                result.summary,
      recommendations:        result.recommendations,
    });

    setSaving(false);
    loadHistory();
  }, [result, itemType, itemName, linkedId]);

  // ── Load history ───────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    const { data } = await supabase
      .from("cp_grading_assessments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    setHistory((data ?? []) as GradingRecord[]);
    setHistLoading(false);
  }, []);

  // ── Lifecycle: start camera when entering a capture phase ─────────────────

  useEffect(() => {
    if (!CAPTURE_PHASES.includes(phase)) {
      stopCamera();
      return;
    }
    startCamera().then(() => startAnalysisLoop());
    return () => stopCamera();
  }, [phase]);

  // ── Restart session ────────────────────────────────────────────────────────

  const restart = useCallback(() => {
    capturedRef.current = [];
    setCapturedCount(0);
    setResult(null);
    setAutoCapture(0);
    setStability(0);
    setLighting(0);
    setGuidance("");
    setPhase("intro");
  }, [setPhase]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const captureProgress = FULL_SEQUENCE.indexOf(phase as GradingPhase);
  const totalCaptures   = FULL_SEQUENCE.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
          <div>
            <p className="text-white font-bold text-sm">סטודיו דירוג מקצועי</p>
            {phase !== "intro" && phase !== "history" && (
              <p className="text-gray-500 text-xs">{PHASE_LABELS[phase]}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phase !== "history" && (
            <button
              onClick={() => { loadHistory(); setPhase("history"); }}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700"
            >היסטוריה</button>
          )}
          {phase === "history" && (
            <button
              onClick={() => setPhase("intro")}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700"
            >← חזרה</button>
          )}
        </div>
      </div>

      {/* ── INTRO ──────────────────────────────────────────────────────────── */}
      {phase === "intro" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-800/50 rounded-2xl p-5">
            <p className="text-blue-300 font-bold text-base mb-1">מה זה סטודיו דירוג?</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              מערכת AI שסורקת את הקלף שלך מכל הזוויות ומעניקה ציון מקצועי שווה ערך לחברות דירוג כמו PSA, BGS וCGC.
              מזהה זיופים ברמת אבחון מקצועית.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-gray-300 text-sm font-medium">שם הפריט</label>
            <input
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              placeholder="לדוגמה: Charizard Base Set Holo"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-3">
            <label className="text-gray-300 text-sm font-medium">סוג הפריט</label>
            <div className="grid grid-cols-3 gap-2">
              {ITEM_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setItemType(t.value)}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    itemType === t.value
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {items.length > 0 && (
            <div className="space-y-3">
              <label className="text-gray-300 text-sm font-medium">קשר לפריט בתיק עבודות (אופציונלי)</label>
              <select
                value={linkedId}
                onChange={e => {
                  setLinkedId(e.target.value);
                  if (e.target.value) {
                    const item = items.find(i => i.id === e.target.value);
                    if (item && !itemName) setItemName(item.name);
                  }
                }}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white"
              >
                <option value="">— ללא קישור —</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.condition})</option>
                ))}
              </select>
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
            <p className="text-gray-400 text-xs font-medium">מה יסרק:</p>
            {[
              "חזית הקלף (סריקה מלאה)",
              "גב הקלף (סריקה מלאה)",
              "4 פינות (זום צמוד)",
              "4 שפות (אופציונלי)",
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-400">{i + 1}</span>
                {s}
              </div>
            ))}
          </div>

          <button
            onClick={() => setPhase("front")}
            disabled={!itemName.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            התחל סריקה →
          </button>
        </div>
      )}

      {/* ── CAPTURE PHASE ──────────────────────────────────────────────────── */}
      {CAPTURE_PHASES.includes(phase) && (
        <div className="flex-1 flex flex-col">
          {/* Progress bar */}
          <div className="px-4 py-2 bg-gray-900/60">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{PHASE_LABELS[phase]}</span>
              <span>{Math.max(captureProgress, 0) + 1} / {totalCaptures}</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(captureProgress, 0) / totalCaptures * 100}%` }}
              />
            </div>
          </div>

          {/* Video */}
          <div className="relative flex-1 bg-black overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline muted autoPlay
            />

            {/* Overlay guide */}
            <PhaseGuide phase={phase} />

            {/* Stability + lighting indicators */}
            <div className="absolute top-3 left-3 space-y-1">
              <div className="flex items-center gap-1.5 bg-black/60 rounded-lg px-2 py-1">
                <span className="text-gray-400 text-xs">יציבות</span>
                <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${stability > 70 ? "bg-green-400" : stability > 40 ? "bg-yellow-400" : "bg-red-400"}`}
                    style={{ width: `${stability}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-black/60 rounded-lg px-2 py-1">
                <span className="text-gray-400 text-xs">תאורה</span>
                <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${lighting > 30 && lighting < 90 ? "bg-green-400" : "bg-yellow-400"}`}
                    style={{ width: `${lighting}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Auto-capture ring */}
            <AutoCaptureRing progress={autoCapture} />

            {/* Captured count badge */}
            {capturedCount > 0 && (
              <div className="absolute top-3 right-3 bg-green-600/80 rounded-full px-2.5 py-1 text-white text-xs font-bold">
                ✓ {capturedCount}
              </div>
            )}
          </div>

          {/* Guidance + controls */}
          <div className="p-4 bg-gray-900/90 space-y-3">
            <p className="text-center text-yellow-300 text-sm font-medium min-h-[1.25rem]">{guidance}</p>
            <div className="flex gap-3">
              {/* Manual capture button */}
              <button
                onClick={triggerCapture}
                className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm active:scale-95 transition-transform"
              >
                📷 צלם ידנית
              </button>

              {/* Skip optional phases */}
              {(CORNER_PHASES.includes(phase) || EDGE_PHASES.includes(phase)) && (
                <button
                  onClick={() => {
                    const next = nextCapturePhase(phase);
                    if (next) setPhase(next);
                    else if (capturedRef.current.length >= 2) startAnalysis();
                  }}
                  className="px-4 py-3 rounded-xl border border-gray-700 text-gray-400 text-sm"
                >
                  דלג
                </button>
              )}

              {/* Analyse now if we have min images */}
              {capturedCount >= 2 && (
                <button
                  onClick={startAnalysis}
                  className="px-4 py-3 rounded-xl bg-blue-700 text-white font-bold text-sm"
                >
                  נתח עכשיו
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ANALYZING ──────────────────────────────────────────────────────── */}
      {phase === "analyzing" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="space-y-2 text-center">
            {ANALYSIS_STEPS.map((step, i) => (
              <p
                key={i}
                className={`text-sm transition-all duration-500 ${
                  i < analysisStep ? "text-green-400" : i === analysisStep ? "text-white font-bold" : "text-gray-700"
                }`}
              >
                {i < analysisStep ? "✓ " : i === analysisStep ? "▸ " : "  "}{step}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── RESULT ─────────────────────────────────────────────────────────── */}
      {phase === "result" && result && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
          {/* Grade badge */}
          <div className={`rounded-2xl p-5 bg-gradient-to-br ${gradeBgColor(result.grade)} text-center space-y-1`}>
            <p className="text-white/80 text-sm font-medium">ציון AI</p>
            <p className="text-white text-6xl font-black">{result.grade.toFixed(1)}</p>
            <p className="text-white/90 text-base font-semibold">{result.grade_label}</p>
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
              <p className={`font-bold ${
                result.authenticity === "genuine" ? "text-green-300"
                  : result.authenticity === "suspect" ? "text-yellow-300"
                  : "text-red-300"
              }`}>
                {result.authenticity === "genuine" ? "מקורי — אותנטי" : result.authenticity === "suspect" ? "חשוד — נדרשת בדיקה נוספת" : "זיוף מזוהה!"}
              </p>
              <p className="text-gray-400 text-xs">{result.authenticity_confidence.toFixed(0)}% ביטחון · {result.authenticity_notes}</p>
            </div>
          </div>

          {/* Subgrades */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">ציוני משנה</p>
            <SubgradeBar label="ריכוז"       value={result.subgrades.centering} />
            <SubgradeBar label="פינות"       value={result.subgrades.corners} />
            <SubgradeBar label="שפות"        value={result.subgrades.edges} />
            <SubgradeBar label="פני שטח"     value={result.subgrades.surfaces} />
          </div>

          {/* Centering analysis */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">ניתוח ריכוז</p>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-gray-500">שמאל/ימין: </span>
                <span className="text-white">{result.centering.left_right}/{100 - result.centering.left_right}</span>
              </div>
              <div>
                <span className="text-gray-500">עליון/תחתון: </span>
                <span className="text-white">{result.centering.top_bottom}/{100 - result.centering.top_bottom}</span>
              </div>
            </div>
          </div>

          {/* Issues */}
          {result.issues.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">פגמים שזוהו ({result.issues.length})</p>
              {result.issues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2">
                  <IssueBadge severity={issue.severity} />
                  <div>
                    <p className="text-white text-sm">{issue.description}</p>
                    <p className="text-gray-600 text-xs">{issue.location} · {issue.category}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary + Recommendations */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <p className="text-gray-300 text-sm">{result.summary}</p>
            <div className="border-t border-gray-800 pt-3">
              <p className="text-blue-400 text-xs font-semibold mb-1">המלצה:</p>
              <p className="text-gray-400 text-sm">{result.recommendations}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={restart}
              className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 text-sm font-medium"
            >
              סרוק שוב
            </button>
            <button
              onClick={saveResult}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm"
            >
              {saving ? "שומר..." : "💾 שמור דוח"}
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORY ─────────────────────────────────────────────────────────── */}
      {phase === "history" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {histLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-4xl mb-3">📋</p>
              <p className="text-gray-500">אין הערכות קודמות</p>
            </div>
          ) : (
            <>
              {/* Accuracy stats */}
              {(() => {
                const withActual = history.filter(r => r.actual_grade != null && r.ai_grade != null);
                if (withActual.length === 0) return null;
                const avgDelta = withActual.reduce((s, r) => s + Math.abs(r.grade_delta ?? 0), 0) / withActual.length;
                const exact    = withActual.filter(r => Math.abs(r.grade_delta ?? 9) <= 0.5).length;
                return (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 text-center">
                    <div className="flex-1">
                      <p className="text-green-400 text-xl font-bold">{((exact / withActual.length) * 100).toFixed(0)}%</p>
                      <p className="text-gray-500 text-xs">דיוק ±0.5 ציון</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-blue-400 text-xl font-bold">{avgDelta.toFixed(1)}</p>
                      <p className="text-gray-500 text-xs">סטיית ממוצע</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-xl font-bold">{withActual.length}</p>
                      <p className="text-gray-500 text-xs">דגימות</p>
                    </div>
                  </div>
                );
              })()}
              {history.map(rec => (
                <HistoryCard key={rec.id} rec={rec} onUpdate={loadHistory} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── ERROR ──────────────────────────────────────────────────────────── */}
      {phase === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-5xl">⚠️</p>
          <p className="text-red-300 font-bold">שגיאה</p>
          <p className="text-gray-400 text-sm">{errorMsg}</p>
          <button
            onClick={restart}
            className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm"
          >
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
