/**
 * CameraScanner — Real-time TCG card identification
 *
 * Flow:
 *  1. Open camera via getUserMedia
 *  2. ZXing BrowserMultiFormatReader scans for barcodes continuously
 *  3. On barcode → AI identifies card by barcode text (market mode query)
 *  4. "Snap & AI" button → captures frame → Claude Vision identifies card
 *  5. Result passed up via onResult callback
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { scanCardImage, type CardScanResult } from "@/lib/collectpro/ai";

interface Props {
  onResult: (card: CardScanResult) => void;
  onClose: () => void;
}

type ScanPhase =
  | "init"          // opening camera
  | "scanning"      // camera open, ZXing running
  | "barcode_found" // barcode detected, waiting to confirm
  | "identifying"   // calling AI
  | "done"          // result ready
  | "error";        // camera/AI failed

export default function CameraScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [phase, setPhase] = useState<ScanPhase>("init");
  const [barcodeText, setBarcodeText] = useState("");
  const [statusMsg, setStatusMsg] = useState("מאתחל מצלמה...");
  const [aiResult, setAiResult] = useState<CardScanResult | null>(null);
  // Track phase in a ref so ZXing callbacks don't capture stale state
  const phaseRef = useRef<ScanPhase>("init");
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Start ZXing continuous scan ─────────────────────────────────────────────
  const startZxing = useCallback(async () => {
    if (!videoRef.current) return;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    try {
      const controls = await reader.decodeFromVideoDevice(
        undefined, // default camera
        videoRef.current,
        (result) => {
          if (result && phaseRef.current !== "barcode_found" && phaseRef.current !== "identifying") {
            const text = result.getText();
            setBarcodeText(text);
            setPhase("barcode_found");
            setStatusMsg(`ברקוד: ${text}`);
            controls.stop();
          }
        }
      );
      controlsRef.current = controls;
      setPhase("scanning");
      setStatusMsg("מחפש ברקוד... או לחץ Snap לזיהוי AI");
    } catch {
      setPhase("error");
      setStatusMsg("אין גישה למצלמה");
    }
  }, []); // no dependency on phase — uses phaseRef instead

  // ── Open camera stream then start ZXing ─────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        startZxing();
      } catch {
        setPhase("error");
        setStatusMsg("לא ניתן לגשת למצלמה");
      }
    })();

    return () => {
      controlsRef.current?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Snap current frame → Claude Vision ──────────────────────────────────────
  const snapAndIdentify = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setPhase("identifying");
    setStatusMsg("Claude מזהה קלף...");

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    // Get base64 directly from canvas (JPEG, quality 0.85)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const b64 = dataUrl.split(",")[1];

    try {
      const result = await scanCardImage(b64, "image/jpeg");
      setAiResult(result);
      setPhase("done");
      setStatusMsg(result.name ? `זוהה: ${result.name}` : "לא זוהה קלף");
    } catch (err) {
      setPhase("error");
      setStatusMsg(`שגיאה: ${(err as Error).message}`);
    }
  }, []);

  // ── Identify barcode text via AI ─────────────────────────────────────────────
  const identifyBarcode = useCallback(async () => {
    if (!barcodeText) return;
    setPhase("identifying");
    setStatusMsg("Claude מזהה קלף לפי ברקוד...");

    // Use scanCardImage with a "synthetic" text-only image: render barcode as text on canvas
    try {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = 400;
      canvas.height = 200;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 400, 200);
      ctx.fillStyle = "#000";
      ctx.font = "20px monospace";
      ctx.fillText(`TCG Card Barcode: ${barcodeText}`, 20, 80);
      ctx.font = "14px sans-serif";
      ctx.fillText("Please identify this TCG card by its barcode/product code", 20, 120);

      const b64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
      const result = await scanCardImage(b64, "image/jpeg");
      setAiResult(result);
      setPhase("done");
      setStatusMsg(result.name ? `זוהה: ${result.name}` : "לא זוהה קלף");
    } catch (err) {
      setPhase("error");
      setStatusMsg(`שגיאה: ${(err as Error).message}`);
    }
  }, [barcodeText]);

  // ── Confirm result → parent ──────────────────────────────────────────────────
  const confirm = useCallback(() => {
    if (aiResult) onResult(aiResult);
    onClose();
  }, [aiResult, onResult, onClose]);

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
      style={{ touchAction: "none" }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white text-2xl font-bold bg-gray-800 rounded-full w-10 h-10 flex items-center justify-center"
      >
        ✕
      </button>

      {/* Video feed */}
      <div className="relative w-full max-w-md aspect-[4/3] bg-gray-900 overflow-hidden rounded-xl">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Scanning crosshair */}
        {(phase === "scanning" || phase === "init") && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-2 border-yellow-400 rounded-lg w-64 h-40 relative">
              {/* corners */}
              <span className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-yellow-400 rounded-tl" />
              <span className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-yellow-400 rounded-tr" />
              <span className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-yellow-400 rounded-bl" />
              <span className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-yellow-400 rounded-br" />
              {/* scanning line */}
              <div
                className="absolute inset-x-0 h-0.5 bg-yellow-400 opacity-80"
                style={{ animation: "scanline 2s ease-in-out infinite", top: "10%" }}
              />
            </div>
          </div>
        )}

        {/* Barcode detected overlay */}
        {phase === "barcode_found" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="bg-gray-900 border border-green-500 rounded-xl p-4 text-center mx-4">
              <p className="text-green-400 text-lg font-bold mb-1">✓ ברקוד זוהה!</p>
              <p className="text-white text-sm font-mono mb-3">{barcodeText}</p>
              <button
                onClick={identifyBarcode}
                className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-sm"
              >
                זהה עם Claude AI →
              </button>
            </div>
          </div>
        )}

        {/* Identifying overlay */}
        {phase === "identifying" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-yellow-400 font-bold">Claude מנתח...</p>
            </div>
          </div>
        )}

        {/* Result overlay */}
        {phase === "done" && aiResult && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="bg-gray-900 border border-blue-500 rounded-xl p-4 mx-4 w-full max-w-xs">
              <p className="text-blue-400 font-bold text-center mb-3">✓ {statusMsg}</p>
              <div className="space-y-1 text-sm mb-4">
                <p><span className="text-gray-400">שם:</span> <span className="text-white font-medium">{aiResult.name || "—"}</span></p>
                <p><span className="text-gray-400">סט:</span> <span className="text-white">{aiResult.card_set || "—"}</span></p>
                <p><span className="text-gray-400">פרנצ׳ייז:</span> <span className="text-white">{aiResult.franchise || "—"}</span></p>
                <p><span className="text-gray-400">מצב:</span> <span className="text-white">{aiResult.condition || "—"}</span></p>
                {aiResult.notes && <p><span className="text-gray-400">הערות:</span> <span className="text-white">{aiResult.notes}</span></p>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPhase("scanning"); setAiResult(null); startZxing(); }}
                  className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm"
                >
                  סרוק שוב
                </button>
                <button
                  onClick={confirm}
                  className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm"
                >
                  אשר →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {phase === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center mx-4">
              <p className="text-red-400 text-4xl mb-2">⚠</p>
              <p className="text-red-300 font-bold mb-2">שגיאה</p>
              <p className="text-gray-400 text-sm mb-4">{statusMsg}</p>
              {statusMsg.includes("גישה") && (
                <p className="text-gray-500 text-xs mb-3">
                  אפשר גישה למצלמה בהגדרות הדפדפן ורענן את הדף
                </p>
              )}
              <button
                onClick={() => { setPhase("init"); setStatusMsg("מאתחל מצלמה..."); startZxing(); }}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm"
              >
                נסה שוב
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom controls */}
      <div className="mt-4 flex items-center gap-4">
        {/* Status */}
        <p className="text-gray-400 text-sm text-center max-w-xs">{statusMsg}</p>
      </div>

      {/* Snap button (always visible when camera is open) */}
      {(phase === "scanning" || phase === "init") && (
        <button
          onClick={snapAndIdentify}
          className="mt-4 px-8 py-3 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-base shadow-lg active:scale-95 transition-transform"
        >
          📸 Snap & AI
        </button>
      )}

      <p className="text-gray-600 text-xs mt-3 text-center px-6">
        כוון את המצלמה לברקוד עבור זיהוי אוטומטי, או לחץ Snap לזיהוי AI
      </p>
    </div>
  );
}
