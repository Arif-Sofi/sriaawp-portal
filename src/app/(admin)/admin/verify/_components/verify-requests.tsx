"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { approveParent, rejectParent } from "@/app/actions/admin-users";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/utils/result";

type Request = {
  id: string;
  userId: string;
  parentName: string | null;
  parentEmail: string | null;
  studentIcProvided: string;
  createdAt: Date;
};

type VerifyRequestsProps = {
  requests: Request[];
  locale: Locale;
};

type ActionState = ActionResult<unknown> | null;

export function VerifyRequests({ requests, locale }: VerifyRequestsProps) {
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<ActionState>(null);

  const t = (key: string) => translate(ui, key, locale);

  async function handleApprove(requestId: string) {
    setPending(true);
    setState(null);
    const result = await approveParent(requestId);
    setState(result);
    setPending(false);
  }

  async function handleReject() {
    if (!rejectDialogId) return;
    setPending(true);
    setState(null);
    const result = await rejectParent({
      requestId: rejectDialogId,
      reason: rejectReason || undefined,
    });
    setState(result);
    setPending(false);
    if (result.ok) {
      setRejectDialogId(null);
      setRejectReason("");
    }
  }

  function openRejectDialog(id: string) {
    setRejectDialogId(id);
    setRejectReason("");
    setState(null);
  }

  return (
    <>
      {!state?.ok && state?.error ? (
        <p className="mb-4 text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? <p className="mb-4 text-sm text-success-foreground">Done.</p> : null}

      <ul className="divide-y divide-border">
        {requests.map((req) => (
          <li key={req.id} className="py-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{req.parentName ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{req.parentEmail ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin.verify.colIc")}: {req.studentIcProvided}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("admin.verify.colSubmitted")}: {new Date(req.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={pending}
                onClick={() => handleApprove(req.id)}
              >
                {t("admin.verify.approve")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => openRejectDialog(req.id)}
              >
                {t("admin.verify.reject")}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={rejectDialogId !== null}
        onClose={() => setRejectDialogId(null)}
        title={t("admin.verify.reject")}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogId(null)}
            >
              {t("admin.verify.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={handleReject}
            >
              {t("admin.verify.confirmReject")}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("admin.verify.rejectReason")}
          </label>
          <Input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t("admin.verify.rejectReason")}
          />
        </div>
      </Dialog>
    </>
  );
}
