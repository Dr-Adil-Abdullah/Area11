# Area11

**Smart Pharmacy & Retail POS + Inventory System** — offline-first, everything editable, live preview, go-back checkpoints.

> 🤖 **New agent / new person? Open [`HANDOFF.md`](./HANDOFF.md) first.** It has the status, TODO list, how to run, gotchas and rollback. (`AGENTS.md` is the short rule sheet.)
>
> 📁 Real app = **repo root** (Next.js + SQLite). `legacy-demo-vite/` = older browser-only demo kept for reference/reuse.

## Status (2026-10-03) — v0.6.1

**Branch:** `arena/01a10395-area11` → **[PR #3](https://github.com/Dr-Adil-Abdullah/Area11/pull/3)** into `main` (it already contains the earlier session's work `arena/01a0f0cf-area11` / PR #2, fast-forwarded on 2026-10-03). Verified today: `npx tsc --noEmit` 0 errors · `npm run build` 31 routes · `rules-count.sh` = `SAB THEEK` · live API smoke (`PINV-0001` purchase → `INV-0001` sale) OK · legacy demo tests 212/212.

| Stage | Work | State |
|---|---|---|
| Stone 0 / 0.5 | Repo, checkpoints, spec, 116 numbered rules, app foundation, editable Settings | ✅ |
| **Phase 1** | Products + pack formula, suppliers, purchases (PINV, batch/expiry), counter billing (FEFO, Box/Strip/Tab, hold cart, round-off **with cost guard**), thermal receipt, **login + roles (owner password / staff PIN)** | ✅ (change calculator still TODO) |
| **Phase 2 (essentials)** | Sales history, partial returns / void, customer credit & payment receiving, supplier payments, cash/day-end, expenses, owner drawings, DB backup | ✅ |
| **Discount guard (spec 7.3)** | Role percent limits (cashier 5 · manager 20 · owner unlimited) **and** no discount below purchase cost — both server-side and editable in Settings | ✅ |
| Phase 2 rest, 3, 4, 5 | provisional returns, shifts, supplier returns, WhatsApp orders, loyalty, split pay, audit viewer, Supabase sync … | ⏳ see `HANDOFF.md` §4 |

**Live link (demo only):** <https://marea11.netlify.app> — Netlify project `marea11` publishes the **`legacy-demo-vite/` demo** (sample data) for now. The real app needs a **Node ≥ 22.5 host with a persistent disk** (shop PC / Node host with volume): a SQLite file cannot live on static or serverless hosting. Details in `HANDOFF.md` §10.

## 📁 Files (naqsha)

| File | Kaam |
|---|---|
| **`PHASE-TWO-INFORMATION.md`** | ⭐ **Zabta + mansooba** — 116 numbered rules (U/R/E/S/P/B/Z/T/M/Q) |
| **`INPUT-INFORMATION.md`** | Part 1: master spec **hoobahoo** • Part 2: A-01…A-49 (tay shuda) + Q-01…Q-19 (aap ke faisle) |
| **`complete_numbered_master_specs (1).md`** | Asal master spec — **Single Source of Truth** |
| **`HANDOFF.md`** | ⭐ Naye agent ke liye pehla safha: **kya ho chuka / kya baqi hai**, run, gotchas, hosting, rollback — har kaam ke baad update karein |
| **`AGENTS.md`** | Chhota rule sheet (non-negotiables) |
| `src/` | App ka code (Next.js + TypeScript) |
| `legacy-demo-vite/` | Purana browser-demo (reference / reuse) |
| `scripts/ckpt.sh` | **Wapas jane ka system** (checkpoint) |
| `scripts/sync-spec.sh` | Spec → INPUT Part 1 khud-ba-khud copy |
| `scripts/rules-count.sh` | Numbered points ki ginti (koi baat miss na ho) |
| `data/area11.db` | Aap ka **asli data** (SQLite — backup = ek file ki copy) |

---

## 🚀 Roz-marra ka kaam

```bash
npm run dev            # App chalayein (http://localhost:3000)
npm test               # Unit tests (Node ka built-in runner - koi library nahi)
bash scripts/ckpt.sh save "kaam ka naam"    # Save point
bash scripts/ckpt.sh list                   # Saare stages dekhein
bash scripts/ckpt.sh go 3                   # Kisi bhi stage par wapas
bash scripts/ckpt.sh undo                   # Ek qadam peeche
bash scripts/ckpt.sh push                   # GitHub par mehfooz
bash scripts/rules-count.sh                 # Numbered rules check
```

**Backup:** `data/area11.db` file ki copy — bas itna hi.

**Login:** owner password `area11` (pehle din badal lein: Settings → Staff). Staff = naam + 4-hindsi PIN (owner banata hai).
**Password bhool gaye?** `node scripts/reset-login.mjs --owner "naya-password"` (app chalti hui bhi kaam karta hai).

---

## 🛠 Technology (kam code = kam error)

| Hissa | Kya | Kyun |
|---|---|---|
| App | **Next.js + TypeScript** | live preview, kam code |
| UI | **Tailwind CSS + Lucide icons** | tayyar cheezein |
| Database | **SQLite (Node ka built-in)** | **zero extra library**, ek file, offline |
| Money | **paisa (integer)** | calculation me kabhi ghalti nahi |
| Auth | Node ka built-in scrypt | staff PIN + owner password |
| Cloud | **Supabase** (Phase 5) | aap ka intekhab |

---


## 💡 Yaad rahe
- Har cheez badli ja sakti hai (Settings) — naam, logo, rang, rates, expiry levels, receipt…
- Frontend se badlav database me khud-ba-khud.
- Wapas jana: `git tag` (stage-1…N) → `bash scripts/ckpt.sh go N` — merge ke baad bhi.
