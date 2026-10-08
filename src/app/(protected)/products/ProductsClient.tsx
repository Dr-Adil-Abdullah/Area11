"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Search, Trash2, X, Save, Pill, Package } from "lucide-react";
import { toPaisa, formatPKR, fromBaseUnits } from "@/lib/money";
import type { CustomField } from "@/lib/custom-fields-shared";

type Product = {
  id: number;
  name: string;
  generic: string | null;
  brand: string | null;
  barcode: string | null;
  company_id: number | null;
  category_id: number | null;
  rack_no: string | null;
  room?: string | null;
  photo?: string | null;
  pack_size_label: string | null;
  base_unit: string;
  box_strips: number;
  strip_tablets: number;
  cost_paisa: number;
  retail_paisa: number;
  vip_paisa: number;
  doctor_paisa: number;
  reorder_level: number;
  track_expiry: number;
  category_name?: string | null;
  company_name?: string | null;
  stock_base?: number;
  nearest_expiry?: string | null;
};

type Category = { id: number; name: string; product_count?: number };
type Company = { id: number; name: string; product_count: number };

const emptyForm = {
  id: 0,
  name: "",
  generic: "",
  brand: "",
  barcode: "",
  companyId: "",
  categoryId: "",
  rackNo: "",
  room: "",
  packSizeLabel: "",
  baseUnit: "tablet",
  boxStrips: "",
  stripTablets: "",
  cost: "",
  retail: "",
  vip: "",
  doctor: "",
  reorderLevel: "",
  trackExpiry: true,
};

type FormState = typeof emptyForm;

