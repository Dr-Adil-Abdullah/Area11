// Area11 - Staff accounts (sirf owner)
import { handleOwner } from "@/lib/api";
import { createUser, listUsers, type UserInput } from "@/lib/users";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleOwner(() => ({ users: listUsers() }));
}

export async function POST(req: Request) {
  return handleOwner(async (actor) => {
    const body = (await req.json()) as UserInput;
    const settings = await getSettings();
    const pinLength = Number(settings["security.pinLength"]) || 4;
    const id = createUser(body, pinLength);
    void audit({
      action: "create",
      entity: "User",
      entityId: id,
      userId: actor.id,
      userName: actor.name,
      details: { name: body.name, role: body.role },
    });
    return { id };
  });
}
