import { PERMISSIONS, ROLES } from "@/db/seed/catalogue";

export type RoleCode = (typeof ROLES)[number]["code"];
export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

export type UserStatus = "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED";
