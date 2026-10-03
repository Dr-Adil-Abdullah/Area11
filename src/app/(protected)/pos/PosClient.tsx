"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Barcode, Check, CreditCard, Minus, PauseCircle, PlayCircle, Plus, Printer, Search, ShoppingCart, Trash2, User, X, AlertTriangle } from "lucide-react";
import {
  applyRoundWithCostGuard,
  formatPKR,
  fromBaseUnits,
  marginDiscount,
  percentOf,
  retailDiscount,
  toPaisa,
  toBaseUnits,
} from "@/lib/money";

type Customer = { id: number; name: string; phone: string | null; category: string; balance_paisa: number };

type PosBatch = {
  id: number;
  batch_no: string;
  expiry_ym: string | null;
  expiry_date: string | null;
  qty_base: number;
  cost_paisa: number;
  retail_paisa: number;
  vip_paisa: number;
  doctor_paisa: number;
  status: "ok" | "near" | "very_near" | "expired";
};

type PosProduct = {
  id: number;
  name: string;
  generic: string | null;
  brand: string | null;
  barcode: string | null;
  rack_no: string | null;
  pack_size_label: string | null;
  base_unit: string;
  box_strips: number;
  strip_tablets: number;
  retail_paisa: number;
  vip_paisa: number;
  doctor_paisa: number;
  cost_paisa: number;
  stock_base: number;
  batches: PosBatch[];
};

type CartLine = {
  key: string;
  productId: number;
  batchId: number | null;
  name: string;
  unit: "box" | "strip" | "base";
  qty: number;
  unitPricePaisa: number;
  discountPaisa: number;
  boxStrips: number;
  stripTablets: number;
  baseUnit: string;
  costPaisa: number;
  batchLabel: string;
  expiry: string | null;
  status: string;
  availableBase: number;
};

type HeldCart = {
  id: string;
  at: string;
  customerId: string;
  lines: CartLine[];
  note: string;
};

type Props = {
  nextCode: string;
  settings: {
    taxEnabled: boolean;
    taxPercent: number;
    taxLabel: string;
    roundMode: string;
    roundTo: number;
    discountEnabled: boolean;
    discountMode: string;
    maxCashier: number;
    maxManager: number;
    paymentMethods: string[];
    defaultPayment: string;
    loyaltyEnabled: boolean;
  };
  customers: Customer[];
  userRole: string;
  shiftOpen: boolean;
};

const statusColor: Record<string, string> = {
  ok: "badge-green",
  near: "badge-amber",
  very_near: "badge-red",
  expired: "badge-red",
};

function priceForBatch(p: PosProduct, b: PosBatch | null, category: string): number {
  const src = b ?? p;
  if (category === "vip" && src.vip_paisa > 0) return src.vip_paisa;
  if (category === "doctor" && src.doctor_paisa > 0) return src.doctor_paisa;
  return src.retail_paisa || p.retail_paisa;
}

