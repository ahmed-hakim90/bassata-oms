"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@teispace/next-themes";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUiStore, type ThemePreference } from "@/stores/ui-store";

interface ThemeToggleProps {
  darkModeEnabled?: boolean;
}

export function ThemeToggle({ darkModeEnabled = true }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const preference = useUiStore((s) => s.theme);
  const setPreference = useUiStore((s) => s.setTheme);

  useEffect(() => {
    if (!darkModeEnabled) {
      setTheme("light");
      return;
    }
    setTheme(preference);
  }, [darkModeEnabled, preference, setTheme]);

  if (!darkModeEnabled) return null;

  function cycle() {
    const order: ThemePreference[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(preference) + 1) % order.length]!;
    setPreference(next);
    setTheme(next);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="rounded-full"
      onClick={cycle}
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
