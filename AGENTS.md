# AGENTS.md

**Start with [`HANDOFF.md`](./HANDOFF.md)** — current status, TODO list, run instructions, gotchas, rollback.

Non-negotiables (details in `PHASE-TWO-INFORMATION.md`, 116 numbered rules):

1. Spec = `complete_numbered_master_specs (1).md`; build phases in order; owner's 19 questions are **already answered** (`INPUT-INFORMATION.md` Q-01…Q-19) — don't re-ask. New questions → chat multiple-choice only, never in files.
2. Real app = repo root (Next.js 15 + TypeScript + `node:sqlite`; **no Prisma**). `legacy-demo-vite/` = reference only.
3. Reuse existing code; write the minimum new code. Everything user-visible must be editable via Settings; UI changes must reach the DB automatically.
4. Money = integer paisa. Writes inside `tx()`. Never delete data. New DB changes = new migration appended in `src/lib/schema.ts`.
5. Keep `npx tsc --noEmit` at 0 errors and `bash scripts/rules-count.sh` at `SAB THEEK`.
6. After every piece of work: `bash scripts/ckpt.sh save "…"` + `push`, update `HANDOFF.md` (§3/§4) and README. Never delete tags or force-push.
7. Talk to the owner (Dr. Adil Abdullah) in Urdu.
