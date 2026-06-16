"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConflictBadge } from "@/components/ui/conflict-badge";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ConflictBlock } from "@/lib/conflict/classify";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

const KIND_KEYS: Record<string, string> = {
  ROOM: "conflict.kindRoom",
  ORGANIZER: "conflict.kindOrganizer",
  AUDIENCE: "conflict.kindAudience",
  BLACKOUT_DEPT: "conflict.kindBlackoutDept",
  BLACKOUT_SCHOOL: "conflict.kindBlackoutSchool",
};

type ConflictModalProps = {
  open: boolean;
  blocks: ConflictBlock[];
  canOverride: boolean;
  locale: Locale;
  onEdit: () => void;
  onOverride: (reason: string) => void;
  onClose: () => void;
};

export function ConflictModal({
  open,
  blocks,
  canOverride,
  locale,
  onEdit,
  onOverride,
  onClose,
}: ConflictModalProps) {
  const [reason, setReason] = useState("");
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  const t = (key: string) => translate(ui, key, locale);

  const hasHard = blocks.some((b) => b.hard);

  const handleOverrideSubmit = () => {
    onOverride(reason);
    setReason("");
    setShowOverrideForm(false);
  };

  const footer = showOverrideForm ? (
    <div className="flex w-full flex-col gap-3">
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("conflict.overrideReason")}
        rows={3}
      />
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setShowOverrideForm(false)}>
          {t("conflict.back")}
        </Button>
        <Button variant="primary" onClick={handleOverrideSubmit} disabled={!reason.trim()}>
          {t("conflict.submitOverride")}
        </Button>
      </div>
    </div>
  ) : (
    <>
      <Button variant="outline" onClick={onEdit}>
        {t("conflict.editEvent")}
      </Button>
      {canOverride ? (
        <Button
          variant={hasHard ? "destructive" : "primary"}
          onClick={() => setShowOverrideForm(true)}
        >
          {t("conflict.overrideLabel")}
        </Button>
      ) : null}
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("conflict.modalTitle")}
      description={t("conflict.modalDesc")}
      footer={footer}
    >
      <ul className="flex flex-col gap-3">
        {blocks.map((block) => (
          <li key={block.kind} className="flex flex-col gap-1 rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <ConflictBadge kind={block.hard ? "HARD" : "SOFT"} />
              <span className="text-sm font-medium text-foreground">
                {t(KIND_KEYS[block.kind] ?? block.kind)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{block.detail}</p>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
