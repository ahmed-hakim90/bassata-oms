import { Suspense } from "react";
import { ExpensesPage } from "@/modules/expenses/components/expenses-page";

export default async function ExpensesRoute({
  searchParams,
}: {
  searchParams: Promise<{
    costCenterId?: string;
    categoryId?: string;
    source?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading expenses…</div>}>
      <ExpensesPage filters={params} />
    </Suspense>
  );
}
