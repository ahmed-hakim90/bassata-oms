"use client";

import { useCallback } from "react";
import { useUiStore } from "@/stores/ui-store";
import { translateText } from "@/lib/i18n/translations";

export function useTranslation() {
  const language = useUiStore((s) => s.language);

  const t = useCallback(
    (text: string) => {
      return translateText(text, language);
    },
    [language]
  );

  return { t, language };
}
