"use client";

import { useState } from "react";

import {
  editOwnComment,
  moderateComment,
  postComment,
  replyComment,
  reportComment,
  softDeleteOwnComment,
  toggleReaction,
} from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import type { CommentReply, CommentThread, ReactionState } from "@/lib/engagement/queries";
import { translate, type Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

export type EngagementViewer = {
  canReact: boolean;
  canComment: boolean;
  canModerate: boolean;
  canReport: boolean;
  userId: string | null;
  pendingNotice: boolean;
};

type NewsEngagementProps = {
  newsId: string;
  locale: Locale;
  reaction: ReactionState;
  comments: CommentThread[];
  viewer: EngagementViewer;
};

export function NewsEngagement({
  newsId,
  locale,
  reaction,
  comments,
  viewer,
}: NewsEngagementProps) {
  const t = (key: string) => translate(ui, key, locale);

  return (
    <section className="mt-12 border-t border-border pt-8">
      <LikeButton newsId={newsId} locale={locale} reaction={reaction} canReact={viewer.canReact} />

      {viewer.pendingNotice ? (
        <p className="mt-6 rounded-md border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
          {t("engagement.pendingNotice")}
        </p>
      ) : null}

      <h2 className="mt-8 text-lg font-semibold text-foreground">{t("engagement.comments")}</h2>

      {viewer.canComment ? (
        <Composer newsId={newsId} locale={locale} placeholderKey="engagement.commentPlaceholder" />
      ) : null}

      {comments.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={t("engagement.emptyComments")}
            description={t("engagement.emptyCommentsDesc")}
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-6">
          {comments.map((comment) => (
            <CommentNode
              key={comment.id}
              newsId={newsId}
              locale={locale}
              comment={comment}
              viewer={viewer}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

type LikeButtonProps = {
  newsId: string;
  locale: Locale;
  reaction: ReactionState;
  canReact: boolean;
};

function LikeButton({ newsId, locale, reaction, canReact }: LikeButtonProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState(reaction);

  async function handleToggle() {
    setPending(true);
    setError(null);
    const result = await toggleReaction(newsId);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const reacted = result.data.reacted;
    setState((prev) => ({
      reactedByCaller: reacted,
      count: prev.count + (reacted ? 1 : -1),
    }));
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={state.reactedByCaller ? "primary" : "outline"}
        size="sm"
        onClick={handleToggle}
        disabled={!canReact || pending}
      >
        {state.reactedByCaller ? t("engagement.liked") : t("engagement.like")}
      </Button>
      <span className="text-sm text-muted-foreground">
        {state.count} {t("engagement.likeCount")}
      </span>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

type ComposerProps = {
  newsId: string;
  locale: Locale;
  placeholderKey: string;
  parentCommentId?: string;
  onDone?: () => void;
};

function Composer({ newsId, locale, placeholderKey, parentCommentId, onDone }: ComposerProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = parentCommentId
      ? await replyComment(newsId, parentCommentId, body)
      : await postComment(newsId, body);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    onDone?.();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-2">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t(placeholderKey)}
        rows={3}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending || body.trim().length === 0}>
          {pending ? t("engagement.posting") : t("engagement.post")}
        </Button>
      </div>
    </form>
  );
}

type CommentNodeProps = {
  newsId: string;
  locale: Locale;
  comment: CommentThread;
  viewer: EngagementViewer;
};

function CommentNode({ newsId, locale, comment, viewer }: CommentNodeProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [replyOpen, setReplyOpen] = useState(false);

  return (
    <li className="space-y-3">
      <CommentBody locale={locale} comment={comment} viewer={viewer} />

      {viewer.canComment ? (
        <div className="ml-6">
          {replyOpen ? (
            <Composer
              newsId={newsId}
              locale={locale}
              placeholderKey="engagement.replyPlaceholder"
              parentCommentId={comment.id}
              onDone={() => setReplyOpen(false)}
            />
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setReplyOpen(true)}>
              {t("engagement.reply")}
            </Button>
          )}
        </div>
      ) : null}

      {comment.replies.length > 0 ? (
        <ul className="ml-6 space-y-3 border-l border-border pl-4">
          {comment.replies.map((reply) => (
            <li key={reply.id}>
              <CommentBody locale={locale} comment={reply} viewer={viewer} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

type CommentBodyProps = {
  locale: Locale;
  comment: CommentReply;
  viewer: EngagementViewer;
};

function CommentBody({ locale, comment, viewer }: CommentBodyProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editBody, setEditBody] = useState(comment.body);

  const isRemoved = comment.status !== "visible";
  const isOwn = viewer.userId !== null && comment.authorUserId === viewer.userId;
  const authorLabel = comment.authorName ?? t("engagement.deletedUser");

  async function runAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "");
      return false;
    }
    return true;
  }

  async function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const done = await runAction(() => editOwnComment(comment.id, editBody));
    if (done) setEditOpen(false);
  }

  async function handleDelete() {
    const done = await runAction(() => softDeleteOwnComment(comment.id));
    if (done) setDeleteOpen(false);
  }

  async function handleReport() {
    const done = await runAction(() => reportComment(comment.id));
    if (done) setReported(true);
  }

  async function handleModerate(status: "hidden" | "deleted") {
    await runAction(() => moderateComment(comment.id, status));
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{authorLabel}</span>
        <span className="text-xs text-muted-foreground">
          {comment.createdAt.toLocaleDateString(locale === "ms" ? "ms-MY" : "en-GB")}
        </span>
      </div>

      {isRemoved ? (
        <p className="mt-2 text-sm italic text-muted-foreground">
          {t("engagement.removedTombstone")}
        </p>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
      )}

      {isRemoved ? null : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isOwn ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditBody(comment.body);
                  setEditOpen(true);
                }}
              >
                {t("engagement.edit")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
                {t("engagement.delete")}
              </Button>
            </>
          ) : null}
          {viewer.canReport && !isOwn ? (
            <Button variant="ghost" size="sm" onClick={handleReport} disabled={pending || reported}>
              {reported ? t("engagement.reported") : t("engagement.report")}
            </Button>
          ) : null}
          {viewer.canModerate ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleModerate("hidden")}
                disabled={pending}
              >
                {t("engagement.hide")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleModerate("deleted")}
                disabled={pending}
              >
                {t("engagement.removeComment")}
              </Button>
            </>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title={t("engagement.edit")}>
        <form onSubmit={handleEdit} className="space-y-3">
          <Textarea
            value={editBody}
            onChange={(event) => setEditBody(event.target.value)}
            rows={4}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              {t("engagement.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("engagement.saving") : t("engagement.save")}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t("engagement.confirmDelete")}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("engagement.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? t("engagement.deleting") : t("engagement.delete")}
            </Button>
          </>
        }
      >
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </Dialog>
    </div>
  );
}
