import { Badge } from "@/components/ui/badge";

type ConflictKind = "HARD" | "SOFT";

const KIND_LABELS: Record<ConflictKind, string> = {
  HARD: "Hard Conflict",
  SOFT: "Soft Conflict",
};

const KIND_VARIANTS = {
  HARD: "destructive",
  SOFT: "warning",
} as const;

type ConflictBadgeProps = {
  kind: ConflictKind;
  label?: string;
};

export function ConflictBadge({ kind, label }: ConflictBadgeProps) {
  return <Badge variant={KIND_VARIANTS[kind]}>{label ?? KIND_LABELS[kind]}</Badge>;
}
