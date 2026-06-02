import type { ReactNode } from "react";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SIZE_CLASS: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

type StandardModalContentProps = {
  size?: "sm" | "md" | "lg" | "xl";
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function StandardModalContent({
  size = "md",
  title,
  description,
  children,
  footer,
  className,
}: StandardModalContentProps) {
  return (
    <DialogContent className={cn("max-h-[90vh] overflow-y-auto", SIZE_CLASS[size], className)}>
      <DialogHeader className="gap-1">
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>
      <div className="space-y-4">{children}</div>
      {footer ? <DialogFooter className="px-0 pb-0">{footer}</DialogFooter> : null}
    </DialogContent>
  );
}
