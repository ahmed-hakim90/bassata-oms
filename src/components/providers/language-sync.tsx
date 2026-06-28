"use client";

import { useEffect } from "react";
import { useUiStore } from "@/stores/ui-store";

export function LanguageSync() {
  const language = useUiStore((s) => s.language);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  return null;
}
