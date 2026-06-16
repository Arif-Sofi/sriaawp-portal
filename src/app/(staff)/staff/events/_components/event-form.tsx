"use client";

import Link from "next/link";
import { useState } from "react";

import { createEvent } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { DateTimeRange } from "@/components/ui/date-time-range";
import { Field } from "@/components/ui/form/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ConflictBlock } from "@/lib/conflict/classify";
import type { RoomOption } from "@/lib/calendar/queries";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import type { RoleCode } from "@/lib/rbac/types";
import { ConflictModal } from "./conflict-modal";

type AudienceRef = {
  type: "public" | "role" | "department";
  ref: string | null;
};

type DeptOption = { id: string; name: string; code: string };

type EventFormProps = {
  callerId: string;
  callerDeptIds: string[];
  canOverride: boolean;
  locale: Locale;
  rooms: RoomOption[];
  roles: RoleCode[];
  departments: DeptOption[];
};

type FormState =
  | { stage: "idle" }
  | { stage: "conflict"; blocks: ConflictBlock[] }
  | { stage: "success"; outcome: "PUBLISHED" | "PENDING_REVIEW" };

const AUDIENCE_PUBLIC: AudienceRef = { type: "public", ref: null };

export function EventForm({
  callerId,
  callerDeptIds,
  canOverride,
  locale,
  rooms,
  roles,
  departments,
}: EventFormProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startISO, setStartISO] = useState("");
  const [endISO, setEndISO] = useState("");
  const [roomId, setRoomId] = useState("");
  const [deptId, setDeptId] = useState(callerDeptIds[0] ?? "");
  const [organizerUserId] = useState(callerId);
  const [priority, setPriority] = useState<"normal" | "exam">("normal");
  const [audiencePublic, setAudiencePublic] = useState(false);
  const [audienceRoles, setAudienceRoles] = useState<Set<string>>(new Set());
  const [audienceDepts, setAudienceDepts] = useState<Set<string>>(new Set());
  const [recurrenceFreq, setRecurrenceFreq] = useState<"" | "DAILY" | "WEEKLY" | "MONTHLY">("");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceCount, setRecurrenceCount] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formState, setFormState] = useState<FormState>({ stage: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const buildAudienceRefs = (): AudienceRef[] => {
    const refs: AudienceRef[] = [];
    if (audiencePublic) refs.push(AUDIENCE_PUBLIC);
    for (const role of audienceRoles) refs.push({ type: "role", ref: role });
    for (const dept of audienceDepts) refs.push({ type: "department", ref: dept });
    return refs;
  };

  const submitForm = async (override?: { reason: string }) => {
    setFieldErrors({});
    setIsSubmitting(true);

    const rrule = recurrenceFreq
      ? `FREQ=${recurrenceFreq};INTERVAL=${recurrenceInterval}${recurrenceCount > 0 ? `;COUNT=${recurrenceCount}` : ""}`
      : undefined;

    const result = await createEvent({
      title,
      description: description || undefined,
      startISO,
      endISO,
      roomId: roomId || undefined,
      organizerUserId,
      deptId: deptId || undefined,
      priority,
      audiences: buildAudienceRefs(),
      rrule,
      override,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      return;
    }

    const { outcome, blocks } = result.data;

    if (outcome === "BLOCKED_HARD") {
      setFormState({ stage: "conflict", blocks });
      return;
    }

    setFormState({ stage: "success", outcome });
  };

  const handleOverride = async (reason: string) => {
    await submitForm({ reason });
  };

  const handleEdit = () => {
    setFormState({ stage: "idle" });
  };

  if (formState.stage === "success") {
    return (
      <div className="rounded-md border border-border bg-card p-6 flex flex-col gap-3">
        <p className="text-sm font-medium text-foreground">
          {formState.outcome === "PUBLISHED"
            ? t("event.outcomePublished")
            : t("event.outcomePendingReview")}
        </p>
        <Link
          href="/staff/events"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("event.viewEvents")}
        </Link>
      </div>
    );
  }

  const conflictBlocks = formState.stage === "conflict" ? formState.blocks : [];

  return (
    <>
      <ConflictModal
        open={formState.stage === "conflict"}
        blocks={conflictBlocks}
        canOverride={canOverride}
        locale={locale}
        onEdit={handleEdit}
        onOverride={handleOverride}
        onClose={handleEdit}
      />

      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          submitForm();
        }}
      >
        <Field label={t("event.title")} htmlFor="title" error={fieldErrors["title"]}>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("event.titlePlaceholder")}
          />
        </Field>

        <Field label={t("event.description")} htmlFor="description">
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("event.descriptionPlaceholder")}
          />
        </Field>

        <Field label={t("event.dateTime")} error={fieldErrors["endISO"]}>
          <DateTimeRange
            startISO={startISO}
            endISO={endISO}
            onChange={({ startISO: s, endISO: e }) => {
              setStartISO(s);
              setEndISO(e);
            }}
          />
        </Field>

        <Field label={t("event.room")} htmlFor="room">
          <Select id="room" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">{t("event.noRoom")}</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code})
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("event.department")} htmlFor="dept">
          <Select id="dept" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            <option value="">{t("event.noDepartment")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("event.priority")} htmlFor="priority">
          <Select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as "normal" | "exam")}
          >
            <option value="normal">{t("event.priorityNormal")}</option>
            <option value="exam">{t("event.priorityExam")}</option>
          </Select>
        </Field>

        <Field label={t("event.audience")}>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={audiencePublic}
                onChange={(e) => setAudiencePublic(e.target.checked)}
              />
              {t("event.audiencePublic")}
            </label>
            {roles.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={audienceRoles.has(role)}
                  onChange={(e) => {
                    const next = new Set(audienceRoles);
                    if (e.target.checked) {
                      next.add(role);
                    } else {
                      next.delete(role);
                    }
                    setAudienceRoles(next);
                  }}
                />
                {role}
              </label>
            ))}
            {departments.map((dept) => (
              <label key={dept.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={audienceDepts.has(dept.id)}
                  onChange={(e) => {
                    const next = new Set(audienceDepts);
                    if (e.target.checked) {
                      next.add(dept.id);
                    } else {
                      next.delete(dept.id);
                    }
                    setAudienceDepts(next);
                  }}
                />
                {dept.name}
              </label>
            ))}
          </div>
        </Field>

        <Field label={t("event.recurrence")} htmlFor="recurrence-freq">
          <div className="flex flex-col gap-3">
            <Select
              id="recurrence-freq"
              value={recurrenceFreq}
              onChange={(e) =>
                setRecurrenceFreq(e.target.value as "" | "DAILY" | "WEEKLY" | "MONTHLY")
              }
            >
              <option value="">{t("event.recurrenceNone")}</option>
              <option value="DAILY">{t("event.recurrenceDaily")}</option>
              <option value="WEEKLY">{t("event.recurrenceWeekly")}</option>
              <option value="MONTHLY">{t("event.recurrenceMonthly")}</option>
            </Select>
            {recurrenceFreq ? (
              <div className="flex gap-3">
                <Field
                  label={t("event.recurrenceInterval")}
                  htmlFor="recurrence-interval"
                  className="flex-1"
                >
                  <Input
                    id="recurrence-interval"
                    type="number"
                    min={1}
                    value={recurrenceInterval}
                    onChange={(e) => {
                      const parsed = Number(e.target.value);
                      setRecurrenceInterval(Number.isFinite(parsed) && parsed >= 1 ? parsed : 1);
                    }}
                  />
                </Field>
                <Field
                  label={t("event.recurrenceCountHint")}
                  htmlFor="recurrence-count"
                  className="flex-1"
                >
                  <Input
                    id="recurrence-count"
                    type="number"
                    min={0}
                    value={recurrenceCount}
                    onChange={(e) => {
                      const parsed = Number(e.target.value);
                      setRecurrenceCount(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
                    }}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("event.saving") : t("event.submit")}
          </Button>
        </div>
      </form>
    </>
  );
}
