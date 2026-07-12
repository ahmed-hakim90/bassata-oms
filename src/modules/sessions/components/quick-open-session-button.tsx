"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { quickOpenSessionAction } from "@/modules/sessions/actions/session.actions";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { ComponentProps } from "react";

interface QuickOpenSessionButtonProps {
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
  label?: string;
  /** Locked pending opening float from vault (cashier cannot edit). */
  pendingOpeningFloat?: number;
}

export function QuickOpenSessionButton({
  className = "rounded-full",
  size = "sm",
  label = "ابدأ البيع",
  pendingOpeningFloat = 0,
}: QuickOpenSessionButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    startTransition(async () => {
      try {
        await quickOpenSessionAction();
        const floatNote =
          pendingOpeningFloat > 0
            ? ` · بداية الدرج ${formatCurrency(pendingOpeningFloat)}`
            : "";
        toast.success(`تم فتح الوردية — يمكنك البيع الآن${floatNote}`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر فتح الوردية");
      }
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      {pendingOpeningFloat > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          رصيد بداية الوردية (متقفّل):{" "}
          <span className="tabular-nums font-medium text-foreground">
            {formatCurrency(pendingOpeningFloat)}
          </span>
        </p>
      ) : null}
      <Button
        type="button"
        size={size}
        className={className}
        disabled={pending}
        onClick={handleOpen}
      >
        <Play className="size-4" />
        {pending ? "جاري الفتح…" : label}
      </Button>
    </div>
  );
}
