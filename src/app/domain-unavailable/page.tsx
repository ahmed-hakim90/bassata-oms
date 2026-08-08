import Link from "next/link";
import { getSiteUrl } from "@/lib/site-url";

const REASON_COPY: Record<string, { title: string; body: string }> = {
  suspended: {
    title: "الحساب معلّق",
    body: "تم إيقاف هذه الشركة مؤقتًا. تواصل مع دعم Velora أو مشرف المنصة.",
  },
  unverified: {
    title: "الدومين غير مفعّل",
    body: "الدومين لسه مش متأكد أو مش مربوط. راجع إعدادات DNS مع مشرف المنصة.",
  },
  platform: {
    title: "منصة الإدارة على الدومين الأساسي فقط",
    body: "لوحة /platform متاحة على دومين المنصة، مش على دومين العميل.",
  },
  tenant: {
    title: "حسابك مش تابع لهذا الدومين",
    body: "سجّل الخروج وادخل من الدومين الصحيح لشركتك، أو استخدم رابط المنصة.",
  },
};

interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function DomainUnavailablePage({ searchParams }: PageProps) {
  const { reason } = await searchParams;
  const copy = REASON_COPY[reason ?? ""] ?? {
    title: "تعذّر فتح الموقع",
    body: "الدومين غير متاح حاليًا. جرّب لاحقًا أو تواصل مع الدعم.",
  };
  const platformUrl = getSiteUrl();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--mds-color-surface-page)] px-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">{copy.title}</h1>
      <p className="max-w-md text-muted-foreground">{copy.body}</p>
      <Link
        href={`${platformUrl}/login`}
        className="text-[var(--mds-color-action-primary)] underline-offset-4 hover:underline"
      >
        الذهاب لصفحة الدخول على المنصة
      </Link>
    </main>
  );
}
