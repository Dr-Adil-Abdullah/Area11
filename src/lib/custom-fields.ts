// ---------------------------------------------------------------------------
// Area11 - Custom fields: owner khud nayi fields bana sakta hai
// ---------------------------------------------------------------------------
// Misal: Customer ke liye "CNIC", "Address", "Birthday", ya Product ke liye
// "Shelf", "Company code". Koi field kabhi delete nahi hoti -- sirf band hoti
// hai (active=0), taake us ki values mehfooz rahein.
// ---------------------------------------------------------------------------

import { get, query, run } from "./db";
import { audit } from "./audit";
import { ENTITIES, TYPES, parseOptions, type CustomEntity, type CustomField, type CustomFieldType } from "./custom-fields-shared";

export { ENTITIES, TYPES, parseOptions };
export type { CustomEntity, CustomField, CustomFieldType };

type U = { id?: number; name?: string } | null | undefined;



type RawField = {
  id: number;
  entity: string;
  label: string;
  type: string;
  options_json: string | null;
  required: number;
  active: number;
  sort: number;
};



function toField(r: RawField): CustomField {
  return {
    id: r.id,
    entity: r.entity as CustomEntity,
    label: r.label,
    type: (TYPES.includes(r.type as CustomFieldType) ? r.type : "text") as CustomFieldType,
    options: parseOptions(r.options_json),
    required: r.required,
    active: r.active,
    sort: r.sort,
  };
}

/** Fields (default: sirf chalu wali). includeInactive=true se settings me sab dikhein */
export function listCustomFields(entity?: CustomEntity, includeInactive = false): CustomField[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (entity) {
    where.push("entity = ?");
    params.push(entity);
  }
  if (!includeInactive) where.push("active = 1");
  const sql = `SELECT * FROM custom_fields ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY entity, sort, id`;
  return query<RawField>(sql, params).map(toField);
}

export function createCustomField(
  input: { entity: CustomEntity; label: string; type?: CustomFieldType; options?: string[] | string; required?: boolean },
  user?: U
): number {
  const label = (input.label ?? "").trim();
  if (!label) throw new Error("Field ka naam likhein (jaise CNIC / Shelf).");
  const entity = ENTITIES.some((e) => e.value === input.entity) ? input.entity : null;
  if (!entity) throw new Error("entity customer / product / supplier honi chahiye.");
  const type: CustomFieldType = TYPES.includes(input.type as CustomFieldType)
    ? (input.type as CustomFieldType)
    : "text";
  const options = Array.isArray(input.options) ? input.options : parseOptions(input.options ?? null);
  if (type === "select" && options.length === 0) throw new Error("Select field ke liye kam az kam ek option likhein.");

  const dupe = get<{ id: number }>("SELECT id FROM custom_fields WHERE entity = ? AND lower(label) = ?", [
    entity,
    label.toLowerCase(),
  ]);
  if (dupe) return dupe.id;

  const sort = get<{ v: number }>(
    "SELECT COALESCE(MAX(sort), 0) + 1 v FROM custom_fields WHERE entity = ?",
    [entity]
  )?.v ?? 1;

  const id = run(
    `INSERT INTO custom_fields (entity, label, type, options_json, required, active, sort)
     VALUES (?,?,?,?,?,1,?)`,
    [entity, label, type, options.length ? JSON.stringify(options) : null, input.required ? 1 : 0, sort]
  ).lastInsertRowid;

  void audit({
    action: "create", userId: user?.id ?? null, userName: user?.name ?? null,
    entity: "CustomField", entityId: id, details: { entity, label, type },
  });
  return id;
}

export function updateCustomField(
  id: number,
  patch: { label?: string; options?: string[] | string; required?: boolean; active?: boolean; sort?: number },
  user?: U
): void {
  const f = get<RawField>("SELECT * FROM custom_fields WHERE id = ?", [id]);
  if (!f) throw new Error("Field nahi mili.");
  const label = patch.label?.trim() || f.label;
  const options = patch.options !== undefined ? (Array.isArray(patch.options) ? patch.options : parseOptions(patch.options)) : parseOptions(f.options_json);
  const required = patch.required === undefined ? f.required : patch.required ? 1 : 0;
  const active = patch.active === undefined ? f.active : patch.active ? 1 : 0;
  const sort = patch.sort === undefined ? f.sort : Math.round(patch.sort);
  run(
    `UPDATE custom_fields SET label = ?, options_json = ?, required = ?, active = ?, sort = ? WHERE id = ?`,
    [label, options.length ? JSON.stringify(options) : null, required, active, sort, id]
  );
  void audit({
    action: "update", userId: user?.id ?? null, userName: user?.name ?? null,
    entity: "CustomField", entityId: id, details: { label, active },
  });
}

