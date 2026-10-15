/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
// Area11 - Staff accounts (sirf owner)
import { handleOwner } from "@/lib/api";
import { createUser, listUsers, type UserInput } from "@/lib/users";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleOwner(() => ({ users: listUsers() }));
}

export async function POST(req: Request) {
  return handleOwner(async (actor) => {
    const body = (await req.json()) as UserInput;
    const settings = await getSettings();
    const pinLength = Number(settings["security.pinLength"]) || 4;
    const id = createUser(body, pinLength, actor);
    
    return { id };
  });
}

*/

export {};
