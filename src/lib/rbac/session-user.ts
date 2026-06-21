import type { PermissionCode, RoleCode, UserStatus } from "@/lib/rbac/types";

// App-owned authenticated-user shape. Replaces the former next-auth
// `Session["user"]` augmentation so no module depends on next-auth types after
// the Supabase Auth cut-over (ADR-018). The field set is unchanged so the ~48
// consumers compile untouched.
export interface AuthedUser {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
  roles: RoleCode[];
  permissions: PermissionCode[];
  deptIds: string[];
  status: UserStatus;
}
