import { type AppState, type Role, type CashEntry, DomainError, uid, invoiceNumber } from './model'

export const openSession = (state: AppState) => state.cashSessions.find((s) => s.status === 'open')
export function expectedCash(state: AppState, sessionId: string): number {
  const session = state.cashSessions.find((s) => s.id === sessionId)
  if (!session) throw new DomainError('Cash shift not found.')
  const value = state.cashEntries
    .filter((e) => e.sessionId === sessionId)
    .reduce((sum, e) => sum + BigInt(e.amount), BigInt(session.opening))
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new DomainError('Cash balance exceeds the safe monetary range.')
  return Number(value)
}
export function requireOpenSession(state: AppState) {
  const session = openSession(state)
  if (!session)
    throw new DomainError(
      'Open a cash shift and enter the opening float before recording a cash transaction.',
    )
  return session
}
function nonnegativeAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new DomainError('Enter a valid non-negative cash amount.')
}
export function openCashSession(
  state: AppState,
  opening: number,
  operator: string,
  role: Role,
  now: string,
): AppState {
  nonnegativeAmount(opening)
  if (openSession(state))
    throw new DomainError('A cash shift is already open. Close or hand it over first.')
  if (operator.trim().length < 2 || operator.trim().length > 60)
    throw new DomainError('Enter an operator label (2–60 characters).')
  const last = state.cashSessions.at(-1)
  if (last?.closedAt && now < last.closedAt)
    throw new DomainError('A new shift cannot open before the previous closing time.')
  return {
    ...state,
    nextCashSessionNumber: state.nextCashSessionNumber + 1,
    cashSessions: [
      ...state.cashSessions,
      {
        id: uid(),
        number: invoiceNumber('SHIFT', state.nextCashSessionNumber),
        operator: operator.trim(),
        opening,
        openedAt: now,
        openedBy: role,
        status: 'open',
        closedAt: null,
        closedBy: null,
        counted: null,
        expectedAtClose: null,
        variance: null,
        closeNote: '',
        previousSessionId: null,
        handoverTo: null,
      },
    ],
  }
}

/** Each cash transaction has exactly one source reference and belongs to the current shift. */
export function recordCash(
  state: AppState,
  kind: CashEntry['kind'],
  amount: number,
  refId: string,
  role: Role,
  now: string,
): AppState {
  const session = requireOpenSession(state)
  if (!Number.isSafeInteger(amount)) throw new DomainError('Invalid cash movement.')
  if (now < session.openedAt)
    throw new DomainError('A cash movement cannot precede its opening shift.')
  const lastMovement = state.cashEntries.filter((e) => e.sessionId === session.id).at(-1)
  if (lastMovement && now < lastMovement.createdAt)
    throw new DomainError('Cash movements cannot be backdated. Check the device clock.')
  if (state.cashEntries.some((e) => e.kind === kind && e.refId === refId))
    throw new DomainError('This cash transaction has already been recorded.')
  const after = expectedCash(state, session.id) + amount
  if (!Number.isSafeInteger(after) || after < 0)
    throw new DomainError('Not enough cash in the current drawer for this payment.')
  return {
    ...state,
    cashEntries: [
      ...state.cashEntries,
      { id: uid(), sessionId: session.id, createdAt: now, role, kind, amount, refId },
    ],
  }
}
export function closeCashSession(
  state: AppState,
  counted: number,
  note: string,
  role: Role,
  now: string,
): AppState {
  nonnegativeAmount(counted)
  const session = requireOpenSession(state)
  if (now < session.openedAt) throw new DomainError('Closing time cannot precede opening time.')
  const lastMovement = state.cashEntries.filter((e) => e.sessionId === session.id).at(-1)
  if (lastMovement && now < lastMovement.createdAt)
    throw new DomainError('Closing cannot precede the last cash movement. Check the device clock.')
  const expected = expectedCash(state, session.id)
  const variance = counted - expected
  if (variance && note.trim().length < 2)
    throw new DomainError('Explain the cash difference before closing this shift.')
  if (note.trim().length > 300) throw new DomainError('Closing note is too long.')
  return {
    ...state,
    cashSessions: state.cashSessions.map((s) =>
      s.id === session.id
        ? {
            ...s,
            status: 'closed',
            closedAt: now,
            closedBy: role,
            counted,
            expectedAtClose: expected,
            variance,
            closeNote: note.trim(),
          }
        : s,
    ),
  }
}
export function handoverCashSession(
  state: AppState,
  counted: number,
  note: string,
  nextOperator: string,
  role: Role,
  now: string,
): AppState {
  const old = requireOpenSession(state)
  const closed = closeCashSession(state, counted, note, role, now)
  const next = openCashSession(closed, counted, nextOperator, role, now)
  const newSession = next.cashSessions.at(-1)!
  return {
    ...next,
    cashSessions: next.cashSessions.map((s) =>
      s.id === old.id
        ? { ...s, handoverTo: newSession.id }
        : s.id === newSession.id
          ? { ...s, previousSessionId: old.id }
          : s,
    ),
  }
}