export default function PosClient({
  nextCode,
  settings,
  customers: initialCustomers,
  userRole,
  shiftOpen,
}: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PosProduct[]>([]);
  const [openProduct, setOpenProduct] = useState<PosProduct | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [billDiscount, setBillDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(settings.defaultPayment);
  const [paidNow, setPaidNow] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastSale, setLastSale] = useState<{
    id: number;
    code: string;
    total: number;
    due: number;
    change?: number;
  } | null>(null);
  const [held, setHeld] = useState<HeldCart[]>([]);
  const [showHeld, setShowHeld] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", category: "normal" });
  const [tendered, setTendered] = useState(""); // grahak ne kitne cash diye
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const customer = customers.find((c) => String(c.id) === customerId) ?? null;
  const category = customer?.category ?? "normal";

  // ---------------- held carts (localStorage) ----------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem("area11.heldCarts");
      if (raw) setHeld(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("area11.heldCarts", JSON.stringify(held));
    } catch {
      /* ignore */
    }
  }, [held]);

  // ---------------- search ----------------
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!search.trim()) {
        setResults([]);
        return;
      }
      const res = await fetch(`/api/pos/search?q=${encodeURIComponent(search)}&limit=10`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setResults(data.products ?? []);
    }, 180);
    return () => clearTimeout(t);
  }, [search]);

  const addFromProduct = useCallback(
    (p: PosProduct, batch: PosBatch | null, unit?: "box" | "strip" | "base") => {
      const chosenUnit: CartLine["unit"] =
        unit ?? (p.box_strips > 0 || p.strip_tablets > 0 ? "strip" : "base");
      const price = priceForBatch(p, batch, category);
      const available = batch ? batch.qty_base : p.stock_base;

      const existing = lines.find(
        (l) => l.productId === p.id && l.batchId === (batch?.id ?? null) && l.unit === chosenUnit && l.unitPricePaisa === price
      );
      if (existing) {
        setLines((ls) =>
          ls.map((l) => (l.key === existing.key ? { ...l, qty: l.qty + 1 } : l))
        );
      } else {
        setLines((ls) => [
          ...ls,
          {
            key: `${p.id}-${batch?.id ?? 0}-${chosenUnit}-${Date.now()}`,
            productId: p.id,
            batchId: batch?.id ?? null,
            name: p.name,
            unit: chosenUnit,
            qty: 1,
            unitPricePaisa: price,
            discountPaisa: 0,
            boxStrips: p.box_strips,
            stripTablets: p.strip_tablets,
            baseUnit: p.base_unit,
            costPaisa: batch?.cost_paisa ?? p.cost_paisa,
            batchLabel: batch?.batch_no ?? "—",
            expiry: batch?.expiry_ym ?? null,
            status: batch?.status ?? "ok",
            availableBase: available,
          },
        ]);
      }
      setOpenProduct(null);
      setSearch("");
      setResults([]);
      searchRef.current?.focus();
    },
    [category, lines]
  );

  // Enter on search = barcode / exact match -> add directly
  async function onSearchEnter() {
    if (results.length === 1) {
      const p = results[0];
      const b = p.batches.find((x) => x.status !== "expired") ?? null;
      addFromProduct(p, b);
      return;
    }
    if (results.length > 1) return;
    // exact barcode fallback
    const res = await fetch(`/api/pos/search?q=${encodeURIComponent(search)}&limit=3`, { cache: "no-store" });
    const data = await res.json();
    if (data.ok && data.products?.length === 1) {
      const p = data.products[0] as PosProduct;
      addFromProduct(p, p.batches[0] ?? null);
    }
  }

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F4") {
        e.preventDefault();
        void checkout();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------------- totals ----------------
  const totals = useMemo(() => {
    const linesTotal = lines.reduce((s, l) => {
      const base = toBaseUnits(l.qty, l.unit, l.boxStrips, l.stripTablets);
      return s + Math.max(0, Math.round(base * l.unitPricePaisa) - l.discountPaisa);
    }, 0);

    const billDisc = Math.max(0, toPaisa(billDiscount || 0));
    const afterDiscount = Math.max(0, linesTotal - billDisc);
    const tax = settings.taxEnabled ? percentOf(afterDiscount, settings.taxPercent) : 0;
    const beforeRound = afterDiscount + tax;
    const cost = lines.reduce(
      (s, l) => s + toBaseUnits(l.qty, l.unit, l.boxStrips, l.stripTablets) * l.costPaisa,
      0
    );
    const { finalPaise, roundOffPaise } =
      settings.roundMode === "down10"
        ? applyRoundWithCostGuard(beforeRound, settings.roundTo, Math.round(cost))
        : { finalPaise: beforeRound, roundOffPaise: 0 };

    const paid = paidNow === "" ? finalPaise : Math.min(toPaisa(paidNow || 0), finalPaise);
    const due = Math.max(0, finalPaise - paid);
    const profit = finalPaise - cost;

    // change (cash counter) -- revenue nahi, sirf wapas kiye jaane wale paise
    const tenderedPaisa = toPaisa(tendered || 0);
    const change = Math.max(0, tenderedPaisa - finalPaise);

    // discount limit check -- ROLE ke hisaab se (pehle ghalti se customer
    // category dekhi ja rahi thi: vip customer se cashier ko manager limit mil jati thi)
    let limitWarning = "";
    if (settings.discountEnabled && billDisc > 0 && linesTotal > 0) {
      const pct = (billDisc / linesTotal) * 100;
      const allowed = ["owner", "manager"].includes(userRole) ? settings.maxManager : settings.maxCashier;
      if (pct > allowed) {
        limitWarning = `Bill discount is ${pct.toFixed(1)}% — your limit is ${allowed}%. Ask the manager.`;
      }
    }

    return {
      linesTotal, billDisc, tax, roundOffPaise, total: finalPaise, paid, due,
      cost, profit, limitWarning, tenderedPaisa, change,
    };
  }, [lines, billDiscount, paidNow, tendered, settings, userRole]);

  // ---------------- actions ----------------
  function clearCart() {
    setLines([]);
    setBillDiscount("");
    setPaidNow("");
    setNote("");
    setCustomerId("");
    setError("");
  }

  function holdCart() {
    if (!lines.length) return;
    setHeld((h) => [
      ...h,
      { id: `H${Date.now()}`, at: new Date().toLocaleTimeString(), customerId, lines, note },
    ]);
    clearCart();
  }

  function recallCart(id: string) {
    const h = held.find((x) => x.id === id);
    if (!h) return;
    setLines(h.lines);
    setCustomerId(h.customerId);
    setNote(h.note);
    setHeld((list) => list.filter((x) => x.id !== id));
    setShowHeld(false);
  }

  async function addCustomer() {
    if (!newCustomer.name.trim()) return;
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCustomer.name,
        phone: newCustomer.phone || null,
        category: newCustomer.category,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      const rc = await fetch("/api/customers", { cache: "no-store" });
      const rd = await rc.json();
      if (rd.ok) setCustomers(rd.customers);
      setCustomerId(String(data.id));
      setNewCustomer({ name: "", phone: "", category: "normal" });
      setShowNewCustomer(false);
    }
  }

  async function checkout() {
    if (!lines.length) {
      setError("Cart is empty.");
      return;
    }
    if (paymentMethod === "credit" && !customerId) {
      setError("Credit (udhaar) ke liye customer select karein — ya naya customer banayein.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        customerId: customerId ? Number(customerId) : null,
        paymentMethod,
        paidPaisa: paymentMethod === "credit" ? toPaisa(paidNow || 0) : totals.total,
        tenderedPaisa: paymentMethod === "cash" ? (tendered ? toPaisa(tendered) : totals.total) : 0,
        billDiscountPaisa: totals.billDisc,
        notes: note || null,
        items: lines.map((l) => ({
          productId: l.productId,
          batchId: l.batchId,
          unit: l.unit,
          qty: l.qty,
          unitPricePaisa: l.unitPricePaisa,
          discountPaisa: l.discountPaisa,
        })),
      };
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Save failed");
      setLastSale({
        id: data.id,
        code: data.code,
        total: data.totalPaisa,
        due: data.duePaisa,
        change: data.changePaisa ?? 0,
      });
      setTendered("");
      if (data.warnings?.length) setError(data.warnings.join(" | "));
      clearCart();
      router.refresh();
      // receipt kholo (nayi window me) -- print ready
      window.open(`/receipt/${data.id}?auto=1`, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function setLineQty(key: string, qty: number) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, qty: Math.max(0.5, qty) } : l)));
  }

  function setLineUnit(key: string, unit: CartLine["unit"]) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, unit } : l)));
  }

  function setLineDiscount(key: string, percent: number) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const base = toBaseUnits(l.qty, l.unit, l.boxStrips, l.stripTablets);
        const gross = Math.round(base * l.unitPricePaisa);
        const disc =
          settings.discountMode === "retail" ? retailDiscount(gross, percent) : marginDiscount(l.costPaisa * base, gross, percent);
        return { ...l, discountPaisa: disc };
      })
    );
  }

  return (
    <div className="space-y-3">
      {!shiftOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <span>
            Galla (cash shift) khuli nahi hai — band karte waqt hisaab milane ke liye pehle
            <a className="mx-1 font-semibold underline" href="/cash">Cash &amp; day-end</a>
            par ja kar shift khol lein. (Billing ruk nahi rahi.)
          </span>
        </div>
      )}
    <div className="grid gap-4 lg:grid-cols-5">
      {/* ---------------- LEFT: search ---------------- */}
      <div className="space-y-3 lg:col-span-3">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-slate-800">Counter / Billing</h1>
                <p className="text-xs text-slate-500">
                  Next bill: <span className="font-medium text-slate-700">{nextCode}</span> • F2 = search • F4 = save &amp; print
                </p>
              </div>
              <div className="flex gap-2">
                {held.length > 0 && (
                  <button className="btn-secondary" onClick={() => setShowHeld((v) => !v)}>
                    <PlayCircle className="h-4 w-4" /> Held ({held.length})
                  </button>
                )}
                <button className="btn-secondary" onClick={holdCart} disabled={!lines.length}>
                  <PauseCircle className="h-4 w-4" /> Hold cart
                </button>
              </div>
            </div>

            <div className="relative mt-3">
              <Barcode className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                ref={searchRef}
                className="input pl-9 text-base"
                placeholder="Scan barcode or type medicine name / salt…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearchEnter()}
                autoFocus
              />
            </div>
          </div>
        </div>

        {showHeld && held.length > 0 && (
          <div className="card">
            <div className="card-head">
              <div className="card-title">Held carts</div>
              <button className="btn-ghost" onClick={() => setShowHeld(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="card-body space-y-2">
              {held.map((h) => (
                <button
                  key={h.id}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => recallCart(h.id)}
                >
                  <span className="text-sm text-slate-700">
                    {h.lines.length} items • {h.at} {h.note ? `• ${h.note}` : ""}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatPKR(
                      h.lines.reduce(
                        (s, l) =>
                          s + Math.round(toBaseUnits(l.qty, l.unit, l.boxStrips, l.stripTablets) * l.unitPricePaisa),
                        0
                      )
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* results */}
        {results.length > 0 && (
          <div className="card">
            <div className="card-head">
              <div className="card-title">Search results — nearest expiry first (FIFO)</div>
              <span className="badge-slate">{results.length}</span>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              {results.map((p) => {
                const open = openProduct?.id === p.id;
                const sellable = p.batches.filter((b) => b.status !== "expired");
                return (
                  <div key={p.id} className="border-b border-slate-100">
                    <button
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      onClick={() => setOpenProduct(open ? null : p)}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-slate-800">{p.name}</span>
                          {p.rack_no && <span className="badge-slate">{p.rack_no}</span>}
                          {p.stock_base <= 0 && <span className="badge-red">Out of stock</span>}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">
                          {[p.generic, p.brand, p.pack_size_label].filter(Boolean).join(" • ")}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-slate-800">{formatPKR(p.retail_paisa)}</div>
                        <div className="text-[11px] text-slate-500">
                          {fromBaseUnits(p.stock_base, p.box_strips, p.strip_tablets, p.base_unit)}
                        </div>
                      </div>
                    </button>

                    {open && (
                      <div className="bg-slate-50 px-4 pb-3">
                        {p.box_strips > 0 || p.strip_tablets > 0 ? (
                          <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
                            <span>
                              {p.box_strips && p.strip_tablets
                                ? `1 Box = ${p.box_strips} Strip = ${p.box_strips * p.strip_tablets} ${p.base_unit}`
                                : `1 Strip = ${p.strip_tablets} ${p.base_unit}`}
                            </span>
                            <button
                              className="btn-secondary !py-1 !text-xs"
                              onClick={() => addFromProduct(p, sellable[0] ?? null, "box")}
                            >
                              Add Box
                            </button>
                            <button
                              className="btn-secondary !py-1 !text-xs"
                              onClick={() => addFromProduct(p, sellable[0] ?? null, "strip")}
                            >
                              Add Strip
                            </button>
                            <button
                              className="btn-secondary !py-1 !text-xs"
                              onClick={() => addFromProduct(p, sellable[0] ?? null, "base")}
                            >
                              Add {p.base_unit}
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-primary mb-2 !py-1 !text-xs"
                            onClick={() => addFromProduct(p, sellable[0] ?? null, "base")}
                          >
                            Add to cart
                          </button>
                        )}

                        {p.batches.length === 0 && (
                          <div className="text-xs text-slate-500">No batch in stock.</div>
                        )}

                        <div className="space-y-1">
                          {p.batches.map((b) => (
                            <div
                              key={b.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200"
                            >
                              <div className="min-w-0 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-700">Batch {b.batch_no}</span>
                                  <span className={statusColor[b.status]}>{b.expiry_ym ?? "no expiry"}</span>
                                  {b.status === "expired" && <span className="badge-red">EXPIRED — do not sell</span>}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  In stock: {b.qty_base} {p.base_unit}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-xs font-medium text-slate-700">
                                  {formatPKR(priceForBatch(p, b, category))}
                                </span>
                                <button
                                  className="btn-secondary !px-2 !py-1 !text-xs"
                                  disabled={b.status === "expired"}
                                  onClick={() => addFromProduct(p, b)}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* cart lines (also visible under search on wide screens) */}
        <div className="card lg:hidden">
          <div className="card-head">
            <div className="card-title">Cart ({lines.length})</div>
          </div>
          <div className="card-body text-sm text-slate-500">See the cart panel on the right.</div>
        </div>
      </div>

      {/* ---------------- RIGHT: cart ---------------- */}
      <div className="lg:col-span-2">
        <div className="card sticky top-20">
          <div className="card-head">
            <div className="card-title flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Cart ({lines.length})
            </div>
            {lines.length > 0 && (
              <button className="btn-ghost text-rose-600" onClick={clearCart}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[45vh] overflow-auto">
            {lines.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">Cart is empty — search a medicine to start.</div>
            ) : (
              <table className="tbl">
                <tbody>
                  {lines.map((l) => {
                    const base = toBaseUnits(l.qty, l.unit, l.boxStrips, l.stripTablets);
                    const gross = Math.round(base * l.unitPricePaisa);
                    return (
                      <tr key={l.key}>
                        <td>
                          <div className="text-sm font-medium text-slate-800">{l.name}</div>
                          <div className="text-[11px] text-slate-500">
                            Batch {l.batchLabel} {l.expiry ? `• exp ${l.expiry}` : ""}
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            <button className="btn-ghost !px-1.5 !py-0.5" onClick={() => setLineQty(l.key, l.qty - 1)}>
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              className="input !w-14 !py-0.5 text-center !text-xs"
                              value={l.qty}
                              onChange={(e) => setLineQty(l.key, Number(e.target.value) || 0.5)}
                            />
                            <button className="btn-ghost !px-1.5 !py-0.5" onClick={() => setLineQty(l.key, l.qty + 1)}>
                              <Plus className="h-3 w-3" />
                            </button>
                            {(l.boxStrips > 0 || l.stripTablets > 0) && (
                              <select
                                className="select !w-20 !py-0.5 !text-xs"
                                value={l.unit}
                                onChange={(e) => setLineUnit(l.key, e.target.value as CartLine["unit"])}
                              >
                                <option value="box">Box</option>
                                <option value="strip">Strip</option>
                                <option value="base">{l.baseUnit}</option>
                              </select>
                            )}
                            {settings.discountEnabled && (
                              <select
                                className="select !w-20 !py-0.5 !text-xs"
                                defaultValue="0"
                                onChange={(e) => setLineDiscount(l.key, Number(e.target.value))}
                              >
                                <option value="0">0%</option>
                                <option value="5">5%</option>
                                <option value="10">10%</option>
                                <option value="15">15%</option>
                                <option value="20">20%</option>
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="text-right align-top">
                          <div className="text-sm font-medium text-slate-800">{formatPKR(gross - l.discountPaisa)}</div>
                          <div className="text-[11px] text-slate-500">
                            {base} {l.baseUnit} × {formatPKR(l.unitPricePaisa)}
                          </div>
                          {l.discountPaisa > 0 && (
                            <div className="text-[11px] text-emerald-600">- {formatPKR(l.discountPaisa)}</div>
                          )}
                          <button
                            className="mt-1 text-[11px] text-rose-600 hover:underline"
                            onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                          >
                            remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="border-t border-slate-200 p-4 space-y-3">
            {/* customer */}
            <div>
              <label className="label flex items-center gap-1">
                <User className="h-3 w-3" /> Customer (needed for credit / VIP rate)
              </label>
              <div className="flex gap-2">
                <select className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Walk-in (cash)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.phone ? ` • ${c.phone}` : ""}{c.category !== "normal" ? ` (${c.category})` : ""}
                    </option>
                  ))}
                </select>
                <button className="btn-secondary whitespace-nowrap" onClick={() => setShowNewCustomer((v) => !v)}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {customer && customer.balance_paisa > 0 && (
                <div className="mt-1 text-[11px] text-rose-600">
                  Previous balance: {formatPKR(customer.balance_paisa)}
                </div>
              )}
              {showNewCustomer && (
                <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
                  <input
                    className="input-sm w-full"
                    placeholder="Customer name"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <input
                      className="input-sm flex-1"
                      placeholder="Phone"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    />
                    <select
                      className="select !py-1 !text-xs"
                      value={newCustomer.category}
                      onChange={(e) => setNewCustomer({ ...newCustomer, category: e.target.value })}
                    >
                      <option value="normal">Normal</option>
                      <option value="vip">VIP</option>
                      <option value="doctor">Doctor</option>
                    </select>
                    <button className="btn-secondary !px-2" onClick={addCustomer}>
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* discount */}
            {settings.discountEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Bill discount (Rs)</label>
                  <input
                    className="input"
                    value={billDiscount}
                    onChange={(e) => setBillDiscount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="label">Note</label>
                  <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
                </div>
              </div>
            )}

            {/* payment */}
            <div>
              <label className="label">Payment</label>
              <div className="flex flex-wrap gap-2">
                {(settings.paymentMethods.length ? settings.paymentMethods : ["cash"]).map((m) => (
                  <button
                    key={m}
                    className={paymentMethod === m ? "btn-primary !py-1.5 !text-xs" : "btn-secondary !py-1.5 !text-xs"}
                    onClick={() => setPaymentMethod(m)}
                  >
                    {m === "cash" ? "Cash" : m === "credit" ? "Credit (udhaar)" : m === "online" ? "Online" : "Card"}
                  </button>
                ))}
              </div>
              {paymentMethod === "credit" && (
                <div className="mt-2">
                  <label className="label">Amount received now (Rs)</label>
                  <input className="input" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} placeholder="0" />
                </div>
              )}
              {paymentMethod === "cash" && (
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="label">Cash received (Rs)</label>
                    <input
                      className="input"
                      value={tendered}
                      onChange={(e) => setTendered(e.target.value)}
                      placeholder={String(totals.total / 100)}
                      inputMode="decimal"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      className="btn-secondary !px-2 !py-1 !text-[11px]"
                      onClick={() => setTendered(String(totals.total / 100))}
                    >
                      Exact
                    </button>
                    {[100, 500, 1000, 2000, 5000].map((note) => (
                      <button
                        key={note}
                        className="btn-secondary !px-2 !py-1 !text-[11px]"
                        onClick={() => setTendered(String(note))}
                        disabled={note * 100 < totals.total}
                      >
                        {note}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* totals */}
            <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatPKR(totals.linesTotal)}</span>
              </div>
              {totals.billDisc > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span>- {formatPKR(totals.billDisc)}</span>
                </div>
              )}
              {settings.taxEnabled && (
                <div className="flex justify-between text-slate-600">
                  <span>{settings.taxLabel} ({settings.taxPercent}%)</span>
                  <span>{formatPKR(totals.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Round-off {settings.roundMode === "down10" ? "(down)" : ""}</span>
                <span className={totals.roundOffPaise < 0 ? "text-emerald-700" : ""}>
                  {totals.roundOffPaise === 0 ? "—" : formatPKR(totals.roundOffPaise)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-semibold text-slate-800">
                <span>Total</span>
                <span>{formatPKR(totals.total)}</span>
              </div>
              {paymentMethod === "credit" && (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Paid now</span>
                    <span>{formatPKR(totals.paid)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>Credit (added to account)</span>
                    <span>{formatPKR(totals.due)}</span>
                  </div>
                </>
              )}
              {paymentMethod === "cash" && (
                <>
                  {totals.tenderedPaisa > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Cash received</span>
                      <span>{formatPKR(totals.tenderedPaisa)}</span>
                    </div>
                  )}
                  <div
                    className={`flex justify-between ${
                      totals.change > 0 ? "font-semibold text-emerald-700" : "text-slate-500"
                    }`}
                  >
                    <span>Change to return</span>
                    <span>{totals.change > 0 ? formatPKR(totals.change) : "—"}</span>
                  </div>
                </>
              )}
            </div>

            {totals.limitWarning && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{totals.limitWarning}</div>
            )}
            {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

            <button className="btn-primary w-full !py-3 !text-base" onClick={checkout} disabled={busy || !lines.length}>
              <CreditCard className="h-5 w-5" />
              {busy ? "Saving…" : `Save & Print — ${formatPKR(totals.total)}`}
            </button>

            {lastSale && (
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <span>
                  Saved <span className="font-semibold">{lastSale.code}</span> • {formatPKR(lastSale.total)}
                  {lastSale.due > 0 ? ` • credit ${formatPKR(lastSale.due)}` : ""}
                  {lastSale.change ? ` • change ${formatPKR(lastSale.change)}` : ""}
                </span>
                <Link href={`/receipt/${lastSale.id}?auto=1`} target="_blank" className="flex items-center gap-1 underline">
                  <Printer className="h-3 w-3" /> Print
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
