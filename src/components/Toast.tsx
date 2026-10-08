"use client";

// ---------------------------------------------------------------------------
// Area11 - Counter par fori ittila (Spec 4: real-time notifications)
// ---------------------------------------------------------------------------
// Toast  = chhoti chhoti khidki jo ooper se aati hain aur 4 second me khud
//          chali jati hain (qeemati tabdeeli, kam stock, wagerah)
// Banner = bara surkh patti jo tab tak rahti hai jab tak masla rahe
//          (masalan stock MINUS me ja raha ho)
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastKind = "info" | "success" | "warn" | "error";

export type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
};

const STYLE: Record<ToastKind, { box: string; icon: React.ReactNode }> = {
  info: { box: "border-sky-200 bg-sky-50 text-sky-800", icon: <Info className="h-4 w-4" /> },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: <CheckCircle2 className="h-4 w-4" /> },
  warn: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: <AlertTriangle className="h-4 w-4" /> },
  error: { box: "border-rose-200 bg-rose-50 text-rose-800", icon: <AlertTriangle className="h-4 w-4" /> },
};

/** Har component me ye hook lagayein: const { toasts, push, dismiss } = useToasts(); */
export function useToasts(autoHideMs = 4500) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);
  const push = useCallback(
    (kind: ToastKind, title: string, detail?: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, kind, title, detail }]);
      if (autoHideMs > 0) setTimeout(() => dismiss(id), autoHideMs);
      return id;
    },
    [autoHideMs, dismiss]
  );
  return { toasts, push, dismiss };
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2">
      {toasts.map((t) => {
        const s = STYLE[t.kind];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg ${s.box}`}
          >
            <span className="mt-0.5">{s.icon}</span>
            <div className="flex-1">
              <div className="font-semibold">{t.title}</div>
              {t.detail && <div className="mt-0.5 opacity-90">{t.detail}</div>}
            </div>
            <button className="opacity-60 hover:opacity-100" onClick={() => onDismiss(t.id)} aria-label="close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Spec 1.2: stock MINUS me jane wala bara surkh alert -- screen ke BILKUL ooper.
 * Jab tak masla rahe, ye patti rahegi (koi "close" nahi, masla hi door karein).
 */
export function AlertBanner({
  title,
  children,
  tone = "danger",
}: {
  title: string;
  children?: React.ReactNode;
  tone?: "danger" | "warn" | "info";
}) {
  const toneCls =
    tone === "danger"
      ? "border-rose-300 bg-rose-100 text-rose-900"
      : tone === "warn"
      ? "border-amber-300 bg-amber-100 text-amber-900"
      : "border-sky-300 bg-sky-100 text-sky-900";
  return (
    <div className={`sticky top-0 z-40 rounded-lg border-2 px-3 py-2 shadow-md ${toneCls}`}>
      <div className="flex items-center gap-2 text-sm font-bold">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{title}</span>
      </div>
      {children && <div className="mt-1 space-y-1 pl-6 text-xs">{children}</div>}
    </div>
  );
}
