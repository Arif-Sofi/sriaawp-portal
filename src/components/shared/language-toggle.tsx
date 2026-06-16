"use client";

import { useRouter } from "next/navigation";

import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";

type LanguageToggleProps = {
  locale: Locale;
};

export function LanguageToggle({ locale }: LanguageToggleProps) {
  const router = useRouter();

  const switchTo = (next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    router.refresh();
  };

  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        type="button"
        onClick={() => switchTo("ms")}
        className={cn(
          "px-1.5 py-0.5 transition-colors",
          locale === "ms"
            ? "font-semibold text-primary-foreground"
            : "text-primary-foreground/70 hover:text-primary-foreground",
        )}
      >
        BM
      </button>
      <span className="text-primary-foreground/40">|</span>
      <button
        type="button"
        onClick={() => switchTo("en")}
        className={cn(
          "px-1.5 py-0.5 transition-colors",
          locale === "en"
            ? "font-semibold text-primary-foreground"
            : "text-primary-foreground/70 hover:text-primary-foreground",
        )}
      >
        EN
      </button>
    </div>
  );
}
