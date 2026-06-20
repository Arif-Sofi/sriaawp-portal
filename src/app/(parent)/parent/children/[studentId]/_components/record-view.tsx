"use client";

import { useEffect, useRef } from "react";

import { recordChildView } from "@/app/actions/family";

type RecordViewProps = {
  studentUserId: string;
};

export function RecordView({ studentUserId }: RecordViewProps) {
  const hasRecorded = useRef(false);

  useEffect(() => {
    if (hasRecorded.current) return;
    hasRecorded.current = true;
    void recordChildView(studentUserId);
  }, [studentUserId]);

  return null;
}
