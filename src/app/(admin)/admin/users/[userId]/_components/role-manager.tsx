"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { assignRole, revokeRole } from "@/app/actions/admin-users";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/utils/result";

type RoleScope = {
  roleCode: string;
  scopeType: string;
  scopeId: string;
};

type RoleOption = {
  id: string;
  code: string;
  label: string;
};

type DeptOption = {
  id: string;
  code: string;
  name: string;
};

type RoleManagerProps = {
  userId: string;
  currentScopes: RoleScope[];
  roles: RoleOption[];
  departments: DeptOption[];
  locale: Locale;
};

type FormState = ActionResult<unknown> | null;

export function RoleManager({
  userId,
  currentScopes,
  roles,
  departments,
  locale,
}: RoleManagerProps) {
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [state, setState] = useState<FormState>(null);
  const [pending, setPending] = useState(false);

  const t = (key: string) => translate(ui, key, locale);

  async function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedRole) return;

    setPending(true);
    setState(null);

    const result = await assignRole({
      userId,
      roleCode: selectedRole,
      deptId: selectedDept || undefined,
    });

    setState(result);
    setPending(false);
    if (result.ok) {
      setSelectedRole("");
      setSelectedDept("");
    }
  }

  async function handleRevoke(roleCode: string, scopeId: string) {
    setPending(true);
    setState(null);

    const result = await revokeRole({ userId, roleCode, scopeId });

    setState(result);
    setPending(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {t("admin.userDetail.roles")}
        </h3>
        {currentScopes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.userDetail.noRoles")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {currentScopes.map((scope) => (
              <li
                key={`${scope.roleCode}-${scope.scopeId}`}
                className="py-2 flex items-center justify-between gap-4"
              >
                <div>
                  <span className="text-sm font-medium text-foreground">{scope.roleCode}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {scope.scopeType === "department"
                      ? `dept: ${scope.scopeId}`
                      : t("admin.userDetail.noDept")}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleRevoke(scope.roleCode, scope.scopeId)}
                >
                  {t("admin.userDetail.revoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {t("admin.userDetail.assignRole")}
        </h3>
        <form onSubmit={handleAssign} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              {t("admin.userDetail.role")}
            </label>
            <Select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} required>
              <option value="">{t("admin.userDetail.selectRole")}</option>
              {roles.map((role) => (
                <option key={role.id} value={role.code}>
                  {role.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              {t("admin.userDetail.department")}
            </label>
            <Select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
              <option value="">{t("admin.userDetail.noDept")}</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </Select>
          </div>

          {!state?.ok && state?.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          {state?.ok ? <p className="text-sm text-success-foreground">Role updated.</p> : null}

          <Button type="submit" disabled={pending || !selectedRole}>
            {t("admin.userDetail.assign")}
          </Button>
        </form>
      </div>
    </div>
  );
}
