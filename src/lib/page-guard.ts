// ---------------------------------------------------------------------------
// Area11 - Page guard (sirf owner/manager wale safhe)
// ---------------------------------------------------------------------------
// Nav me chhupa dena kaafi nahi -- URL seedha kholein to bhi rok lage.
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { currentUser, type SessionUser } from "./session";

/** Owner ya Manager ke liye safha -- warna wapas dashboard/counter par */
export async function requireShopManagerPage(): Promise<SessionUser> {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") redirect("/pos");
  return me;
}

/** Sirf owner wale safhe (Settings ke staff card jaisa) */
export async function requireOwnerPage(): Promise<SessionUser> {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/");
  return me;
}
