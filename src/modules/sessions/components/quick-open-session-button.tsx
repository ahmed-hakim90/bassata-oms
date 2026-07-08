"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { openSessionAction } from "@/modules/sessions/actions/session.actions";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

interface QuickOpenSessionButtonProps {
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
  label?: string;
}

export function QuickOpenSessionButton({
  className = "rounded-full",
  size = "sm",
  label = "ابدأ البيع",
}: QuickOpenSessionButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    startTransition(async () => {
      try {
        await openSessionAction(0);
        toast.success("تم فتح الوردية — يمكنك البيع الآن");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر فتح الوردية");
      }
    });
  }

  return (
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
  );
}
