"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DateTimeRange } from "@/components/ui/date-time-range";
import { Dialog } from "@/components/ui/dialog";
import { ToastProvider, useToast } from "@/components/ui/toast";

function ToastDemo() {
  const { toast } = useToast();

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => toast({ title: "Success", variant: "success" })}>
        Success toast
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => toast({ title: "Error occurred", variant: "destructive" })}
      >
        Error toast
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          toast({ title: "Info", description: "This is an info message.", variant: "info" })
        }
      >
        Info toast
      </Button>
    </div>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Confirm action"
        description="Are you sure you want to proceed?"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Confirm
            </Button>
          </>
        }
      />
    </div>
  );
}

export function DemoInteractive() {
  return (
    <ToastProvider>
      <div className="flex flex-col gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Toast
          </p>
          <ToastDemo />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dialog
          </p>
          <DialogDemo />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Calendar
          </p>
          <Calendar
            month={new Date(2025, 4, 1)}
            events={[{ dateISO: "2025-05-15", label: "Event" }]}
            onSelectDate={(iso) => console.log("selected", iso)}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            DateTimeRange
          </p>
          <DateTimeRange />
        </div>
      </div>
    </ToastProvider>
  );
}
