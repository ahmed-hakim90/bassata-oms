"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

interface CompactActionsProps {
  children: ReactNode;
  className?: string;
}

/** Horizontal action row — icon-only on mobile, labeled from sm+. */
export function CompactActions({ children, className }: CompactActionsProps) {
  return (
    <TooltipProvider delay={300}>
      <div
        className={cn(
          "flex flex-wrap items-center justify-end gap-1.5 sm:gap-2",
          className
        )}
      >
        {children}
      </div>
    </TooltipProvider>
  );
}

interface CompactActionProps {
  label: string;
  icon: LucideIcon;
  variant?: ButtonVariant;
  disabled?: boolean;
  onClick?: ComponentProps<"button">["onClick"];
  href?: string;
  type?: "button" | "submit";
  className?: string;
  /** Keep the text label visible on mobile (rare — e.g. sole primary). */
  alwaysLabeled?: boolean;
  /** Optional keyboard shortcut hint (e.g. F1) shown in tooltip + aria. */
  shortcut?: string;
}

const iconOnlyClass =
  "size-11 shrink-0 touch-manipulation sm:size-auto sm:h-9 sm:min-h-9 sm:gap-1.5 sm:px-3";

function shortcutSuffix(shortcut?: string) {
  if (!shortcut) return null;
  return (
    <kbd className="ms-1 hidden rounded border border-border/50 bg-muted/40 px-1 text-[10px] font-normal text-muted-foreground sm:inline">
      {shortcut}
    </kbd>
  );
}

export function CompactAction({
  label,
  icon: Icon,
  variant = "outline",
  disabled,
  onClick,
  href,
  type = "button",
  className,
  alwaysLabeled = false,
  shortcut,
}: CompactActionProps) {
  const labelClass = alwaysLabeled ? undefined : "sr-only sm:not-sr-only";
  const ariaLabel = shortcut ? `${label} (${shortcut})` : label;
  const tooltipLabel = shortcut ? `${label} · ${shortcut}` : label;

  const content = (
    <>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className={labelClass}>{label}</span>
      {shortcutSuffix(shortcut)}
    </>
  );

  if (href) {
    const isExternal = /^https?:\/\//i.test(href);
    const openInNewTab = isExternal || href.startsWith("/print/");
    const linkClass = cn(
      buttonVariants({ variant }),
      iconOnlyClass,
      "inline-flex items-center justify-center",
      className
    );

    if (alwaysLabeled) {
      if (openInNewTab) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={ariaLabel}
            aria-keyshortcuts={shortcut}
            className={linkClass}
          >
            {content}
          </a>
        );
      }
      return (
        <Link href={href} aria-label={ariaLabel} aria-keyshortcuts={shortcut} className={linkClass}>
          {content}
        </Link>
      );
    }

    if (openInNewTab) {
      return (
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={ariaLabel}
                aria-keyshortcuts={shortcut}
                className={linkClass}
              />
            }
          >
            {content}
          </TooltipTrigger>
          <TooltipContent side="top" className="sm:hidden">
            {tooltipLabel}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={href}
              aria-label={ariaLabel}
              aria-keyshortcuts={shortcut}
              className={linkClass}
            />
          }
        >
          {content}
        </TooltipTrigger>
        <TooltipContent side="top" className="sm:hidden">
          {tooltipLabel}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (alwaysLabeled) {
    return (
      <Button
        type={type}
        variant={variant}
        disabled={disabled}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-keyshortcuts={shortcut}
        className={cn(iconOnlyClass, className)}
      >
        {content}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type={type}
            variant={variant}
            disabled={disabled}
            onClick={onClick}
            aria-label={ariaLabel}
            aria-keyshortcuts={shortcut}
            className={cn(iconOnlyClass, className)}
          />
        }
      >
        {content}
      </TooltipTrigger>
      <TooltipContent side="top" className="sm:hidden">
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}
