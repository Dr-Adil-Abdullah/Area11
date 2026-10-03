"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck, UserRound } from "lucide-react";

type Staff = { id: number; name: string; role: string };

export default function LoginClient({
  appName,
  storeName,
  pinLength,
}: {
  appName: string;
  storeName: string;
  pinLength: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"owner" | "staff">("owner");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/login")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && Array.isArray(d.staff)) {
          setStaff(d.staff);
          if (d.staff.length > 0) setMode("staff");
        }
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "owner" ? { mode: "owner", password } : { mode: "staff", name, pin }
        ),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Login failed");
        setBusy(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not reach the app. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand)] text-lg font-bold text-white">
            {(appName || "A11").slice(0, 3).toUpperCase()}
          </div>
          <h1 className="text-lg font-semibold text-slate-800">{appName}</h1>
          <p className="text-xs text-slate-500">{storeName}</p>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("owner");
                  setError("");
                }}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  mode === "owner" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"
                }`}
              >
                <ShieldCheck className="h-4 w-4" /> Owner
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("staff");
                  setError("");
                }}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  mode === "staff" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"
                }`}
              >
                <UserRound className="h-4 w-4" /> Staff
              </button>
            </div>

            <form onSubmit={submit} className="grid gap-3">
              {mode === "owner" ? (
                <div>
                  <label className="label" htmlFor="password">
                    Owner password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoFocus
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="label" htmlFor="staffName">
                      Staff name
                    </label>
                    {staff.length > 0 ? (
                      <select
                        id="staffName"
                        className="select"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      >
                        <option value="">Select name…</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name} ({s.role})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="staffName"
                        className="input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                      />
                    )}
                  </div>
                  <div>
                    <label className="label" htmlFor="pin">
                      PIN ({pinLength} digits)
                    </label>
                    <input
                      id="pin"
                      type="password"
                      inputMode="numeric"
                      className="input tracking-[0.3em]"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      placeholder="••••"
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="btn-primary w-full disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" />
                {busy ? "Checking…" : "Log in"}
              </button>
            </form>

            {staff.length === 0 && mode === "staff" && (
              <p className="mt-3 text-[11px] text-slate-400">
                No staff accounts yet. The owner can add staff from Settings → Staff.
              </p>
            )}
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-400">
          {storeName} · Local network only · Data stays on this computer
        </p>
      </div>
    </div>
  );
}
