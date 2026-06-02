import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassPanel } from "./glass-panel";

type MetricsOperationalCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  href?: string;
  accent?: string;
  className?: string;
  footer?: ReactNode;
  children?: never;
  description?: never;
  action?: never;
};

type PanelOperationalCardProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: string;
  value?: never;
  subtitle?: never;
  icon?: never;
  href?: never;
  footer?: never;
};

export type OperationalCardProps =
  | MetricsOperationalCardProps
  | PanelOperationalCardProps;

function isPanelMode(props: OperationalCardProps): props is PanelOperationalCardProps {
  return "children" in props && props.children !== undefined;
}

export function OperationalCard(props: OperationalCardProps) {
  if (isPanelMode(props)) {
    const { title, description, action, children, className, accent } = props;
    return (
      <Card
        className={cn(
          "overflow-hidden rounded-3xl border-0 bg-card/80 shadow-md shadow-black/[0.04] ring-1 ring-foreground/5 backdrop-blur-sm",
          className
        )}
      >
        {accent ? <div className="h-1 w-full" style={{ backgroundColor: accent }} /> : null}
        {(title || action) && (
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
            <div>
              {title ? <CardTitle className="text-lg font-semibold">{title}</CardTitle> : null}
              {description ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {action}
          </CardHeader>
        )}
        <CardContent className={cn(!title && !action && "pt-4")}>{children}</CardContent>
      </Card>
    );
  }

  const {
    title,
    value,
    subtitle,
    icon,
    href,
    accent = "#2563EB",
    className,
    footer,
  } = props;

  const content = (
    <GlassPanel
      className={cn(
        "flex flex-col gap-3 p-5 transition hover:shadow-md",
        href && "cursor-pointer hover:border-primary/30",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {icon ? (
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: accent }}
          >
            {icon}
          </div>
        ) : null}
      </div>
      {footer}
    </GlassPanel>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </Link>
    );
  }

  return content;
}
