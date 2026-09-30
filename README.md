# Area11

**Smart Pharmacy & Retail POS + Inventory System** — offline-first, everything editable, with live preview and a go-back (checkpoint) system.

---

## 🟢 App chal rahi hai (Live Preview)

| Cheez | Haal |
|---|---|
| **App** | **chal rahi hai** — browser me preview khula hai (port 3000) |
| Database | ✅ ban gaya — `data/area11.db` (ek file) |
| Settings | ✅ poori tarah kaam kar rahe hain (save test ho chuka) |
| Dashboard | ✅ chal raha hai |

**App dobara chalane ke liye:** `npm run dev` (folder: `Area11`)

### Kya kya kaam kar raha hai (Phase 1)

| Screen | Kya kar sakte hain |
|---|---|
| **Products** | Naya product, pack formula (1 Box = X Strip = Y Tab), rates (retail/VIP/doctor), barcode, rack, category/company — sab screen se |
| **Suppliers** | Naya supplier, balance khud update hota hai |
| **Purchases** | Stock-in: auto **PINV-0001**, batch + expiry, supplier khatay me, bill print |
| **Counter (POS)** | Barcode/naam se search, **FIFO** (qareeb tareen expiry pehle), [Box][Strip][Tablet], discount, **neeche round-off**, hold cart, cash/credit, save + print |
| **Receipt** | 58mm/80mm thermal format, auto-print |
| **Settings** | Sab kuch badalne ke qabil |

---

## 📁 Files (naqsha)

| File | Kaam |
|---|---|
| **`PHASE-TWO-INFORMATION.md`** | ⭐ **Zabta + mansooba** — 109 numbered rules (U/R/E/S/P/B/Z/T/M/Q) |
| **`INPUT-INFORMATION.md`** | Part 1: master spec **hoobahoo** • Part 2: A-01…A-49 (tay shuda) + Q-01…Q-19 (aap ke faisle) |
| **`complete_numbered_master_specs (1).md`** | Asal master spec — **Single Source of Truth** |
| `src/` | App ka code (Next.js + TypeScript) |
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

## 🚦 Kaam ki tarakki

| Stage | Kaam | Haal |
|---|---|---|
| **Stone 0** | Repo, checkpoint system, spec, numbered rule book | ✅ Complete |
| **Stone 0.5** | Next.js + database + **live preview** + **editable settings** | ✅ **Complete** |
| **Phase 1** | Products, purchases (PINV), batches/expiry, counter billing, round-off, print | ✅ **Mostly complete** (role switcher baqi) |
| Phase 2 | Returns, cash closing, owner drawing, expenses | ⏳ |
| Phase 3 | Suppliers, expiry alerts, reorder + WhatsApp order, samples | ⏳ |
| Phase 4 | Customers, loyalty, multi-tier rates, split payments, custom fields | ⏳ |
| Phase 5 | Blackbox audit, smart search, analytics, Supabase sync, backups | ⏳ |

---

## 💡 Yaad rahe

- **Har cheez badli ja sakti hai** — app ka naam, logo, rang, dukan ki maloomat, categories, expiry levels, receipt layout… sab `Settings` se. Koi code change nahi.
- **Frontend se badlav → database me khud-ba-khud** — jo screen par banaein, wohi data me jata hai.
- **Kuch bhi final nahi** — jab jo chahe tab badal lein.
