"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type ToastVariant = "neutral" | "success" | "destructive" | "info" | "warning";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastOptions = Omit<Toast, "id">;

type ToastContextValue = {
  toast: (opts: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  neutral: "bg-card border-border text-card-foreground",
  success: "bg-success text-success-foreground border-success",
  destructive: "bg-destructive text-destructive-foreground border-destructive",
  info: "bg-info text-info-foreground border-info",
  warning: "bg-warning text-warning-foreground border-warning",
};

type ToastItemProps = {
  item: Toast;
  onDismiss: (id: string) => void;
};

function ToastItem({ item, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), 4000);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div
      role="alert"
      className={cn(
        "w-80 rounded-lg border px-4 py-3 shadow-md",
        VARIANT_CLASSES[item.variant ?? "neutral"],
      )}
    >
      <p className="text-sm font-medium">{item.title}</p>
      {item.description ? <p className="mt-0.5 text-xs opacity-90">{item.description}</p> : null}
    </div>
  );
}

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (opts: ToastOptions) => {
    setToasts((prev) => [...prev, { ...opts, id: crypto.randomUUID() }]);
  };

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((entry) => entry.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((item) => (
          <ToastItem key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
