"use client";

// ---------------------------------------------------------------------------
// Area11 - GLOBAL ALERT BAR (U-25 / U-30 / U-31 / U-33)
// ---------------------------------------------------------------------------
// Malik ke hukum:
//   * manfi stock (ya koi bhi alert) KAAM KABHI NAHI ROKTA -- sirf nazar aata hai
//   * alert HAR SAFHE ke bilkul ooper rahe ga
//   * use sirf MALIK khatam kar sakta hai -- WAJAH likh kar
//   * wajah mehfooz hoti hai (DB + black box), session/browser se farq nahi parta
// ---------------------------------------------------------------------------

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type GlobalAlert = {
  key: string;
  type: string;
  tone: "red" | "amber";
  title: string;
  detail: string;
  entityId: number | null;
  href: string;
};

const RED =
  "border-rose-300 bg-rose-100 text-rose-900";
const AMBER =
  "border-amber-300 bg-amber-100 text-amber-900";

export default function AlertBar({
  alerts,
  canDismiss,
}: {
  alerts: GlobalAlert[];
  /** sirf malik (owner) alerts khatam kar sakta hai */
  canDismiss: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [askKey, setAskKey] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!alerts.length) return null;
  const first = alerts[0];

  async function dismiss(key: string, type: string, entityId: number | null) {
    setErr(null);
    if (reason.trim().length < 3) {
      setErr("Wajah likhein (kam az kam 3 harf) — bina wajah ke alert khatam nahi hota.");
      return;
    }
    setBusy(key);
    try {
      const res = await fetch("/api/alerts/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, type, entityId, reason }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) throw new Error(data.error || "Alert khatam na ho saka.");
      setAskKey(null);
      setReason("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Alert khatam na ho saka.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="sticky top-0 z-40 border-b-2">
      {/* ---- sab se ahem alert (hamesha nazar aaye) ---- */}
      <div
        className={`flex flex-wrap items-center gap-2 px-4 py-2 text-sm ${first.tone === "red" ? RED : AMBER}`}
      >
        <span className="text-base leading-none">⚠</span>
        <span className="font-bold">{first.title}</span>
        {alerts.length > 1 && (
          <button
            className="rounded border border-current px-2 py-0.5 text-xs font-semibold"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Chhupayein" : `+${alerts.length - 1} aur alerts`}
          </button>
        )}
        <Link href="/alerts" className="text-xs font-semibold underline">
          Alerts ka safha
        </Link>
        {canDismiss ? (
          <button
            className="ml-auto rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700"
            onClick={() => {
              setAskKey((k) => (k === first.key ? null : first.key));
              setErr(null);
            }}
          >
            {askKey === first.key ? "Band karein" : "Wajah likh kar khatam karein"}
          </button>
        ) : (
          <span className="ml-auto text-xs opacity-80">
            Sirf malik (owner) wajah likh kar is alert ko khatam kar sakte hain.
          </span>
        )}
      </div>

      {/* ---- wajah likhne ki jagah (sirf malik) ---- */}
      {askKey && (
        <div className={`px-4 pb-3 pt-1 text-sm ${alerts.find((a) => a.key === askKey)?.tone === "red" ? RED : AMBER}`}>
          <div className="max-w-2xl">
            <div className="mb-1 text-xs font-semibold">
              Is alert ko khatam karne ki wajah likhein (mehfooz ho jaye gi — black box me bhi darj):
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="masalan: ginti galat thi, purchase darj ho gaya hai / maal supplier ko wapas mil gaya"
              className="w-full rounded border border-slate-400 bg-white/90 px-2 py-1 text-sm text-slate-900 outline-none"
            />
            {err && <div className="mt-1 text-xs font-semibold text-rose-700">{err}</div>}
            <div className="mt-2 flex gap-2">
              <button
                disabled={busy === askKey}
                onClick={() => {
                  const a = alerts.find((x) => x.key === askKey);
                  if (a) void dismiss(a.key, a.type, a.entityId);
                }}
                className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy === askKey ? "Mehfooz ho raha hai…" : "Wajah mehfooz karein aur alert khatam karein"}
              </button>
              <button
                className="rounded border border-current px-3 py-1 text-xs font-semibold"
                onClick={() => {
                  setAskKey(null);
                  setReason("");
                  setErr(null);
                }}
              >
                Manna kar dein
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- baqi alerts ki fehrist ---- */}
      {open && alerts.length > 1 && (
        <div className={`max-h-64 overflow-auto px-4 pb-3 text-sm ${first.tone === "red" ? RED : AMBER}`}>
          <ul className="space-y-2">
            {alerts.slice(1).map((a) => (
              <li key={a.key} className="rounded border border-current/30 bg-white/60 p-2">
                <div className="font-semibold">{a.title}</div>
                <div className="text-xs opacity-90">{a.detail}</div>
                {canDismiss && (
                  <button
                    className="mt-1 rounded border border-current px-2 py-0.5 text-xs font-semibold"
                    onClick={() => {
                      setAskKey((k) => (k === a.key ? null : a.key));
                      setErr(null);
                    }}
                  >
                    {askKey === a.key ? "Band karein" : "Wajah likh kar khatam karein"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
