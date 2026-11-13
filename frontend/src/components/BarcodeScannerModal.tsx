"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  X,
  Flashlight,
  FlashlightOff,
  Camera,
  AlertCircle,
  RotateCcw,
  Barcode as BarcodeIcon,
  CheckCircle2,
  ScanLine,
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
  subtitle?: string;
}

/** Plays an 800Hz sine beep for 100ms using the Web Audio API */
function playScanBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 150);
  } catch {
    // Audio context may be restricted before user gesture
  }
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "ባርኮድ ስካነር",
  subtitle = "Align barcode or QR code inside the box",
}: BarcodeScannerModalProps) {
  const scannerContainerId = "waga-html5-barcode-scanner";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef<boolean>(false);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>("");
  const [scannedCodeFeedback, setScannedCodeFeedback] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // Safe to ignore cleanup stop errors
      } finally {
        scannerRef.current = null;
        setCameraActive(false);
        setTorchOn(false);
        setTorchAvailable(false);
      }
    }
  }, []);

  const handleSuccessfulScan = useCallback(
    (decodedText: string) => {
      if (scannedRef.current) return;
      scannedRef.current = true;

      // 1. Play 800Hz audio beep for 100ms
      playScanBeep();

      // 2. Vibrate phone if supported
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([80, 40, 80]);
        } catch {
          // Ignore
        }
      }

      setScannedCodeFeedback(decodedText);

      // 3. Stop scanner and invoke callback
      setTimeout(async () => {
        await stopScanner();
        onScan(decodedText);
        onClose();
      }, 350);
    },
    [onScan, onClose, stopScanner]
  );

  const startScanner = useCallback(async () => {
    setCameraError(null);
    scannedRef.current = false;
    setScannedCodeFeedback(null);

    try {
      if (scannerRef.current) {
        await stopScanner();
      }

      const html5QrCode = new Html5Qrcode(scannerContainerId, {
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      const qrboxSize = { width: 280, height: 180 };

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: qrboxSize,
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // Frame parse error: continuous scanning, keep listening silently
        }
      );

      setCameraActive(true);

      // Inspect torch/flashlight capability on active camera track
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities() as MediaTrackCapabilities & {
          torch?: boolean;
        };
        if (capabilities && "torch" in capabilities && capabilities.torch) {
          setTorchAvailable(true);
        } else {
          setTorchAvailable(false);
        }
      } catch {
        setTorchAvailable(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowedError")) {
        setCameraError("የካሜራ ፈቃድ አልተሰጠም። እባክዎ በስልክዎ Settings ውስጥ የካሜራ ፈቃድ ይፍቀዱ (Camera permission denied)");
      } else if (msg.includes("NotFoundError") || msg.includes("Requested device not found")) {
        setCameraError("ካሜራ ማግኘት አልተቻለም (No camera device found)");
      } else {
        setCameraError(`ካሜራ ማስጀመር አልተቻለም፦ ${msg}`);
      }
      setCameraActive(false);
    }
  }, [handleSuccessfulScan, stopScanner]);

  useEffect(() => {
    if (isOpen) {
      scannedRef.current = false;
      setManualCode("");
      setScannedCodeFeedback(null);
      // Wait for DOM element render before attaching html5-qrcode
      const timer = setTimeout(() => {
        startScanner();
      }, 150);

      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, startScanner, stopScanner]);

  // Flashlight / Torch toggle handler
  const toggleTorch = async () => {
    if (!scannerRef.current || !torchAvailable) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        // @ts-expect-error advanced torch is a standard mobile constraint in WebRTC
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {
      // Torch toggle not supported on this track
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (!clean) return;
    handleSuccessfulScan(clean);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/95 flex flex-col items-center justify-between animate-in fade-in duration-200 select-none overflow-hidden">
      {/* Top Header Bar */}
      <div className="w-full max-w-md px-4 py-3.5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
              <span>{title}</span>
              <span className="text-[10px] text-blue-400 font-mono font-bold">(Scan)</span>
            </h2>
            <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Torch / Flashlight Toggle */}
          {torchAvailable && cameraActive && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
                torchOn
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30 font-black"
                  : "bg-slate-900 border-slate-700/80 text-slate-300 hover:text-white"
              }`}
              title={torchOn ? "መብራት አጥፋ" : "መብራት አብራ"}
              aria-label="Toggle Torch"
            >
              {torchOn ? <Flashlight className="w-4 h-4 fill-current" /> : <FlashlightOff className="w-4 h-4" />}
            </button>
          )}

          {/* Close "ዝጋ" Button */}
          <button
            type="button"
            onClick={async () => {
              await stopScanner();
              onClose();
            }}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 border border-slate-700/80 text-xs font-black text-slate-200 hover:text-white active:scale-95 transition-all flex items-center gap-1.5"
            aria-label="Close Scanner"
          >
            <X className="w-4 h-4" />
            <span>ዝጋ</span>
          </button>
        </div>
      </div>

      {/* Main Scanner Center Area */}
      <div className="relative flex-1 w-full max-w-md flex flex-col items-center justify-center overflow-hidden">
        {/* html5-qrcode Video DOM Container */}
        <div
          id={scannerContainerId}
          className="w-full h-full max-h-[500px] flex items-center justify-center overflow-hidden [&_video]:object-cover [&_video]:w-full [&_video]:h-full"
        />

        {/* Viewfinder Reticle Overlay (Electric Blue Styling) */}
        {cameraActive && !scannedCodeFeedback && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {/* Reticle Box */}
            <div className="relative w-[280px] h-[180px] border-2 border-blue-500 rounded-2xl shadow-[0_0_25px_rgba(59,130,246,0.5)] overflow-hidden flex flex-col justify-between p-2">
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400 rounded-br-xl" />

              {/* Animated Laser Scanning Line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_8px_#38bdf8] animate-pulse my-auto" />
            </div>

            {/* Hint Under Reticle */}
            <div className="mt-4 px-4 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 text-[11px] font-bold text-slate-300 flex items-center gap-1.5 shadow-md">
              <Camera className="w-3.5 h-3.5 text-blue-400" />
              <span>ባርኮዱን ወይም QR ኮዱን በሳጥኑ ውስጥ ያሳዩ</span>
            </div>
          </div>
        )}

        {/* Success Confirmation Toast Overlay */}
        {scannedCodeFeedback && (
          <div className="absolute inset-0 bg-blue-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3 z-30 animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-600/50">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">ባርኮዱ ተነቧል!</h3>
              <p className="text-xs font-mono font-bold text-blue-300 bg-slate-900/80 px-3 py-1 rounded-lg border border-blue-400/40 mt-1.5 break-all">
                {scannedCodeFeedback}
              </p>
            </div>
          </div>
        )}

        {/* Camera Permission / Error State */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-3 z-30">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-white">ካሜራውን መክፈት አልተቻለም</h3>
              <p className="text-xs text-rose-300 font-medium max-w-xs">{cameraError}</p>
            </div>
            <button
              type="button"
              onClick={startScanner}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold active:scale-95 transition-all shadow-md shadow-blue-600/30"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>እንደገና ሞክር (Retry)</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Area: Manual Barcode Entry Fallback */}
      <div className="w-full max-w-md p-4 bg-slate-950 border-t border-slate-800 z-20 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <BarcodeIcon className="w-3.5 h-3.5 text-blue-400" />
            <span>ወይም ባርኮድ በእጅ ያስገቡ (Manual Input)</span>
          </span>
        </div>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="ምሳሌ፦ 6923456789012"
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-bold"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white text-xs font-black shadow-md shadow-blue-600/30 border border-blue-400/30 active:scale-95 transition-all"
          >
            አስገባ
          </button>
        </form>
      </div>
    </div>
  );
}
