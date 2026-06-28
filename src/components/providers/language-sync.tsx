"use client";

import { useEffect } from "react";
import { useUiStore } from "@/stores/ui-store";

export function LanguageSync() {
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);

  useEffect(() => {
    if (language !== "ar") {
      setLanguage("ar");
      return;
    }

    const root = document.documentElement;
    root.lang = "ar";
    root.dir = "rtl";
  }, [language, setLanguage]);

  return null;
}
