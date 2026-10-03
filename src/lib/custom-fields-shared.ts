// ---------------------------------------------------------------------------
// Area11 - custom fields ki client-safe cheezein (DB import nahi karti)
// ---------------------------------------------------------------------------

export type CustomEntity = "customer" | "product" | "supplier";
export type CustomFieldType = "text" | "number" | "date" | "select" | "check";

export type CustomField = {
  id: number;
  entity: CustomEntity;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: number;
  active: number;
  sort: number;
};

export const TYPES: CustomFieldType[] = ["text", "number", "date", "select", "check"];

export const ENTITIES: { value: CustomEntity; label: string }[] = [
  { value: "customer", label: "Customers" },
  { value: "product", label: "Products" },
  { value: "supplier", label: "Suppliers" },
];

/** "A, B, C" ya ["A","B"] -> ["A","B"] */
export function parseOptions(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  } catch {
    /* comma list */
  }
  return raw.split(",").map((x) => x.trim()).filter(Boolean);
}
