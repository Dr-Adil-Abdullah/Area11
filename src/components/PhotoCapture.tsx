"use client";

// Area11 - Camera se seedhi tasveer (product / customer ke safhe par)
// ---------------------------------------------------------------------------
// Kaam: mobile ya laptop ke camera se photo lein, chhoti kar ke wapas dein.
// Magar camera har jagah nahi chalta: browser is ke liye **secure origin**
// (https:// ya http://localhost) mangta hai. Dukan ke LAN par (http://192.168…)
// camera band rahega -- is liye hum file chunne wala raasta hamesha khula
// rakhte hain aur wajah saaf batate hain.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, SwitchCamera, X } from "lucide-react";

type Props = {
  /** Tasveer tayyar ho jaye to yeh chalega (chhoti ki hui data-URL) */
  onCapture: (dataUrl: string) => void | Promise<void>;
  /** Chhota label (masalan "Camera") */
  label?: string;
  className?: string;
};

/** Camera ka istemal ho sakta hai ya nahi */
export function cameraSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Secure origin hai? (https / localhost) -- warna camera band */
export function secureOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return window.isSecureContext || h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

export default function PhotoCapture({ onCapture, label = "Camera", className }: Props) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function start() {
    setErr("");
    setStarting(true);
    try {
      if (!cameraSupported()) throw new Error("Is browser me camera ka intezam nahi hai.");
      if (!secureOrigin()) {
        throw new Error(
          "Camera sirf https:// ya localhost par chalta hai. Dukan ke LAN (http://192.168…) par neeche diye " +
            "'File chunein' se photo lagayein."
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.name === "NotAllowedError"
            ? "Ijazat nahi mili — browser me camera ki ijazat dein, phir dobara koshish karein."
            : e.name === "NotFoundError"
              ? "Koi camera nahi mila (device me camera maujood nahi ya band hai)."
              : e.message
          : "Camera khol nahi saka."
      );
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facing]);

  async function shoot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setBusy(true);
    try {
      // seedha video frame -> canvas -> chhoti JPEG
      const max = 900;
      const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
      const w = Math.round(v.videoWidth * scale);
      const h = Math.round(v.videoHeight * scale);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Canvas tayyar nahi ho saka.");
      if (facing === "user") {
        // aage wala camera: aaina jaisi tasveer theek karein
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(v, 0, 0, w, h);
      const dataUrl = c.toDataURL("image/jpeg", 0.78);
      await onCapture(dataUrl);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Tasveer nahi ban saki.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className ?? "btn-secondary"}
        onClick={() => setOpen(true)}
        title="Camera se tasveer lein"
      >
        <Camera className="h-4 w-4" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <div className="font-semibold">Camera se tasveer</div>
              <button className="rounded p-1 hover:bg-slate-100" onClick={() => setOpen(false)} aria-label="band karein">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} playsInline muted className="h-72 w-full object-contain" />
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> camera khul raha hai…
                </div>
              )}
            </div>

            {err && <div className="bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-3">
              <button
                className="btn-secondary"
                onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                disabled={starting}
              >
                <SwitchCamera className="h-4 w-4" /> {facing === "environment" ? "Pichla camera" : "Aage wala"}
              </button>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => setOpen(false)}>Band karein</button>
                <button className="btn-primary" onClick={shoot} disabled={busy || starting || !!err}>
                  <Camera className="h-4 w-4" /> {busy ? "…" : "Tasveer lein"}
                </button>
              </div>
            </div>

            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
              Tasveer device par hi chhoti kar di jati hai (badi file server par nahi jati).
            </p>
          </div>
        </div>
      )}
    </>
  );
}
