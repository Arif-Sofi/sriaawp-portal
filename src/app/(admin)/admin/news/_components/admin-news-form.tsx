"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createNews } from "@/app/actions/news";
import type { ActionResult } from "@/lib/utils/result";

type FormState = ActionResult<unknown> | null;

export function AdminNewsForm() {
  const [state, setState] = useState<FormState>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    const result = await createNews({
      title: String(data.get("title") ?? ""),
      body: String(data.get("body") ?? ""),
      excerpt: String(data.get("excerpt") ?? "") || undefined,
    });

    setState(result);
    setPending(false);
    if (result.ok) form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="news-title" className="text-sm font-medium text-foreground">
          Title
        </label>
        <Input id="news-title" name="title" placeholder="News title" required />
        {!state?.ok && state?.fieldErrors?.title ? (
          <p className="text-xs text-destructive">{state.fieldErrors.title}</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="news-excerpt" className="text-sm font-medium text-foreground">
          Excerpt
        </label>
        <Input id="news-excerpt" name="excerpt" placeholder="Short summary (optional)" />
      </div>
      <div className="space-y-1">
        <label htmlFor="news-body" className="text-sm font-medium text-foreground">
          Body
        </label>
        <Textarea id="news-body" name="body" rows={6} placeholder="News content" required />
        {!state?.ok && state?.fieldErrors?.body ? (
          <p className="text-xs text-destructive">{state.fieldErrors.body}</p>
        ) : null}
      </div>
      {!state?.ok && state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? <p className="text-sm text-success-foreground">News post created.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Create news post"}
      </Button>
    </form>
  );
}
