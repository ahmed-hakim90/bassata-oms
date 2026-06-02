"use client";

import { useEffect } from "react";
import { ThemeProvider, useTheme } from "@teispace/next-themes";
import { Toaster } from "@/components/ui/sonner";
import { LanguageSync } from "@/components/providers/language-sync";
import { useUiStore } from "@/stores/ui-store";

function StoreHydration() {
  useEffect(() => {
    void useUiStore.persist.rehydrate();
  }, []);
  return null;
}

function ThemeSync() {
  const preference = useUiStore((s) => s.theme);
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme(preference);
  }, [preference, setTheme]);
  return null;
}

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <StoreHydration />
      <ThemeSync />
      <LanguageSync />
      {children}
      <Toaster position="top-right" richColors closeButton />
    </ThemeProvider>
  );
}
