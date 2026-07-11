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
          "overflow-hidden rounded-[var(--mds-radius-lg)] border-border bg-card shadow-[var(--mds-elevation-1)]",
          className
        )}
      >
        {accent ? <div className="h-1 w-full" style={{ backgroundColor: accent }} /> : null}
        {(title || action) && (
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
            <div>
              {title ? <CardTitle className="text-base font-semibold">{title}</CardTitle> : null}
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
    accent = "var(--mds-color-action-primary)",
    className,
    footer,
  } = props;

  const content = (
    <GlassPanel
      className={cn(
        "flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-[var(--mds-elevation-2)]",
        href && "cursor-pointer hover:border-primary/40",
        className
      )}
    >
      <div className="h-1 w-full" style={{ backgroundColor: accent }} aria-hidden />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {icon ? (
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-[var(--mds-radius-md)] text-primary-foreground"
              style={{ backgroundColor: accent }}
            >
              {icon}
            </div>
          ) : null}
        </div>
        {footer}
      </div>
    </GlassPanel>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-[var(--mds-radius-lg)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </Link>
    );
  }

  return content;
}
