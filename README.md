# Area11

**Smart Pharmacy & Retail POS + Inventory System** — offline-first, everything editable, live preview, go-back checkpoints.

> 🤖 **New agent / new person? Open [`HANDOFF.md`](./HANDOFF.md) first.** It has the status, TODO list, how to run, gotchas and rollback. (`AGENTS.md` is the short rule sheet.)
>
> 📁 Real app = **repo root** (Next.js + SQLite). `legacy-demo-vite/` = older browser-only demo kept for reference/reuse.

## Status (2026-10-01) — v0.6.0

| Stage | Work | State |
|---|---|---|
| Stone 0 / 0.5 | Repo, checkpoints, spec, 116 numbered rules, app foundation, editable Settings | ✅ |
| **Phase 1** | Products + pack formula, suppliers, purchases (PINV, batch/expiry), counter billing (FEFO, Box/Strip/Tab, hold cart, round-off **with cost guard**), thermal receipt | ✅ (login/role switcher + change calculator still TODO) |
| **Phase 2 (essentials)** | Sales history, partial returns / void, customer credit & payment receiving, supplier payments, cash/day-end, expenses, owner drawings, DB backup | ✅ |
| Phase 2 rest, 3, 4, 5 | provisional returns, shifts, supplier returns, WhatsApp orders, loyalty, split pay, audit viewer, Supabase sync … | ⏳ see `HANDOFF.md` §4 |

## 📁 Files (naqsha)

| File | Kaam |
|---|---|
| **`PHASE-TWO-INFORMATION.md`** | ⭐ **Zabta + mansooba** — 116 numbered rules (U/R/E/S/P/B/Z/T/M/Q) |
| **`INPUT-INFORMATION.md`** | Part 1: master spec **hoobahoo** • Part 2: A-01…A-49 (tay shuda) + Q-01…Q-19 (aap ke faisle) |
| **`complete_numbered_master_specs (1).md`** | Asal master spec — **Single Source of Truth** |
| **`HANDOFF.md`** | ⭐ Naye agent ke liye pehla safha: status, TODO, run, rollback |
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
bash scripts/ckpt.sh save "kaam ka naam"    # Save point
bash scripts/ckpt.sh list                   # Saare stages dekhein
bash scripts/ckpt.sh go 3                   # Kisi bhi stage par wapas
bash scripts/ckpt.sh undo                   # Ek qadam peeche
bash scripts/ckpt.sh push                   # GitHub par mehfooz
bash scripts/rules-count.sh                 # Numbered rules check
```

**Backup:** `data/area11.db` file ki copy — bas itna hi.

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
