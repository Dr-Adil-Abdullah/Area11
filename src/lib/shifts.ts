// ---------------------------------------------------------------------------
// Area11 - Cash shift (galla / shift): kholna, zinda hisaab, band karna, farq
// ---------------------------------------------------------------------------
// Soch (spec Phase 2, legacy demo ka cash.ts se ideas):
//   khula hua galla = opening float + is shift ke dauran hui sari cash harkat
//   band karte waqt cashier GINTA hai -> expected vs actual -> farq (variance)
// Farq khud data ko nahi badalta -- sirf record hota hai (owner ke liye sabak).
// ---------------------------------------------------------------------------

import { get, query, run, tx } from "./db";
import { audit } from "./audit";
import { expectedCashOf, varianceOf } from "./shift-math";

export { expectedCashOf, varianceOf };

type U = { id?: number; name?: string } | null | undefined;

export type ShiftRow = {
  id: number;
  user_id: number | null;
  opened_at: string;
  closed_at: string | null;
  opening_float_paisa: number;
  expected_paisa: number | null;
  actual_paisa: number | null;
  difference_paisa: number | null;
  status: string;
  note: string | null;
  user_name?: string | null;
  // handover (migration 009)
  handed_to_user_id?: number | null;
  handed_to_name?: string | null;
  opened_from_shift_id?: number | null;
};

export type ShiftFlow = {
  from: string;
  to: string;
  openingFloatPaisa: number;
  cashSales: number;      // counter par wasool
  collections: number;    // purana udhaar wasool
  refunds: number;        // wapsi (cash bahar)
  supplierPaid: number;
  expenses: number;
  drawings: number;
  expectedPaisa: number;  // = float + sab andar - sab bahar
  bills: number;
};

export function currentShift(): ShiftRow | undefined {
  return get<ShiftRow>(
    `SELECT s.*, u.name AS user_name
       FROM shifts s LEFT JOIN users u ON u.id = s.user_id
      WHERE s.status = 'open'
      ORDER BY s.id DESC LIMIT 1`
  );
}

export function getShift(id: number): ShiftRow | undefined {
  return get<ShiftRow>(
    `SELECT s.*, u.name AS user_name
       FROM shifts s LEFT JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`,
    [id]
  );
}

/** Khula galla kholo (agar pehle se khula ho to mana kar do) */
export function openShift(openingFloatPaisa: number, user?: U, note?: string | null): { id: number } {
  const open = currentShift();
  if (open) {
    throw new Error(`Shift pehle se khuli hui hai (${open.user_name ?? "user"}, ${open.opened_at}) — pehle band karein.`);
  }
  const float = Math.max(0, Math.round(openingFloatPaisa || 0));
  const res = run(
    `INSERT INTO shifts (user_id, opening_float_paisa, status, note) VALUES (?,?, 'open', ?)`,
    [user?.id ?? null, float, note?.trim() || null]
  );
  void audit({
    action: "create", userId: user?.id, userName: user?.name,
    entity: "Shift", entityId: res.lastInsertRowid, module: "Customers",
    before: null, after: { status: "open", opening_float_paisa: float },
    details: { openingFloatPaisa: float },
  });
  return { id: res.lastInsertRowid };
}

/** Shift ke waqt me hone wali sari cash harkat + expected galla */
export function shiftFlow(shiftId: number): ShiftFlow {
  const s = getShift(shiftId);
  if (!s) throw new Error("Shift nahi mili");
  const from = s.opened_at;
  const to = s.closed_at ?? new Date().toISOString().slice(0, 19).replace("T", " ");

  const n = (sql: string, params: (string | number)[]) => get<{ v: number }>(sql, params)?.v ?? 0;

  // Counter par wasool (sale) -- sirf cash
  const cashSales = n(
    `SELECT COALESCE(SUM(amount_paisa),0) v FROM payments
      WHERE method='cash' AND sale_id IS NOT NULL AND amount_paisa > 0
        AND date BETWEEN ? AND ?`,
    [from, to]
  );
  // Purana udhaar wasool (customer payment -- na sale na purchase)
  const collections = n(
    `SELECT COALESCE(SUM(amount_paisa),0) v FROM payments
      WHERE method='cash' AND sale_id IS NULL AND purchase_id IS NULL AND supplier_id IS NULL
        AND amount_paisa > 0 AND date BETWEEN ? AND ?`,
    [from, to]
  );
  // Cash wapsi (refund) -- payments me manfi rows
  const refunds = -n(
    `SELECT COALESCE(SUM(amount_paisa),0) v FROM payments
      WHERE method='cash' AND amount_paisa < 0 AND date BETWEEN ? AND ?`,
    [from, to]
  );
  const supplierPaid = n(
    `SELECT COALESCE(SUM(amount_paisa),0) v FROM payments
      WHERE method='cash' AND (purchase_id IS NOT NULL OR supplier_id IS NOT NULL)
        AND amount_paisa > 0 AND date BETWEEN ? AND ?`,
    [from, to]
  );
  const expenses = n(`SELECT COALESCE(SUM(amount_paisa),0) v FROM expenses WHERE date BETWEEN ? AND ?`, [from, to]);
  const drawings = n(
    `SELECT COALESCE(SUM(amount_paisa),0) v FROM owner_drawings WHERE type='cash' AND date BETWEEN ? AND ?`,
    [from, to]
  );
  const bills = n(`SELECT COUNT(*) v FROM sales WHERE status <> 'void' AND date BETWEEN ? AND ?`, [from, to]);

  const expectedPaisa = expectedCashOf(s.opening_float_paisa, {
    cashSales, collections, refunds, supplierPaid, expenses, drawings,
  });
  return {
    from, to,
    openingFloatPaisa: s.opening_float_paisa,
    cashSales, collections, refunds, supplierPaid, expenses, drawings,
    expectedPaisa, bills,
  };
}

