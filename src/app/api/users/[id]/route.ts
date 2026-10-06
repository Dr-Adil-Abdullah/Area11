// Area11 - Ek staff account update (naam/role/PIN/password/active) -- sirf owner
import { handleOwner } from "@/lib/api";
import { getUser, updateUser, type UserInput } from "@/lib/users";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handleOwner(async (actor) => {
    const body = (await req.json()) as Partial<UserInput>;
    const settings = await getSettings();
    const pinLength = Number(settings["security.pinLength"]) || 4;
    updateUser(Number(id), body, pinLength, actor);
    
    return { user: getUser(Number(id)) };
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handleOwner(() => ({ user: getUser(Number(id)) }));
}
