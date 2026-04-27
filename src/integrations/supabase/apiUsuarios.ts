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

export type CreateUserInput = {
  email: string;
  password: string;
  role: UserRole;
};

export type CreateUserResult = {
  user_id: string;
  /** Presente si el user se creó pero la asignación de rol falló. */
  warning?: string;
};

export async function createUserWithRole(input: CreateUserInput): Promise<CreateUserResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    user_id?: string;
    warning?: string;
    error?: string;
  }>("admin-create-user", {
    body: input,
  });
  if (error) {
    // Supabase wrappea el HTTP error; intentamos extraer el mensaje del body.
    type FnError = Error & { context?: { json?: () => Promise<{ error?: string }> } };
    const ctx = (error as FnError).context;
    if (ctx?.json) {
      try {
        const payload = await ctx.json();
        if (payload?.error) throw new Error(payload.error);
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message) throw parseErr;
      }
    }
    throw error;
  }
  if (!data?.user_id) {
    throw new Error(data?.error ?? "No se pudo crear el usuario");
  }
  return { user_id: data.user_id, warning: data.warning };
}