export type CloseShiftInput = {
  /** Ginta hua cash */
  actualPaisa: number;
  note?: string | null;
  /** Agla kaun senbhalega (user id) */
  handedToUserId?: number | null;
  /** Ginta hua cash agle shift ka opening float ban jaye? */
  openNext?: boolean;
};

/** Ginta hua cash de kar shift band karo -> farq mehfooz (+ handover) */
export function closeShift(input: CloseShiftInput, user?: U): {
  id: number; expectedPaisa: number; actualPaisa: number; differencePaisa: number;
  nextShiftId: number | null; handedToName: string | null;
} {
  return tx(() => {
    const open = currentShift();
    if (!open) throw new Error("Koi shift khuli hui nahi hai.");
    const flow = shiftFlow(open.id);
    const actual = Math.max(0, Math.round(input.actualPaisa || 0));
    const difference = varianceOf(flow.expectedPaisa, actual);

    let handedToName: string | null = null;
    if (input.handedToUserId) {
      const to = get<{ id: number; name: string }>("SELECT id, name FROM users WHERE id = ?", [input.handedToUserId]);
      if (!to) throw new Error("Ye banda app me nahi mila — handover nahi ho sakta.");
      handedToName = to.name;
    }

    run(
      `UPDATE shifts
          SET closed_at = datetime('now','localtime'),
              expected_paisa = ?, actual_paisa = ?, difference_paisa = ?,
              status = 'closed', note = COALESCE(?, note),
              handed_to_user_id = ?, handed_to_name = ?
        WHERE id = ?`,
      [
        flow.expectedPaisa, actual, difference,
        input.note?.trim() || null,
        input.handedToUserId ?? null, handedToName,
        open.id,
      ]
    );
    void audit({
      action: "update", userId: user?.id, userName: user?.name,
      entity: "Shift", entityId: open.id, module: "Customers",
      before: { status: "open", opening_float_paisa: open.opening_float_paisa ?? null, closed_at: null },
      after: {
        status: "closed",
        opening_float_paisa: open.opening_float_paisa ?? null,
        expected_paisa: flow.expectedPaisa,
        actual_paisa: actual,
        difference_paisa: difference,
        handed_to_name: handedToName ?? null,
      },
      details: {
        expectedPaisa: flow.expectedPaisa, actualPaisa: actual, differencePaisa: difference,
        handedToName, openNext: Boolean(input.openNext),
      },
    });

    // Agla shift isi ginte hue cash se kholo (handover ka asal matlab)
    let nextShiftId: number | null = null;
    if (input.openNext) {
      const res = run(
        `INSERT INTO shifts (user_id, opening_float_paisa, status, note, opened_from_shift_id)
         VALUES (?,?, 'open', ?, ?)`,
        [
          input.handedToUserId ?? null,
          actual,
          handedToName ? `Handover from ${open.user_name ?? "shift"} to ${handedToName}` : null,
          open.id,
        ]
      );
      nextShiftId = Number(res.lastInsertRowid);
      void audit({
        action: "create", userId: input.handedToUserId ?? null, userName: handedToName,
        entity: "Shift", entityId: nextShiftId, module: "Customers",
        before: null,
        after: { status: "open", opening_float_paisa: actual, from_shift_id: open.id },
        details: { openingFloatPaisa: actual, fromShiftId: open.id },
      });
    }

    return {
      id: open.id,
      expectedPaisa: flow.expectedPaisa,
      actualPaisa: actual,
      differencePaisa: difference,
      nextShiftId,
      handedToName,
    };
  });
}

/** Is shift me kitne bill bane */
function flow0(shiftId: number): number {
  const s = getShift(shiftId);
  if (!s) return 0;
  const to = s.closed_at ?? new Date().toISOString().slice(0, 19).replace("T", " ");
  return (
    get<{ v: number }>(
      `SELECT COUNT(*) v FROM sales WHERE status <> 'void' AND date BETWEEN ? AND ?`,
      [s.opened_at, to]
    )?.v ?? 0
  );
}

export type HandoverSlip = {
  shift: ShiftRow & { handed_to_name?: string | null };
  flow: ShiftFlow;
  handedTo: string | null;
  nextShiftId: number | null;
  bills: number;
};

/** Handover parchi ke liye poora hisaab (chhapne layak) */
export function handoverSlip(shiftId: number): HandoverSlip {
  const s = getShift(shiftId);
  if (!s) throw new Error("Shift nahi mili.");
  const next = get<{ id: number }>("SELECT id FROM shifts WHERE opened_from_shift_id = ?", [shiftId]);
  return {
    shift: s,
    flow: shiftFlow(shiftId),
    handedTo: s.handed_to_name ?? null,
    nextShiftId: next?.id ?? null,
    bills: flow0(shiftId),
  };
}

/** Handover ke liye users ki chhoti fehrist */
export function shiftUsers(): { id: number; name: string; role: string }[] {
  return query<{ id: number; name: string; role: string }>(
    `SELECT id, name, role FROM users WHERE active = 1 ORDER BY role, name`
  );
}

/** Purani shifts (history) */
export function listShifts(limit = 20): ShiftRow[] {
  return query<ShiftRow>(
    `SELECT s.*, u.name AS user_name
       FROM shifts s LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.id DESC LIMIT ?`,
    [Math.max(1, Math.min(200, limit))]
  );
}

/** Aaj ki total farq (owner ke liye ek nazar me) */
export function shiftVarianceToday(): number {
  return get<{ v: number }>(
    `SELECT COALESCE(SUM(difference_paisa),0) v FROM shifts
      WHERE status='closed' AND date(closed_at) = date('now','localtime')`
  )?.v ?? 0;
}
