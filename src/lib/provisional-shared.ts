// ---------------------------------------------------------------------------
// Area11 - provisional return ki client-safe cheezein (DB import nahi karti)
// ---------------------------------------------------------------------------

export const PROV_REASONS: { value: string; label: string }[] = [
  { value: "wrong_item", label: "Ghalat dawa di gayi thi" },
  { value: "customer_changed", label: "Gahak ne soch badal li" },
  { value: "damaged", label: "Kharab / tooti hui" },
  { value: "expired", label: "Expired nikal gayi" },
  { value: "other", label: "Doosri wajah" },
];

export type ProvRow = {
  id: number;
  code: string;
  date: string;
  phone: string | null;
  reason: string | null;
  notes: string | null;
  refund_paisa: number;
  status: string;
  linked_sale_id: number | null;
  linked_at: string | null;
  user_name?: string | null;
  linked_code?: string | null;
  items?: { product_id: number; name: string; qty_base: number }[];
};
