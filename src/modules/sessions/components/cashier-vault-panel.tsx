import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { CashierVaultBatchWithdrawDialog } from "@/modules/sessions/components/cashier-vault-batch-withdraw-dialog";
import { CashierVaultWithdrawDialog } from "@/modules/sessions/components/cashier-vault-withdraw-dialog";
import type { CashierVaultSummary } from "@/modules/sessions/services/cashier-vault.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLE_LABEL: Record<string, string> = {
  cashier: "كاشير",
  manager: "مدير",
  owner: "مالك",
  inventory: "مخزون",
};

interface CashierVaultPanelProps {
  storeId: string;
  storeName: string;
  rows: CashierVaultSummary[];
  canManage: boolean;
}

export function CashierVaultPanel({
  storeId,
  storeName,
  rows,
  canManage,
}: CashierVaultPanelProps) {
  return (
    <section className="flex flex-col gap-[var(--mds-space-3)]">
      <div className="flex flex-wrap items-start justify-between gap-[var(--mds-space-3)]">
        <div className="space-y-1">
          <h2 className="font-heading text-base font-semibold">خزائن الكاشير</h2>
          <p className="text-sm text-muted-foreground">
            أمانة الكاش لكل موظف في {storeName} — منفصلة عن عدّ درج الوردية. السحب
            بيورّد لخزينة الفرع أو الرئيسية، ورصيد بداية الوردية الجاية بيتقفّل على
            الكاشير.{" "}
            <Link
              href="/treasury"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              فتح الخزائن
            </Link>
          </p>
        </div>
        {canManage ? (
          <div className="shrink-0">
            <CashierVaultBatchWithdrawDialog
              storeId={storeId}
              storeName={storeName}
              rows={rows}
            />
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[var(--mds-radius-lg)] border border-dashed border-border p-6 text-sm text-muted-foreground">
          مفيش كاشير ظاهر على الفرع ده حالياً
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {rows.map((row) => (
              <div
                key={row.cashierId}
                className="space-y-3 rounded-[var(--mds-radius-lg)] border border-border bg-card p-3 shadow-[var(--mds-elevation-1)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.cashierName}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABEL[row.role] ?? row.role}
                    </p>
                  </div>
                  {canManage ? (
                    <CashierVaultWithdrawDialog storeId={storeId} row={row} />
                  ) : null}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-muted/40 px-2.5 py-2">
                    <dt className="text-xs text-muted-foreground">رصيد الخزينة</dt>
                    <dd className="font-semibold tabular-nums">{formatCurrency(row.balance)}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-2.5 py-2">
                    <dt className="text-xs text-muted-foreground">بداية الجاية</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatCurrency(row.pendingOpeningFloat)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-[var(--mds-radius-lg)] border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكاشير</TableHead>
                  <TableHead>الدور</TableHead>
                  <TableHead className="text-start">رصيد الخزينة</TableHead>
                  <TableHead className="text-start">بداية الوردية الجاية</TableHead>
                  {canManage ? <TableHead className="w-[100px]">إجراء</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.cashierId}>
                    <TableCell className="font-medium">{row.cashierName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ROLE_LABEL[row.role] ?? row.role}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCurrency(row.balance)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCurrency(row.pendingOpeningFloat)}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <CashierVaultWithdrawDialog storeId={storeId} row={row} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}