/** Values: { "<fieldId>": "value" } */
export function getCustomValues(entity: CustomEntity, entityId: number): Record<string, string> {
  const rows = query<{ field_id: number; value: string | null }>(
    "SELECT field_id, value FROM custom_values WHERE entity = ? AND entity_id = ?",
    [entity, entityId]
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[String(r.field_id)] = r.value ?? "";
  return out;
}

/** Saari values ek dafa (list ke liye: id -> {fieldId: value}) */
export function getCustomValuesBulk(entity: CustomEntity, ids: number[]): Record<number, Record<string, string>> {
  if (!ids.length) return {};
  const ph = ids.map(() => "?").join(",");
  const rows = query<{ entity_id: number; field_id: number; value: string | null }>(
    `SELECT entity_id, field_id, value FROM custom_values WHERE entity = ? AND entity_id IN (${ph})`,
    [entity, ...ids]
  );
  const out: Record<number, Record<string, string>> = {};
  for (const id of ids) out[id] = {};
  for (const r of rows) out[r.entity_id][String(r.field_id)] = r.value ?? "";
  return out;
}

/**
 * Pehle SIRF janch karo (kuch nahi likhta). create/update se pehle chalao taake
 * zaroori field khali ho to naya product/gahak banney se pehle hi rok lage.
 */
export function validateCustomValues(entity: CustomEntity, values: Record<string, unknown>): void {
  const fields = listCustomFields(entity);
  for (const f of fields) {
    if (!(String(f.id) in values)) continue;
    const raw = values[String(f.id)];
    const val = raw === null || raw === undefined ? "" : String(raw).trim();
    if (f.required && f.type !== "check" && val === "") {
      throw new Error(`"${f.label}" zaroori hai — khali nahi chhod sakte.`);
    }
    if (val !== "" && f.type === "select" && f.options.length && !f.options.includes(val)) {
      throw new Error(`"${f.label}": "${val}" sahi option nahi (${f.options.join(" / ")}).`);
    }
    if (val !== "" && f.type === "number" && !Number.isFinite(Number(val))) {
      throw new Error(`"${f.label}" me sirf number likhein.`);
    }
  }
}

/** Values save karo (jo fields band ho chuki hain un ki values nahi chhedte) */
export function setCustomValues(
  entity: CustomEntity,
  entityId: number,
  values: Record<string, unknown>,
  user?: U
): void {
  validateCustomValues(entity, values);
  const fields = listCustomFields(entity); // sirf active
  for (const f of fields) {
    if (!(String(f.id) in values)) continue;
    const raw = values[String(f.id)];
    let val: string | null = raw === null || raw === undefined ? null : String(raw).trim();
    if (val === "") val = null;
    if (val !== null && f.type === "check") val = ["1", "true", "yes", "on", "haan"].includes(val.toLowerCase()) ? "1" : "0";
    run(
      `INSERT INTO custom_values (field_id, entity, entity_id, value, updated_at)
       VALUES (?,?,?,?, datetime('now','localtime'))
       ON CONFLICT(field_id, entity_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [f.id, entity, entityId, val]
    );
  }
  void user; // audit upar caller ke paas hai (customer/product save ke saath)
}

/** Kisi field ko poori tarah khatam (sirf owner -- values bhi chali jayengi) */
export function deleteCustomField(id: number, user?: U): void {
  const f = get<RawField>("SELECT * FROM custom_fields WHERE id = ?", [id]);
  if (!f) throw new Error("Field nahi mili.");
  run("DELETE FROM custom_values WHERE field_id = ?", [id]);
  run("DELETE FROM custom_fields WHERE id = ?", [id]);
  void audit({
    action: "delete", userId: user?.id ?? null, userName: user?.name ?? null,
    entity: "CustomField", entityId: id, details: { label: f.label },
  });
}
