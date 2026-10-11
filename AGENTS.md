# AGENTS.md

**Start with [`HANDOFF.md`](./HANDOFF.md)** — current status (done / remaining), run instructions, gotchas, hosting, rollback. It is the memory of this project: **update it (§3 + §4) and `README.md` after every piece of work.**

Last updated: **2026-10-11** · PR **#3** (v0.6.2) **MERGED** 2026-10-08 aur PR **#4** (duplicate-column migration fix) **MERGED** 2026-10-08 → `main` ab `e28445d` par hai. Is session ki branch: **`arena/a7d731d5-area11`**. Aaj ke kaam: malik ke **2 naye ahkaam (U-37 old-folder policy, U-38 teen zabanen)** zabte me darj hue (138 numbered points, `rules-count.sh` = `SAB THEEK`). Newest checkpoint: **stage-45** (2026-10-08, `docs/BRANCH-AUR-MERGE.md`); aakhri **code** checkpoint stage-43 (review ka doosra dour + supplier overpayment alert). stage-44/45 sirf docs thay. Malik ke liye mukammal Urdu dastavez: `docs/APP-TAFSEEL.md` (§9–§12j is kaam ki tafseel). Phase 1 complete at **stage-14**; Phase 2 essentials (cash shifts, lost-bill/rush-time returns) at **stage-16**; customization wave (custom fields, detail pages, click-to-open settings, room field, photos in folder, filters & groups) at **stages 17–20**; black box + backup/restore at **stage-19**; **Spec 1–4 at stages 35 + 37**; **malik ke 4 ahkaam (U-30…U-33) at stage-38**; **wapasi ki raseed (`RET-0001`) at stage-39**; **review (wapasi ki laagat ka hisaabi nuqs) at stage-40**; **quarantine ka pakka number (`Q-0001`) at stage-41**; **Settings ki safai at stage-42**; **review dour 2 at stage-43**. Current status/next work lives in `HANDOFF.md` §3–§4.

Non-negotiables (details in `PHASE-TWO-INFORMATION.md`, **138 numbered rules** — 11-Oct-2026 tak):

1. Spec = `complete_numbered_master_specs (1).md`; build phases in order; owner's 19 questions are **already answered** (`INPUT-INFORMATION.md` Q-01…Q-19) — don't re-ask. New questions → chat multiple-choice only, never in files.
2. Real app = repo root (Next.js 15 + TypeScript + `node:sqlite`; **no Prisma**). `legacy-demo-vite/` = reference only (its own Vite project; it is what the public Netlify demo publishes).
3. Reuse existing code; write the minimum new code. Everything user-visible must be editable via Settings; UI changes must reach the DB automatically. **Customization First (`U-17`):** owner-defined fields everywhere, click-any-row detail pages, small clickable option blocks inside Settings, and filters/sorting/groups on every list.
4. Money = integer paisa. Writes inside `tx()`. Never delete data. New DB changes = new migration appended in `src/lib/schema.ts`.
5. Keep `npx tsc --noEmit` at 0 errors, `npm run build` passing, and `bash scripts/rules-count.sh` at `SAB THEEK`.
6. After every piece of work: `bash scripts/ckpt.sh save "…"` + `push`, update `HANDOFF.md` (§3/§4) and README. Never delete tags or force-push. **Git must be updated with every single change (`U-23`)** — code *and* docs, so the chat can be closed at any moment.
7. The real app needs a **Node ≥ 22.5 host with a persistent disk** (shop PC or a Node host with a volume). Netlify/Vercel/Pages can only serve the static demo — never the SQLite app.
8. Talk to the owner (Dr. Adil Abdullah) in Urdu.

9. Malik ke naye ahkaam (7-Oct-2026, `PHASE-TWO-INFORMATION.md` me **U-30…U-36**):
   - **U-30** manfi stock (ya koi bhi aisi surat) **kahin bhi kaam na roke — sirf ALERT**.
   - **U-31** har alert **sirf MALIK** wajah likh kar khatam kare; wajah DB (`alert_dismissals`) + black box me mehfooz.
   - **U-32** wapsi ka maal **foran stock** me (quarantine nahi).
   - **U-33** bina-bill wapsi: stock foran + alert **tab tak** jab tak malik wajah na likhe (bill jurne ke baad bhi).
   - **U-34** quarantine me har saman ka **mustaqil number** (`Q-0001`) + anjam (stock / expiry-kharaab / frookht) + poori history.
   - **U-35** har wapsi ki **chhapne wali raseed** (pakka number `RET-0001`).
   - **U-36** kaam **ek ek kar ke**: raseed → nazar-e-saani + report → bekar linein khatam.

10. Malik ke ahkaam (11-Oct-2026, **U-37 + U-38**):
   - **U-37 — purana kaam kabhi na mite («old» folder policy):** nayi technology / naya kaam shuru ho to purana code **delete nahi** — ek alag folder me (jaise `old/` ya `old-data/`) rakh dein; naam + README + comments se zahir ho ke **ye purana hai**, aur wo **naye kaam ke raste me na aaye** (build / test / import me shamil na ho — sirf reference). Misal is repo me maujood: `legacy-demo-vite/`. Git history hamesha barqarar (na delete, na force-push).
   - **U-38 — app ki zaban ke 3 option (Settings se):** (a) **khalis Pakistani Urdu rasm-ul-khat** · (b) **Roman Urdu** (Urdu, English huroof me) · (c) **100% asal English**. **Default = English**; Settings me zaban par click karte hi **poori app** usi zaban me (har screen, button, receipt, report). Ye `E-12` + `S-05` ka amli nafaz hai. **Note:** `ui.language` ki line stage-42 me "bekar" keh kar `src/lib/settings.ts` se hata di gayi thi — ab wo **kaam karte hue** wapas aayegi (sirf setting ki line nahi, har screen par asar). ⏳ **abhi banana baqi hai.**
