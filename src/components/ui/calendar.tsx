"use client";

import { cn } from "@/lib/utils/cn";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type CalendarEvent = {
  dateISO: string;
  label: string;
};

type CalendarProps = {
  month: Date;
  events?: CalendarEvent[];
  onSelectDate?: (iso: string) => void;
};

function toISODate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const leadingBlanks: (number | null)[] = Array(firstDayOfWeek).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  return [...leadingBlanks, ...days];
}

export function Calendar({ month, events = [], onSelectDate }: CalendarProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const cells = buildMonthGrid(year, monthIndex);

  const eventDates = new Set(events.map((e) => e.dateISO));

  const monthLabel = `${MONTH_NAMES[monthIndex]} ${year}`;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-sm font-semibold text-card-foreground">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {cells.map((day, cellIndex) => {
          if (day === null) {
            return <div key={`blank-${cellIndex}`} />;
          }

          const iso = toISODate(year, monthIndex, day);
          const hasEvent = eventDates.has(iso);
          const isClickable = !!onSelectDate;

          return (
            <button
              key={iso}
              type="button"
              disabled={!isClickable}
              onClick={() => onSelectDate?.(iso)}
              className={cn(
                "relative flex flex-col items-center rounded py-1.5 text-sm transition-colors",
                isClickable
                  ? "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  : "cursor-default",
                "text-foreground",
              )}
            >
              {day}
              {hasEvent ? (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
