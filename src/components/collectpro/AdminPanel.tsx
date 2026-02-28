import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Partner } from "@/lib/collectpro/types";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PublicUser { id: string; email: string; last_seen: string }
interface AccessRow  { id: string; user_id: string; partner_id: string; created_at: string }
interface AdminRow   { user_id: string }

export default function AdminPanel({ partners }: { partners: Partner[] }) {
  const [users,   setUsers]   = useState<PublicUser[]>([]);
  const [access,  setAccess]  = useState<AccessRow[]>([]);
  const [admins,  setAdmins]  = useState<AdminRow[]>([]);
  const [busy,    setBusy]    = useState(false);
  const [loading, setLoading] = useState(true);

  const [revokeTarget,      setRevokeTarget]      = useState<string | null>(null);
  const [removeAdminTarget, setRemoveAdminTarget] = useState<string | null>(null);

  const [grantEmail,     setGrantEmail]     = useState("");
  const [grantPartnerId, setGrantPartnerId] = useState(partners[0]?.id ?? "");
  const [adminEmail,     setAdminEmail]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: u }, { data: a }, { data: adm }] = await Promise.all([
      supabase.from("cp_users_public").select("id, email, last_seen").order("last_seen", { ascending: false }),
      supabase.from("cp_user_partner_access").select("id, user_id, partner_id, created_at"),
      supabase.from("cp_admins").select("user_id"),
    ]);
    setUsers(u ?? []);
    setAccess(a ?? []);
    setAdmins(adm ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const emailOf   = (uid: string) => users.find((u) => u.id === uid)?.email ?? uid.slice(0, 8) + "…";
  const partnerOf = (pid: string) => partners.find((p) => p.id === pid)?.name ?? "—";

  const grantAccess = async () => {
    const user = users.find((u) => u.email.toLowerCase() === grantEmail.toLowerCase().trim());
    if (!user) { toast.error("User not found — they must log in first"); return; }
    if (!grantPartnerId) { toast.error("Select a portfolio"); return; }
    setBusy(true);
    const { error } = await supabase.from("cp_user_partner_access").insert({
      user_id: user.id,
      partner_id: grantPartnerId,
      granted_by: (await supabase.auth.getUser()).data.user?.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Granted ${user.email} access to ${partnerOf(grantPartnerId)}`);
    setGrantEmail("");
    load();
  };

  const revokeAccess = async (id: string) => {
    const { error } = await supabase.from("cp_user_partner_access").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Access revoked");
    setRevokeTarget(null);
    load();
  };

  const makeAdmin = async () => {
    const user = users.find((u) => u.email.toLowerCase() === adminEmail.toLowerCase().trim());
    if (!user) { toast.error("User not found — they must log in first"); return; }
    const { error } = await supabase.from("cp_admins").insert({ user_id: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success(`${user.email} is now an admin`);
    setAdminEmail("");
    load();
  };

  const removeAdmin = async (uid: string) => {
    const { error } = await supabase.from("cp_admins").delete().eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    toast.success("Admin removed");
    setRemoveAdminTarget(null);
    load();
  };

  return (
    <div className="space-y-6">
      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access?</AlertDialogTitle>
            <AlertDialogDescription>This user will immediately lose access to this portfolio.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-700 hover:bg-red-800" onClick={() => revokeTarget && revokeAccess(revokeTarget)}>
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeAdminTarget} onOpenChange={() => setRemoveAdminTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Admin?</AlertDialogTitle>
            <AlertDialogDescription>{emailOf(removeAdminTarget ?? "")} will lose all admin privileges.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-700 hover:bg-red-800" onClick={() => removeAdminTarget && removeAdmin(removeAdminTarget)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Access table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="font-semibold text-sm">🔑 Portfolio Access</span>
          <div className="flex items-center gap-3">
            {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
            <span className="text-xs text-gray-500">{access.length} access rows</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-400">
                <th className="px-4 py-2.5 text-right font-medium">User</th>
                <th className="px-4 py-2.5 text-right font-medium">Portfolio</th>
                <th className="px-4 py-2.5 text-right font-medium">Granted</th>
                <th className="px-4 py-2.5 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {access.map((row) => (
                <tr key={row.id} className="border-b border-gray-800/40 hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 font-mono text-xs">{emailOf(row.user_id)}</td>
                  <td className="px-4 py-2.5">{partnerOf(row.partner_id)}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(row.created_at).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => setRevokeTarget(row.id)} className="text-red-500 hover:text-red-400 text-xs font-medium">Revoke</button>
                  </td>
                </tr>
              ))}
              {access.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6 text-gray-600 text-sm">No access rows yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant access */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="text-sm font-semibold mb-3">➕ Grant Access</div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="user@example.com"
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            className="flex-1 min-w-[180px] bg-gray-800 border-gray-700 text-sm"
            list="cp-users-list"
          />
          <datalist id="cp-users-list">
            {users.map((u) => <option key={u.id} value={u.email} />)}
          </datalist>
          <select
            value={grantPartnerId}
            onChange={(e) => setGrantPartnerId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
          >
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button onClick={grantAccess} disabled={busy || !grantEmail || !grantPartnerId} size="sm">Grant</Button>
        </div>
        <p className="text-xs text-gray-600 mt-2">User must have logged in at least once to appear in autocomplete.</p>
      </div>

      {/* Admins */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="text-sm font-semibold mb-3">👑 Admins</div>
        <div className="space-y-2 mb-4">
          {admins.map((a) => (
            <div key={a.user_id} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2">
              <span className="text-sm font-mono">{emailOf(a.user_id)}</span>
              <button onClick={() => setRemoveAdminTarget(a.user_id)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="user@example.com"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            className="flex-1 bg-gray-800 border-gray-700 text-sm"
            list="cp-users-list"
          />
          <Button variant="outline" onClick={makeAdmin} disabled={!adminEmail} size="sm">Make Admin</Button>
        </div>
      </div>

      {/* Known users */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 font-semibold text-sm">👤 Known Users ({users.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-400">
                <th className="px-4 py-2 text-right font-medium">Email</th>
                <th className="px-4 py-2 text-right font-medium">Last Seen</th>
                <th className="px-4 py-2 text-right font-medium">Portfolios</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const userAccess = access.filter((a) => a.user_id === u.id);
                return (
                  <tr key={u.id} className="border-b border-gray-800/40 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(u.last_seen).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {userAccess.length === 0
                        ? <span className="text-gray-600">No access</span>
                        : userAccess.map((a) => partnerOf(a.partner_id)).join(", ")
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
