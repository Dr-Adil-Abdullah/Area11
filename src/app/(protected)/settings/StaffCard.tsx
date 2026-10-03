// Area11 - Staff accounts card (Settings ke andar, sirf owner ko dikhta hai)
import { Save, UserPlus } from "lucide-react";
import { addUserAction, updateUserAction } from "./actions";
import type { UserPublic } from "@/lib/users";

const ROLE_OPTIONS = ["owner", "manager", "cashier"];

export default function StaffCard({
  users,
  pinLength,
  message,
  error,
}: {
  users: UserPublic[];
  pinLength: number;
  message?: string;
  error?: string;
}) {
  return (
    <div className="card">
      <div className="card-head flex-col !items-start gap-0.5">
        <div className="card-title">Staff &amp; login accounts</div>
        <div className="text-xs font-normal text-slate-500">
          Owner = password · Staff = name + {pinLength}-digit PIN. Accounts are never deleted —
          only switched off. The last active owner cannot be removed or demoted.
        </div>
      </div>

      <div className="card-body space-y-4">
        {message && (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>New PIN / password</th>
                <th>Active</th>
                <th className="text-right">Save</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <form action={updateUserAction} id={`user-${u.id}`} className="contents">
                      <input type="hidden" name="id" value={u.id} />
                      <input
                        name="name"
                        defaultValue={u.name}
                        className="input-sm w-36"
                        aria-label={`Name of ${u.name}`}
                      />
                    </form>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {u.lastLoginAt ? `last login ${u.lastLoginAt}` : "never logged in"}
                    </div>
                  </td>
                  <td>
                    <select
                      name="role"
                      form={`user-${u.id}`}
                      defaultValue={u.role}
                      className="select w-32 py-1 text-sm"
                      aria-label={`Role of ${u.name}`}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      name={u.role === "owner" ? "password" : "pin"}
                      form={`user-${u.id}`}
                      type="password"
                      inputMode="numeric"
                      placeholder={u.role === "owner" ? "new password" : "new PIN"}
                      className="input-sm w-32"
                      aria-label={`New secret for ${u.name}`}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      name="active"
                      form={`user-${u.id}`}
                      defaultChecked={u.active}
                      className="checkbox"
                      aria-label={`Active ${u.name}`}
                    />
                  </td>
                  <td className="text-right">
                    <button type="submit" form={`user-${u.id}`} className="btn-secondary !px-2 !py-1">
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={addUserAction} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="label" htmlFor="newName">
              New staff name
            </label>
            <input id="newName" name="name" className="input" placeholder="e.g. Bilal" />
          </div>
          <div>
            <label className="label" htmlFor="newRole">
              Role
            </label>
            <select id="newRole" name="role" className="select" defaultValue="cashier">
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="newPin">
              PIN ({pinLength} digits)
            </label>
            <input id="newPin" name="pin" type="password" inputMode="numeric" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="newPassword">
              Owner password (owner only)
            </label>
            <input id="newPassword" name="password" type="password" className="input" />
          </div>
          <div className="md:col-span-5">
            <button type="submit" className="btn-primary">
              <UserPlus className="h-4 w-4" />
              Add account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
