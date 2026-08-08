import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Building2,
  Clock3,
  Gauge,
  Mail,
  Palette,
  ScrollText,
  Users,
  UserPlus,
} from "lucide-react";

export type PlatformNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Match nested routes like /platform/orgs/[id] under الشركات */
  match?: "exact" | "prefix";
};

export type PlatformNavGroup = {
  id: string;
  label: string;
  items: PlatformNavItem[];
};

export const PLATFORM_NAV_GROUPS: PlatformNavGroup[] = [
  {
    id: "overview",
    label: "نظرة عامة",
    items: [
      {
        href: "/platform",
        label: "الشركات",
        description: "تعليق، تفاصيل، وتدقيق سريع",
        icon: Building2,
        match: "exact",
      },
      {
        href: "/platform/usage",
        label: "الاستهلاك",
        description: "باقة وحدود كل شركة",
        icon: Gauge,
        match: "prefix",
      },
      {
        href: "/platform/menu-themes",
        label: "ثيمات المنيو",
        description: "أسعار وتوفر مظاهر المنيو",
        icon: Palette,
        match: "prefix",
      },
    ],
  },
  {
    id: "accounts",
    label: "الحسابات",
    items: [
      {
        href: "/platform/users",
        label: "المستخدمين",
        description: "أدوار، كلمات مرور، دخول كحساب",
        icon: Users,
        match: "prefix",
      },
      {
        href: "/platform/invites",
        label: "الدعوات",
        description: "دعوة شركات جديدة",
        icon: UserPlus,
        match: "prefix",
      },
    ],
  },
  {
    id: "operations",
    label: "التشغيل",
    items: [
      {
        href: "/platform/sessions",
        label: "الجلسات",
        description: "ورديات مفتوحة وإغلاق إجباري",
        icon: Clock3,
        match: "prefix",
      },
      {
        href: "/platform/ops",
        label: "العمليات",
        description: "إيميل، أونلاين، مخزون",
        icon: Activity,
        match: "prefix",
      },
    ],
  },
  {
    id: "comms",
    label: "التواصل والتدقيق",
    items: [
      {
        href: "/platform/marketing",
        label: "الرسائل",
        description: "بث تشغيلي عبر Resend",
        icon: Mail,
        match: "prefix",
      },
      {
        href: "/platform/audit",
        label: "سجل المنصة",
        description: "أحداث السوبر أدمن",
        icon: ScrollText,
        match: "prefix",
      },
    ],
  },
];

export function isPlatformNavActive(pathname: string, item: PlatformNavItem): boolean {
  if (item.match === "exact" || item.href === "/platform") {
    return (
      pathname === "/platform" ||
      pathname.startsWith("/platform/orgs/")
    );
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getPlatformPageTitle(pathname: string): string {
  for (const group of PLATFORM_NAV_GROUPS) {
    for (const item of group.items) {
      if (isPlatformNavActive(pathname, item)) return item.label;
    }
  }
  if (pathname.startsWith("/platform/orgs/")) return "تفاصيل الشركة";
  return "المنصة";
}