export default function ProductsClient({
  initialProducts,
  total,
  categories: initialCategories,
  companies: initialCompanies,
}: {
  initialProducts: Product[];
  total: number;
  categories: Category[];
  companies: Company[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newCategory, setNewCategory] = useState("");
  const [newCatParent, setNewCatParent] = useState(""); // "" = top level
  const [catTree, setCatTree] = useState<(Category & { depth: number; path: string })[]>([]);
  const [editCat, setEditCat] = useState<{ id: number; name: string } | null>(null);
  const [editComp, setEditComp] = useState<{ id: number; name: string } | null>(null);
  const [listMsg, setListMsg] = useState("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [newCompany, setNewCompany] = useState("");
  const [rooms, setRooms] = useState<string[]>([]);
  const [fCat, setFCat] = useState("");
  const [fComp, setFComp] = useState("");
  const [fRoom, setFRoom] = useState("");
  const [fStock, setFStock] = useState("all");
  const [fSort, setFSort] = useState("name");
  const [groupBy, setGroupBy] = useState<"none" | "category" | "company" | "room">("none");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.generic, p.brand, p.barcode, p.rack_no, p.room, p.category_name, p.company_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [products, search]);

  /** Filters ke mutabiq server se list mangwao (server hi sort karta hai) */
  async function loadFiltered() {
    const p = new URLSearchParams({ limit: "300" });
    if (search.trim()) p.set("q", search.trim());
    if (fCat) p.set("categoryId", fCat);
    if (fComp) p.set("companyId", fComp);
    if (fRoom) p.set("room", fRoom);
    if (fStock !== "all") p.set("stock", fStock);
    if (fSort !== "name") p.set("sort", fSort);
    const res = await fetch(`/api/products?${p}`, { cache: "no-store" });
    const data = await res.json();
    if (data.ok) {
      setProducts(data.products);
      if (data.rooms) setRooms(data.rooms);
    }
  }

  async function reload() {
    await loadFiltered();
    router.refresh();
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setForm(emptyForm);
    setCustom({});
    setError("");
    setShowForm(true);
  }

  async function loadCustomFor(id: number) {
    const r = await (await fetch(`/api/products/${id}`, { cache: "no-store" })).json();
    if (r.ok && r.custom) setCustom(r.custom as Record<string, string>);
    else setCustom({});
  }

  function openEdit(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      generic: p.generic ?? "",
      brand: p.brand ?? "",
      barcode: p.barcode ?? "",
      companyId: p.company_id ? String(p.company_id) : "",
      categoryId: p.category_id ? String(p.category_id) : "",
      rackNo: p.rack_no ?? "",
      room: p.room ?? "",
      packSizeLabel: p.pack_size_label ?? "",
      baseUnit: p.base_unit,
      boxStrips: p.box_strips ? String(p.box_strips) : "",
      stripTablets: p.strip_tablets ? String(p.strip_tablets) : "",
      cost: p.cost_paisa ? String(p.cost_paisa / 100) : "",
      retail: p.retail_paisa ? String(p.retail_paisa / 100) : "",
      vip: p.vip_paisa ? String(p.vip_paisa / 100) : "",
      doctor: p.doctor_paisa ? String(p.doctor_paisa / 100) : "",
      reorderLevel: p.reorder_level ? String(p.reorder_level) : "",
      trackExpiry: !!p.track_expiry,
    });
    setCustom({});
    void loadCustomFor(p.id);
    setError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        generic: form.generic || null,
        brand: form.brand || null,
        barcode: form.barcode || null,
        companyId: form.companyId ? Number(form.companyId) : null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        rackNo: form.rackNo || null,
        room: form.room || null,
        packSizeLabel: form.packSizeLabel || null,
        baseUnit: form.baseUnit,
        boxStrips: Number(form.boxStrips) || 0,
        stripTablets: Number(form.stripTablets) || 0,
        costPaisa: toPaisa(form.cost || 0),
        retailPaisa: toPaisa(form.retail || 0),
        vipPaisa: toPaisa(form.vip || 0),
        doctorPaisa: toPaisa(form.doctor || 0),
        reorderLevel: Number(form.reorderLevel) || 0,
        trackExpiry: form.trackExpiry,
        custom,
      };

      const res = await fetch(form.id ? `/api/products/${form.id}` : "/api/products", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Save failed");
      setShowForm(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"? (It stays in old bills, only hidden from new ones.)`)) return;
    setBusy(true);
    try {
      await fetch(`/api/products/${p.id}`, { method: "DELETE" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const r = await (await fetch("/api/custom-fields?entity=product", { cache: "no-store" })).json();
      if (r.ok) setCustomFields(r.fields);
      const ct = await (await fetch("/api/categories", { cache: "no-store" })).json();
      if (ct.ok) { setCategories(ct.categories); setCatTree(ct.tree ?? []); }
    })();
  }, []);

  // Filter/sort badalte hi list dobara lao (thodi der ruk kar -- har harf par request na jaye)
  useEffect(() => {
    const t = setTimeout(() => { void loadFiltered(); }, 250);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [search, fCat, fComp, fRoom, fStock, fSort]);

  /** Groups: category / company / room ke hisaab se band-o-basta */
  const groups = useMemo(() => {
    if (groupBy === "none") return null;
    const key = (p: Product) =>
      groupBy === "category" ? (p.category_name ?? "Bina category")
      : groupBy === "company" ? (p.company_name ?? "Bina company")
      : (p.room?.trim() || "Bina kamra");
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const k = key(p);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [filtered, groupBy]);


  async function refreshLists() {
    // categories ka tree + companies ek hi dafa
    const [rc, ro] = await Promise.all([
      fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/companies", { cache: "no-store" }),
    ]);
    const dc = await rc.json();
    const dco = await ro.json();
    if (dc.ok) { setCategories(dc.categories); setCatTree(dc.tree ?? []); }
    if (dco.ok) setCompanies(dco.companies);
  }

  async function renameCatRow(id: number, name: string) {
    setListMsg("");
    const r = await (await fetch("/api/categories", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name }),
    })).json();
    if (!r.ok) { setListMsg(r.error ?? "rename failed"); return; }
    setEditCat(null); await refreshLists(); router.refresh();
  }

  async function removeCatRow(id: number, name: string, count: number) {
    if (!confirm(
      count > 0
        ? `"${name}" hata dein? Is ke ${count} products category khali ho jayenge (products delete NAHI honge).`
        : `"${name}" hata dein?`
    )) return;
    setListMsg("");
    const r = await (await fetch(`/api/categories?id=${id}`, { method: "DELETE" })).json();
    if (!r.ok) { setListMsg(r.error ?? "delete failed"); return; }
    await refreshLists(); router.refresh();
  }

  async function renameCompRow(id: number, name: string) {
    setListMsg("");
    const r = await (await fetch("/api/companies", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name }),
    })).json();
    if (!r.ok) { setListMsg(r.error ?? "rename failed"); return; }
    setEditComp(null); await refreshLists(); router.refresh();
  }

  async function removeCompRow(id: number, name: string, count: number) {
    if (!confirm(
      count > 0
        ? `"${name}" hata dein? Is ke ${count} products company khali ho jayenge (products delete NAHI honge).`
        : `"${name}" hata dein?`
    )) return;
    setListMsg("");
    const r = await (await fetch(`/api/companies?id=${id}`, { method: "DELETE" })).json();
    if (!r.ok) { setListMsg(r.error ?? "delete failed"); return; }
    await refreshLists(); router.refresh();
  }

  /** Select ke andar se nayi category (naam wapas milega) */
  async function addCategoryInline(name: string): Promise<number | null> {
    const r = await (await fetch("/api/categories", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    })).json();
    if (!r.ok) { setListMsg(r.error ?? "category failed"); return null; }
    await refreshLists();
    return r.id ?? null;
  }

  async function addCompanyInline(name: string): Promise<number | null> {
    const r = await (await fetch("/api/companies", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    })).json();
    if (!r.ok) { setListMsg(r.error ?? "company failed"); return null; }
    await refreshLists();
    return (r.id as number) ?? null;
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategory }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewCategory("");
        const rc = await fetch("/api/categories", { cache: "no-store" });
        const rd = await rc.json();
        if (rd.ok) setCategories(rd.categories);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function addCompany() {
    if (!newCompany.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCompany }),
      });
      setNewCompany("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const packPreview = () => {
    const b = Number(form.boxStrips) || 0;
    const s = Number(form.stripTablets) || 0;
    if (!b && !s) return "Set 1 Box = ? Strips = ? Tablets to sell by box/strip.";
    if (b && s) return `1 Box = ${b} Strip(s) = ${b * s} ${form.baseUnit}(s)`;
    if (b) return `1 Box = ${b} Strip(s)`;
    return `1 Strip = ${s} ${form.baseUnit}(s)`;
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Products</h1>
          <p className="text-sm text-slate-500">
            {total} products • rates in rupees • pack formula: 1 Box = X Strips = Y Tablets
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus className="h-4 w-4" /> Add product
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">{form.id ? `Edit: ${form.name}` : "New product"}</div>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="card-body grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Barcode (scan or type)</label>
              <input className="input" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
            </div>
            <div>
              <label className="label">Generic / salt</label>
              <input className="input" value={form.generic} onChange={(e) => set("generic", e.target.value)} />
            </div>
            <div>
              <label className="label">Brand</label>
              <input className="input" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
            </div>
            <div>
              <label className="label">Pack size label</label>
              <input className="input" placeholder="10ml / 20mg" value={form.packSizeLabel} onChange={(e) => set("packSizeLabel", e.target.value)} />
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="select"
                value={form.categoryId}
                onChange={async (e) => {
                  if (e.target.value === "__new") {
                    const name = prompt("Nayi category ka naam?");
                    if (name?.trim()) {
                      const id = await addCategoryInline(name.trim());
                      if (id) set("categoryId", String(id));
                    }
                    return;
                  }
                  set("categoryId", e.target.value);
                }}
              >
                <option value="">— none —</option>
                {(catTree.length ? catTree : categories.map((c) => ({ ...c, depth: 0, path: c.name }))).map((c) => (
                  <option key={c.id} value={c.id}>{c.depth ? "— ".repeat(c.depth) : ""}{c.name}</option>
                ))}
                <option value="__new">＋ Nayi category…</option>
              </select>
            </div>
            <div>
              <label className="label">Company</label>
              <select
                className="select"
                value={form.companyId}
                onChange={async (e) => {
                  if (e.target.value === "__new") {
                    const name = prompt("Nayi company ka naam?");
                    if (name?.trim()) {
                      const id = await addCompanyInline(name.trim());
                      if (id) set("companyId", String(id));
                    }
                    return;
                  }
                  set("companyId", e.target.value);
                }}
              >
                <option value="">— none —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="__new">＋ Nayi company…</option>
              </select>
            </div>
            <div>
              <label className="label">Rack / shelf no</label>
              <input className="input" placeholder="Rack B-12" value={form.rackNo} onChange={(e) => set("rackNo", e.target.value)} />
            </div>
            <div>
              <label className="label">Kamra / Almari (room)</label>
              <input className="input" placeholder="jaise: Hall, Store, Fridge" value={form.room} onChange={(e) => set("room", e.target.value)} list="room-list" />
              <datalist id="room-list">
                {rooms.map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>

            <div className="md:col-span-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-semibold text-slate-600">Packing formula (base unit = smallest unit)</div>
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="label">Base unit</label>
                  <select className="select" value={form.baseUnit} onChange={(e) => set("baseUnit", e.target.value)}>
                    <option value="tablet">Tablet</option>
                    <option value="capsule">Capsule</option>
                    <option value="ml">ml</option>
                    <option value="piece">Piece</option>
                  </select>
                </div>
                <div>
                  <label className="label">1 Box = ? Strips</label>
                  <input type="number" min="0" className="input" value={form.boxStrips} onChange={(e) => set("boxStrips", e.target.value)} />
                </div>
                <div>
                  <label className="label">1 Strip = ? {form.baseUnit}s</label>
                  <input type="number" min="0" className="input" value={form.stripTablets} onChange={(e) => set("stripTablets", e.target.value)} />
                </div>
                <div className="flex items-end">
                  <div className="text-xs text-slate-500">{packPreview()}</div>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Cost (per {form.baseUnit})</label>
              <input type="number" step="0.01" className="input" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
            </div>
            <div>
              <label className="label">Retail rate</label>
              <input type="number" step="0.01" className="input" value={form.retail} onChange={(e) => set("retail", e.target.value)} />
            </div>
            <div>
              <label className="label">VIP rate</label>
              <input type="number" step="0.01" className="input" value={form.vip} onChange={(e) => set("vip", e.target.value)} />
            </div>
            <div>
              <label className="label">Doctor rate</label>
              <input type="number" step="0.01" className="input" value={form.doctor} onChange={(e) => set("doctor", e.target.value)} />
            </div>
            <div>
              <label className="label">Reorder level (base units)</label>
              <input type="number" step="1" className="input" value={form.reorderLevel} onChange={(e) => set("reorderLevel", e.target.value)} />
            </div>
            <label className="flex items-end gap-2 pb-1">
              <input type="checkbox" className="checkbox" checked={form.trackExpiry} onChange={(e) => set("trackExpiry", e.target.checked)} />
              <span className="text-sm text-slate-700">Track expiry for this product</span>
            </label>

            {error && <div className="md:col-span-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

            <div className="md:col-span-3 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>
                <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save product"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        {/* List */}
        <div className="card lg:col-span-3">
          <div className="card-head flex-col !items-stretch gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="card-title">Product list ({filtered.length})</div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  className="input-sm w-64 pl-8"
                  placeholder="Search name, salt, barcode, rack, room…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select className="select !py-1 !text-xs" value={fCat} onChange={(e) => setFCat(e.target.value)}>
                <option value="">Sab categories</option>
                {(catTree.length ? catTree : categories.map((c) => ({ ...c, depth: 0, path: c.name }))).map((c) => (
                  <option key={c.id} value={c.id}>{c.depth ? "— ".repeat(c.depth) : ""}{c.name}</option>
                ))}
              </select>
              <select className="select !py-1 !text-xs" value={fComp} onChange={(e) => setFComp(e.target.value)}>
                <option value="">Sab companies</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="select !py-1 !text-xs" value={fRoom} onChange={(e) => setFRoom(e.target.value)}>
                <option value="">Sab kamre</option>
                {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select className="select !py-1 !text-xs" value={fStock} onChange={(e) => setFStock(e.target.value)}>
                <option value="all">Sab stock</option>
                <option value="low">Kam stock (reorder se neeche)</option>
                <option value="out">Bilkul khatam</option>
                <option value="expiring">Jaldi expire</option>
              </select>
              <select className="select !py-1 !text-xs" value={fSort} onChange={(e) => setFSort(e.target.value)}>
                <option value="name">Naam ke hisaab se</option>
                <option value="stock">Kam stock pehle</option>
                <option value="expiry">Expiry jaldi wale pehle</option>
                <option value="margin">Zyada munafa pehle</option>
                <option value="sold">Sab se zyada bikne wali</option>
                <option value="newest">Nayi pehle</option>
              </select>
              <span className="mx-1 h-4 w-px bg-slate-200" />
              <select className="select !py-1 !text-xs" value={groupBy} onChange={(e) => setGroupBy(e.target.value as never)}>
                <option value="none">Koi group nahi</option>
                <option value="category">Group: category</option>
                <option value="company">Group: company</option>
                <option value="room">Group: kamra</option>
              </select>
              {(fCat || fComp || fRoom || fStock !== "all" || search) && (
                <button
                  className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200"
                  onClick={() => { setFCat(""); setFComp(""); setFRoom(""); setFStock("all"); setSearch(""); }}
                >
                  ✕ Saaf karein
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="tbl">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th>Product</th>
                  <th>Pack</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Retail</th>
                  <th>Nearest expiry</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(groups ?? [["", filtered] as [string, Product[]]]).map(([gname, list]) => (
                <Fragment key={gname || "__all"}>
                {groups && (
                  <tr className="cursor-pointer bg-slate-50" onClick={() => setCollapsed((c) => ({ ...c, [gname]: !c[gname] }))}>
                    <td colSpan={7} className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <span className="mr-1">{collapsed[gname] ? "▸" : "▾"}</span>
                      {gname} <span className="font-normal normal-case text-slate-400">({list.length})</span>
                    </td>
                  </tr>
                )}
                {(collapsed[gname] ? [] : list).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td>
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-slate-400" />
                        <div>
                          <Link href={`/products/${p.id}`} className="font-medium text-slate-800 hover:underline">{p.name}</Link>
                          <div className="text-[11px] text-slate-500">
                            {[p.generic, p.brand, p.category_name, p.rack_no, p.room ? `kamra: ${p.room}` : null].filter(Boolean).join(" • ") || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs text-slate-600">
                      {p.box_strips && p.strip_tablets
                        ? `1 Box = ${p.box_strips} Strip = ${p.box_strips * p.strip_tablets} ${p.base_unit}`
                        : p.strip_tablets
                        ? `1 Strip = ${p.strip_tablets} ${p.base_unit}`
                        : p.base_unit}
                    </td>
                    <td className="text-right text-slate-700">
                      {(p.stock_base ?? 0) > 0 ? (
                        <span>{fromBaseUnits(p.stock_base ?? 0, p.box_strips, p.strip_tablets, p.base_unit)}</span>
                      ) : (
                        <span className="badge-red">Out</span>
                      )}
                    </td>
                    <td className="text-right text-slate-600">{formatPKR(p.cost_paisa)}</td>
                    <td className="text-right font-medium text-slate-800">{formatPKR(p.retail_paisa)}</td>
                    <td className="text-xs text-slate-500">{p.nearest_expiry ?? "—"}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost !px-2" onClick={() => openEdit(p)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="btn-ghost !px-2 text-rose-600" onClick={() => remove(p)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                </Fragment>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                      {search || fCat || fComp || fRoom || fStock !== "all"
                        ? "Is filter me koi dawa nahi mili."
                        : "No products yet. Click “Add product” to create your first one."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side: categories + companies */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-head">
              <div className="card-title">Categories</div>
              <span className="badge-slate">{categories.length}</span>
            </div>
            <div className="card-body space-y-2">
              <div className="flex gap-2">
                <input
                  className="input-sm flex-1"
                  placeholder="Nayi category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                />
                <button className="btn-secondary !px-2" onClick={addCategory} disabled={busy}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <select className="select !py-1 !text-xs" value={newCatParent} onChange={(e) => setNewCatParent(e.target.value)}>
                <option value="">Top level (sab se upar)</option>
                {(catTree.length ? catTree : categories.map((c) => ({ ...c, depth: 0, path: c.name })))
                  .filter((c) => c.depth === 0)
                  .map((c) => <option key={c.id} value={c.id}>ke neeche: {c.name}</option>)}
              </select>
              {newCatParent && <div className="text-[11px] text-slate-500">Ye category us ke neeche banegi (sub-category).</div>}
              {listMsg && <div className="text-xs text-rose-600">{listMsg}</div>}
              <ul className="space-y-1">
                {categories.map((c) =>
                  editCat?.id === c.id ? (
                    <li key={c.id} className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1">
                      <input
                        autoFocus
                        className="input-sm flex-1"
                        value={editCat.name}
                        onChange={(e) => setEditCat({ id: c.id, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameCatRow(c.id, editCat.name);
                          if (e.key === "Escape") setEditCat(null);
                        }}
                      />
                      <button className="btn-primary !px-2 !py-1" onClick={() => renameCatRow(c.id, editCat.name)}><Save className="h-3.5 w-3.5" /></button>
                      <button className="btn-ghost !px-1" onClick={() => setEditCat(null)}><X className="h-3.5 w-3.5" /></button>
                    </li>
                  ) : (
                    <li key={c.id} className="group flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                      <span className="text-slate-700">
                        {(catTree.find((t) => t.id === c.id)?.depth ?? 0) > 0
                          ? "— ".repeat(catTree.find((t) => t.id === c.id)?.depth ?? 0)
                          : ""}
                        {c.name}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{c.product_count ?? 0}</span>
                        <button
                          className="text-slate-400 hover:text-slate-700"
                          title="Naam badlein"
                          onClick={() => setEditCat({ id: c.id, name: c.name })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="text-slate-400 hover:text-rose-600"
                          title="Hata dein"
                          onClick={() => removeCatRow(c.id, c.name, c.product_count ?? 0)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  )
                )}
                {categories.length === 0 && (
                  <li className="text-xs text-slate-500">No categories yet.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">Companies</div>
              <span className="badge-slate">{companies.length}</span>
            </div>
            <div className="card-body space-y-2">
              <div className="flex gap-2">
                <input
                  className="input-sm flex-1"
                  placeholder="New company"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCompany()}
                />
                <button className="btn-secondary !px-2" onClick={addCompany} disabled={busy}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <ul className="space-y-1">
                {companies.map((c) =>
                  editComp?.id === c.id ? (
                    <li key={c.id} className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1">
                      <input
                        autoFocus
                        className="input-sm flex-1"
                        value={editComp.name}
                        onChange={(e) => setEditComp({ id: c.id, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameCompRow(c.id, editComp.name);
                          if (e.key === "Escape") setEditComp(null);
                        }}
                      />
                      <button className="btn-primary !px-2 !py-1" onClick={() => renameCompRow(c.id, editComp.name)}><Save className="h-3.5 w-3.5" /></button>
                      <button className="btn-ghost !px-1" onClick={() => setEditComp(null)}><X className="h-3.5 w-3.5" /></button>
                    </li>
                  ) : (
                    <li key={c.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                      <span className="text-slate-700">{c.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{c.product_count}</span>
                        <button
                          className="text-slate-400 hover:text-slate-700"
                          title="Naam badlein"
                          onClick={() => setEditComp({ id: c.id, name: c.name })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="text-slate-400 hover:text-rose-600"
                          title="Hata dein"
                          onClick={() => removeCompRow(c.id, c.name, c.product_count ?? 0)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  )
                )}
                {companies.length === 0 && (
                  <li className="flex items-center gap-2 text-xs text-slate-500">
                    <Package className="h-4 w-4" /> No companies yet.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
