import { supabase } from "./client";
import type { UserRole } from "@/types/roles";

export type UsuarioConRoles = {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  roles: UserRole[];
};

export async function listUsersWithRoles(): Promise<UsuarioConRoles[]> {
  const { data, error } = await supabase.rpc("list_users_with_roles");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    user_id: row.user_id,
    email: row.email,
    created_at: row.created_at,
    last_sign_in_at: row.last_sign_in_at,
    roles: row.roles as UserRole[],
  }));
}

export async function assignRole(targetUserId: string, role: UserRole): Promise<void> {
  const { error } = await supabase.rpc("assign_role", {
    target_user_id: targetUserId,
    target_role: role,
  });
  if (error) throw error;
}

export async function revokeRole(targetUserId: string, role: UserRole): Promise<void> {
  const { error } = await supabase.rpc("revoke_role", {
    target_user_id: targetUserId,
    target_role: role,
  });
  if (error) throw error;
}
