import { audit } from "./audit";
// ---------------------------------------------------------------------------
// Area11 - Users (staff accounts: Owner / Manager / Cashier)
// ---------------------------------------------------------------------------
// Rules:
//  - Naam unique (chhote/bare letters ek jaisa)
//  - Owner ke paas password, staff ke paas 4-hindsi PIN
//  - Aakhri active owner ko band ya demote nahi kiya ja sakta
//  - User kabhi delete nahi hota -- sirf active = 0 (data kabhi na mite)
// ---------------------------------------------------------------------------

import { get, query, run } from "./db";
import { hashSecret, isValidPassword, isValidPin, verifySecret } from "./auth";
import { isRole, ROLES, type Role } from "./roles";

export type UserRow = {
  id: number;
  name: string;
  role: string;
  active: number;
  phone: string | null;
  last_login_at: string | null;
  created_at: string;
};

/** DB row + secret columns (sirf andar istemal -- bahar kabhi nahi jate) */
type UserSecretRow = UserRow & { pin_hash: string | null; password_hash: string | null };

export type UserPublic = {
  id: number;
  name: string;
  role: string;
  active: boolean;
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

function toPublic(u: UserRow): UserPublic {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    active: !!u.active,
    phone: u.phone,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  };
}

export function listUsers(): UserPublic[] {
  return query<UserRow>(
    `SELECT id, name, role, active, phone, last_login_at, created_at
     FROM users ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, id`
  ).map(toPublic);
}

export function getUser(id: number): UserPublic | null {
  const u = get<UserRow>(
    `SELECT id, name, role, active, phone, last_login_at, created_at FROM users WHERE id = ?`,
    [id]
  );
  return u ? toPublic(u) : null;
}

function nameTaken(name: string, exceptId?: number): boolean {
  const row = get<{ id: number }>(
    `SELECT id FROM users WHERE lower(name) = lower(?) AND id <> ? LIMIT 1`,
    [name, exceptId ?? -1]
  );
  return !!row;
}

function activeOwnerCount(exceptId?: number): number {
  return (
    get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM users WHERE role = 'owner' AND active = 1 AND id <> ?`,
      [exceptId ?? -1]
    )?.c ?? 0
  );
}

export type UserInput = {
  name: string;
  role: string;
  pin?: string;
  password?: string;
  phone?: string | null;
  active?: boolean;
};

/** Naya user banao (sirf owner kar sakta hai -- check API me hota hai) */
export function createUser(
  input: UserInput,
  pinLength = 4,
  /** Spec 2: kaun bana raha hai (actor) -- log me isi ka naam jayega */
  actor?: { id?: number; name?: string } | null
): number {
  const name = (input.name ?? "").trim();
  if (name.length < 2) throw new Error("Name is too short");
  if (!isRole(input.role)) throw new Error("Role must be owner, manager or cashier");
  const role: Role = input.role;
  if (nameTaken(name)) throw new Error("This name is already used by another account");

  const pin = (input.pin ?? "").trim();
  const password = (input.password ?? "").trim();

  if (role === "owner") {
    if (!isValidPassword(password)) throw new Error("Owner needs a password (at least 4 characters)");
  } else if (!isValidPin(pin, pinLength)) {
    throw new Error(`Staff PIN must be ${pinLength}–8 digits`);
  }

  run(
    `INSERT INTO users (name, role, pin_hash, password_hash, phone, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      name,
      role,
      pin ? hashSecret(pin) : null,
      password ? hashSecret(password) : null,
      input.phone ?? null,
      input.active === false ? 0 : 1,
    ]
  );
  const row = get<{ id: number }>(`SELECT id FROM users WHERE lower(name) = lower(?)`, [name]);
  const newId = row?.id ?? 0;
  // Spec 2: naya staff account bhi record ho (PIN/password KABHI log nahi hota)
  void audit({
    action: "create",
    userId: actor?.id ?? null,
    userName: actor?.name ?? null,
    entity: "User",
    entityId: newId,
    module: "Users",
    before: null,
    after: { name, role, active: input.active === false ? 0 : 1, phone: input.phone ?? null },
    details: { name, role, note: "PIN/password kabhi log nahi hota" },
  });
  return newId;
}

