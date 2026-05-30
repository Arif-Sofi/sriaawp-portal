"use client";

import { useState } from "react";

import { cn } from "@/lib/utils/cn";

type DateRange = {
  startISO: string;
  endISO: string;
};

type DateTimeRangeProps = {
  startISO?: string;
  endISO?: string;
  onChange?: (range: DateRange) => void;
  error?: string;
};

const INPUT_CLASSES =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export function DateTimeRange({ startISO = "", endISO = "", onChange, error }: DateTimeRangeProps) {
  const [start, setStart] = useState(startISO);
  const [end, setEnd] = useState(endISO);

  const rangeError =
    start && end && end <= start ? "End date must be after start date." : undefined;
  const displayError = error ?? rangeError;

  const handleStartChange = (value: string) => {
    setStart(value);
    onChange?.({ startISO: value, endISO: end });
  };

  const handleEndChange = (value: string) => {
    setEnd(value);
    onChange?.({ startISO: start, endISO: value });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Start</label>
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => handleStartChange(e.target.value)}
          className={INPUT_CLASSES}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">End</label>
        <input
          type="datetime-local"
          value={end}
          onChange={(e) => handleEndChange(e.target.value)}
          className={cn(
            INPUT_CLASSES,
            displayError ? "border-destructive focus-visible:ring-destructive" : "",
          )}
        />
      </div>
      {displayError ? <p className="text-sm text-destructive">{displayError}</p> : null}
    </div>
  );
}
