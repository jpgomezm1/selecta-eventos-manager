import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { hasAnyRole, type UserRole } from "@/types/roles";

export function useCan() {
  const { roles } = useAuth();
  return useCallback(
    (allowed: UserRole[]) => hasAnyRole(roles, allowed),
    [roles]
  );
}
