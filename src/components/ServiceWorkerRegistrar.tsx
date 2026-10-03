"use client";

// Area11 — service worker register + internet band hone par halki si patti
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function ServiceWorkerRegistrar() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Production me hi SW (dev me purana cache pareshan karta hai)
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const up = () => setOffline(false);
    const down = () => setOffline(true);
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-sm font-medium text-amber-950">
      <WifiOff size={15} />
      Internet nahi hai — app chal rahi hai (data shop PC par mehfooz hai)
    </div>
  );
}
