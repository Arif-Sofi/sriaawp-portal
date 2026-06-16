import "next-auth";

import type { PermissionCode, RoleCode, UserStatus } from "@/lib/rbac/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image?: string | null;
      roles: RoleCode[];
      permissions: PermissionCode[];
      deptIds: string[];
      status: UserStatus;
    };
  }
}
