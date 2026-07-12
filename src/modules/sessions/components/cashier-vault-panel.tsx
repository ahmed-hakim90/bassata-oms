import { formatCurrency } from "@/lib/format";
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
      <div className="space-y-1">
        <h2 className="font-heading text-base font-semibold">خزائن الكاشير</h2>
        <p className="text-sm text-muted-foreground">
          أمانة الكاش لكل موظف في {storeName} — منفصلة عن عدّ درج الوردية. السحب
          للإدارة فقط، ورصيد بداية الوردية الجاية بيتقفّل على الكاشير.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[var(--mds-radius-lg)] border border-dashed border-border p-6 text-sm text-muted-foreground">
          مفيش كاشير ظاهر على الفرع ده حالياً
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--mds-radius-lg)] border border-border bg-card">
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
      )}
    </section>
  );
}
