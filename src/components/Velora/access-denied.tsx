import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AccessDeniedProps {
  title: string;
  description: string;
}

export function AccessDenied({ title, description }: AccessDeniedProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldOff className="size-7 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <Link href="/" className={cn(buttonVariants({ size: "sm" }), "mt-6 rounded-full")}>
        Back to dashboard
      </Link>
    </div>
  );
}