/** User update karo (naam, role, PIN/password, active) */
export function updateUser(
  id: number,
  patch: Partial<UserInput>,
  pinLength = 4,
  /** Spec 2: kaun badal raha hai (actor) */
  actor?: { id?: number; name?: string } | null
): void {
  const current = get<UserSecretRow>(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!current) throw new Error("User not found");

  const name = patch.name !== undefined ? patch.name.trim() : current.name;
  if (name.length < 2) throw new Error("Name is too short");
  if (nameTaken(name, id)) throw new Error("This name is already used by another account");

  const role = patch.role !== undefined ? patch.role : current.role;
  if (!isRole(role)) throw new Error("Role must be owner, manager or cashier");

  const active = patch.active !== undefined ? (patch.active ? 1 : 0) : current.active;

  // Aakhri active owner ka khayal
  const wasActiveOwner = current.role === "owner" && current.active === 1;
  const stillActiveOwner = role === "owner" && active === 1;
  if (wasActiveOwner && !stillActiveOwner && activeOwnerCount(id) === 0) {
    throw new Error("There must always be at least one active owner");
  }

  const pin = (patch.pin ?? "").trim();
  const password = (patch.password ?? "").trim();
  if (pin && !isValidPin(pin, pinLength)) throw new Error(`PIN must be ${pinLength}–8 digits`);
  if (password && !isValidPassword(password)) throw new Error("Password is too short (at least 4 characters)");
  if (role === "owner" && !password && !current.password_hash) {
    throw new Error("Owner needs a password");
  }

  run(
    `UPDATE users SET name = ?, role = ?, active = ?, phone = ?,
       pin_hash = CASE WHEN ? THEN ? ELSE pin_hash END,
       password_hash = CASE WHEN ? THEN ? ELSE password_hash END
     WHERE id = ?`,
    [
      name,
      role,
      active,
      patch.phone !== undefined ? patch.phone : current.phone,
      pin ? 1 : 0,
      pin ? hashSecret(pin) : null,
      password ? 1 : 0,
      password ? hashSecret(password) : null,
      id,
    ]
  );

  // Spec 2: purana record → naya record (PIN/password ke baghair)
  const after = get<{ name: string; role: string; active: number; phone: string | null }>(
    "SELECT name, role, active, phone FROM users WHERE id = ?", [id]);
  void audit({
    action: "update",
    userId: actor?.id ?? null,
    userName: actor?.name ?? null,
    entity: "User",
    entityId: id,
    module: "Users",
    before: { name: current.name, role: current.role, active: current.active, phone: current.phone ?? null },
    after: after
      ? {
          name: after.name,
          role: after.role,
          active: after.active,
          phone: after.phone ?? null,
          pin_changed: pin ? 1 : 0,
          password_changed: password ? 1 : 0,
        }
      : null,
    details: { name: after?.name ?? name },
  });
}

export type LoginResult =
  | { ok: true; user: { id: number; name: string; role: string } }
  | { ok: false; error: string };

/** Login check: owner = password, staff = naam + PIN */
export function checkLogin(input: {
  mode: "owner" | "staff";
  name?: string;
  password?: string;
  pin?: string;
}): LoginResult {
  if (input.mode === "owner") {
    const owner = get<UserSecretRow>(
      `SELECT * FROM users WHERE role = 'owner' AND active = 1 ORDER BY id LIMIT 1`
    );
    if (!owner) return { ok: false, error: "No owner account found" };
    if (!verifySecret((input.password ?? "").trim(), owner.password_hash)) {
      return { ok: false, error: "Wrong owner password" };
    }
    // Owner ke paas PIN bhi ho to PIN se bhi login ho sakta hai (suvidha)
    return { ok: true, user: { id: owner.id, name: owner.name, role: owner.role } };
  }

  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Please enter your name" };
  const staff = get<UserSecretRow>(
    `SELECT * FROM users WHERE lower(name) = lower(?) AND active = 1 AND role <> 'owner' LIMIT 1`,
    [name]
  );
  if (!staff) return { ok: false, error: "No active staff account with this name" };
  if (!verifySecret((input.pin ?? "").trim(), staff.pin_hash)) {
    return { ok: false, error: "Wrong PIN" };
  }
  return { ok: true, user: { id: staff.id, name: staff.name, role: staff.role } };
}

export const ALL_ROLES = ROLES;
