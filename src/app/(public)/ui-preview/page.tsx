import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/shared/app-shell";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Nav } from "@/components/shared/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatBubble } from "@/components/ui/chat-bubble";
import { CitationChip } from "@/components/ui/citation-chip";
import { ConflictBadge } from "@/components/ui/conflict-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FileTable } from "@/components/ui/file-table";
import { Field, FieldError } from "@/components/ui/form/field";
import { Input } from "@/components/ui/input";
import { Skeleton, Spinner } from "@/components/ui/loading";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DemoInteractive } from "./demo-interactive";

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 border-b border-border pb-2 text-lg font-semibold text-foreground">
      {children}
    </h2>
  );
}

function StateLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function ComponentGallery({ idPrefix }: { idPrefix: string }) {
  const sampleFiles = [
    {
      id: "1",
      name: "timetable-2025.pdf",
      sizeLabel: "120 KB",
      version: "v2",
      updatedAtLabel: "2025-01-10",
    },
    { id: "2", name: "syllabus-form4.docx", sizeLabel: "45 KB", updatedAtLabel: "2025-02-03" },
  ];

  return (
    <div className="flex flex-col gap-10">
      <section>
        <SectionHeading>Badge</SectionHeading>
        <div className="flex flex-wrap gap-2">
          <StateLabel>Default</StateLabel>
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="info">Info</Badge>
        </div>
      </section>

      <section>
        <SectionHeading>ConflictBadge</SectionHeading>
        <div className="flex flex-wrap gap-2">
          <StateLabel>Error/Validation states</StateLabel>
          <ConflictBadge kind="HARD" />
          <ConflictBadge kind="SOFT" />
          <ConflictBadge kind="HARD" label="Room double-booked" />
        </div>
      </section>

      <section>
        <SectionHeading>Button</SectionHeading>
        <div className="flex flex-wrap gap-2">
          <StateLabel>Default</StateLabel>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section>
        <SectionHeading>Input / Textarea / Select</SectionHeading>
        <div className="flex max-w-sm flex-col gap-3">
          <StateLabel>Default</StateLabel>
          <Input placeholder="Input field" />
          <Textarea placeholder="Textarea field" rows={3} />
          <Select>
            <option>Option A</option>
            <option>Option B</option>
          </Select>
        </div>
      </section>

      <section>
        <SectionHeading>Field (Form)</SectionHeading>
        <div className="flex max-w-sm flex-col gap-4">
          <StateLabel>Default</StateLabel>
          <Field label="Email" htmlFor={`${idPrefix}-email-demo`} hint="Use your school email.">
            <Input id={`${idPrefix}-email-demo`} type="email" placeholder="nama@sriaawp.edu.my" />
          </Field>
          <StateLabel>Error/Validation</StateLabel>
          <Field label="Email" htmlFor={`${idPrefix}-email-error`} error="This field is required.">
            <Input id={`${idPrefix}-email-error`} type="email" aria-invalid />
          </Field>
          <StateLabel>FieldError standalone</StateLabel>
          <FieldError>Standalone field error message.</FieldError>
        </div>
      </section>

      <section>
        <SectionHeading>Loading</SectionHeading>
        <div className="flex flex-col gap-4">
          <StateLabel>Loading — Spinner</StateLabel>
          <div className="flex items-center gap-4">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </div>
          <StateLabel>Loading — Skeleton</StateLabel>
          <div className="flex max-w-xs flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </section>

      <section>
        <SectionHeading>EmptyState</SectionHeading>
        <div className="flex flex-col gap-4">
          <StateLabel>Empty</StateLabel>
          <EmptyState title="No items found." description="Try adjusting your filters." />
          <EmptyState title="No files uploaded." action={<Button size="sm">Upload file</Button>} />
        </div>
      </section>

      <section>
        <SectionHeading>FileTable</SectionHeading>
        <div className="flex flex-col gap-4">
          <StateLabel>Default</StateLabel>
          <FileTable files={sampleFiles} />
          <StateLabel>Empty</StateLabel>
          <FileTable files={[]} emptyLabel="No documents available." />
        </div>
      </section>

      <section>
        <SectionHeading>ChatBubble + CitationChip</SectionHeading>
        <div className="flex flex-col gap-2 max-w-lg">
          <ChatBubble role="user">What time does school start?</ChatBubble>
          <ChatBubble
            role="assistant"
            footer={
              <>
                <CitationChip label="[1] Timetable 2025" />
                <CitationChip label="[2] School handbook" />
              </>
            }
          >
            School starts at 7:30 AM on weekdays.
          </ChatBubble>
        </div>
      </section>

      <section>
        <SectionHeading>Breadcrumbs</SectionHeading>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Admin", href: "/admin" },
            { label: "Dashboard" },
          ]}
        />
      </section>

      <section>
        <SectionHeading>Nav</SectionHeading>
        <Nav
          brand={<span className="text-sm font-semibold text-foreground">SRIAAWP</span>}
          links={[
            { label: "Home", href: "/" },
            { label: "About", href: "/about" },
          ]}
        />
      </section>

      <section>
        <SectionHeading>AppShell (structure demo)</SectionHeading>
        <div className="rounded-lg border border-border overflow-hidden">
          <AppShell
            nav={
              <Nav brand={<span className="text-sm font-semibold text-foreground">Portal</span>} />
            }
            footer={
              <footer className="border-t border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
                SRIAAWP 2025
              </footer>
            }
          >
            <Card>
              <CardHeader>
                <CardTitle>Main content area</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This is inside AppShell with Nav and footer slots.
                </p>
              </CardContent>
            </Card>
          </AppShell>
        </div>
      </section>

      <section>
        <SectionHeading>Interactive (Toast / Dialog / Calendar / DateTimeRange)</SectionHeading>
        <DemoInteractive />
      </section>
    </div>
  );
}

export default function UIPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold text-foreground">UI Design System Preview</h1>
      <p className="mb-10 text-muted-foreground">
        All shared components, demonstrated in both light and dark themes.
      </p>

      <section className="mb-16">
        <h2 className="mb-8 text-xl font-semibold text-foreground">Light theme</h2>
        <ComponentGallery idPrefix="light" />
      </section>

      <section>
        <h2 className="mb-8 text-xl font-semibold text-foreground">Dark theme</h2>
        <div className="dark rounded-xl bg-background p-8 text-foreground">
          <ComponentGallery idPrefix="dark" />
        </div>
      </section>
    </main>
  );
}
