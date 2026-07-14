import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { requirePageAuth } from "@/lib/auth/page-guard";
import { getPriceListStudioDataAction } from "@/modules/price-lists/actions/price-list.actions";
import { PriceListStudio } from "@/modules/price-lists/components/price-list-studio";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function PurchasePriceListPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string; products?: string }>;
}) {
  const auth = await requirePageAuth("/inventory/purchases/price-list");
  if (!auth.ok) {
    return <AccessDenied title={auth.denial.title} description={auth.denial.description} />;
  }

  const params = await searchParams;
  const productIds = (params.products ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const result = await getPriceListStudioDataAction({
    invoiceId: params.invoice ?? null,
    productIds,
  });

  if (!result.ok) {
    return (
      <EmptyStateBlock
        title="مقدرناش نفتح قائمة الأسعار"
        description={result.error}
        action={
          <Link
            href="/inventory/purchases"
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
          >
            رجوع للمشتريات
          </Link>
        }
      />
    );
  }

  return <PriceListStudio initial={result.data} />;
}
