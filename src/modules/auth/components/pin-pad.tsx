"use client";

import { useCallback, useState, useTransition } from "react";
import { Delete, CircleDot } from "lucide-react";
import { verifyPinAction } from "@/modules/auth/actions/verify-pin.action";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PIN_LENGTH = 4;

interface PinPadProps {
  onSuccess?: (cashierId: string) => void;
  className?: string;
}

export function PinPad({ onSuccess, className }: PinPadProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const appendDigit = useCallback((digit: string) => {
    setError(null);
    setPin((current) => (current.length < PIN_LENGTH ? current + digit : current));
  }, []);

  const removeDigit = useCallback(() => {
    setError(null);
    setPin((current) => current.slice(0, -1));
  }, []);

  const clearPin = useCallback(() => {
    setError(null);
    setPin("");
  }, []);

  const submitPin = useCallback(
    (value: string) => {
      if (value.length !== PIN_LENGTH) return;
      startTransition(async () => {
        const result = await verifyPinAction(value);
        if (result.success && result.cashierId) {
          setPin("");
          setError(null);
          onSuccess?.(result.cashierId);
        } else {
          setError(result.error ?? "رقم PIN غير صحيح.");
          setPin("");
        }
      });
    },
    [onSuccess]
  );

  const handleDigit = (digit: string) => {
    const next = pin.length < PIN_LENGTH ? pin + digit : pin;
    appendDigit(digit);
    if (next.length === PIN_LENGTH) {
      submitPin(next);
    }
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

  return (
    <div className={cn("mx-auto w-full max-w-sm space-y-6", className)}>
      <div className="flex justify-center gap-3">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex size-4 items-center justify-center rounded-full transition-all",
              i < pin.length
                ? "bg-primary shadow-[0_0_12px_-2px_var(--color-primary)]"
                : "border-2 border-muted-foreground/25 bg-transparent"
            )}
          >
            {i < pin.length ? <CircleDot className="size-2.5 text-primary-foreground" /> : null}
          </div>
        ))}
      </div>

      {error ? (
        <p className="text-center text-sm text-destructive">{error}</p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          {pending ? "جاري التحقق…" : "أدخل رقم PIN المكوّن من 4 أرقام"}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {digits.map((key) => {
          if (key === "clear") {
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={clearPin}
                className="h-16 rounded-[var(--radius-button)] text-sm font-medium"
              >
                مسح
              </Button>
            );
          }
          if (key === "back") {
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={removeDigit}
                className="h-16 rounded-[var(--radius-button)]"
                aria-label="حذف"
              >
                <Delete className="size-5" />
              </Button>
            );
          }
          return (
            <Button
              key={key}
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleDigit(key)}
              className="h-16 rounded-[var(--radius-button)] text-2xl font-medium shadow-sm active:scale-95"
            >
              {key}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
