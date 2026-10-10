"use client";

// Searchable customer picker for the counter.
// Default = "Walk-in (cash)". Type a name or phone and matching customers appear.

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export type PickerCustomer = {
  id: number | string;
  name: string;
  phone?: string | null;
  category?: string | null;
};

export default function CustomerPicker({
  customers,
  value,
  onChange,
}: {
  customers: PickerCustomer[];
  /** selected customer id as a string ("" = walk-in) */
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = customers.find((c) => String(c.id) === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the list when the user clicks outside it
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? customers.filter(
          (c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q)
        )
      : customers;
    return list.slice(0, 8);
  }, [customers, query]);

  function pick(id: string) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input
          className="input pl-8 pr-8"
          placeholder="Walk-in (cash) — type a name or phone"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
        {(selected || query) && (
          <button
            type="button"
            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
            onClick={() => pick("")}
            aria-label="Clear customer"
            title="Back to Walk-in (cash)"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {selected ? (
        <div className="mt-1 text-[11px] text-slate-600">
          Selected: <span className="font-medium">{selected.name}</span>
          {selected.phone ? ` • ${selected.phone}` : ""}
        </div>
      ) : (
        <div className="mt-1 text-[11px] text-slate-500">Walk-in (cash) — no customer selected</div>
      )}

      {open && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-lg">
          <li>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick("")}
              className="flex w-full px-3 py-2 text-left hover:bg-slate-50"
            >
              Walk-in (cash)
            </button>
          </li>
          {matches.map((c) => (
            <li key={String(c.id)}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(String(c.id))}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {c.phone ?? ""}
                  {c.category && c.category !== "normal" ? ` (${c.category})` : ""}
                </span>
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-500">No customer found. Use + to add a new one.</li>
          )}
        </ul>
      )}
    </div>
  );
}
