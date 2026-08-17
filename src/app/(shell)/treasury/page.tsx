import { AccessDenied } from "@/components/Velora/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { getTreasuryPageDataAction } from "@/modules/treasury/actions/treasury.actions";
import { TreasuryPage } from "@/modules/treasury/components/treasury-page";
import type { CashTreasuryEntryType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TreasuryRoute({
  searchParams,
}: {
  searchParams: Promise<{
    treasuryId?: string;
    entryType?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  try {
    const data = await getTreasuryPageDataAction({
      treasuryId: params.treasuryId || undefined,
      entryType: (params.entryType as CashTreasuryEntryType | undefined) || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
    });
    return (
      <TreasuryPage
        data={data}
        filters={{
          treasuryId: params.treasuryId ?? "",
          entryType: params.entryType ?? "",
          from: params.from ?? "",
          to: params.to ?? "",
        }}
      />
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return (
        <AccessDenied
          title="مفيش صلاحية للخزائن"
          description="الخزائن للمالك والمدير فقط."
        />
      );
    }
    throw error;
  }
}
