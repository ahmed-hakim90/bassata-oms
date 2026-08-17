"use client";

import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/use-translation";

export interface StatementRow {
  id: string;
  date: string;
  type: string;
  reference?: string | null;
  debit: number;
  credit: number;
  balance: number;
  paymentId?: string | null;
  canVoid?: boolean;
}

interface StatementTableProps {
  currency: string;
  openingBalance: number;
  closingBalance: number;
  rows: StatementRow[];
  renderRowActions?: (row: StatementRow) => ReactNode;
}

export function StatementTable({
  currency,
  openingBalance,
  closingBalance,
  rows,
  renderRowActions,
}: StatementTableProps) {
  const { t } = useTranslation();
  const hasActions = Boolean(renderRowActions);

  return (
    <ResponsiveListLayout
      mobile={
        <>
          <MobileEntityCard
            title={t("Opening balance")}
            fields={[
              {
                label: t("Balance"),
                value: (
                  <span className="tabular-nums">
                    {formatCurrency(openingBalance, currency)}
                  </span>
                ),
              },
            ]}
          />
          {rows.map((row) => (
            <MobileEntityCard
              key={row.id}
              title={t(row.type)}
              subtitle={formatDateTime(row.date)}
              fields={[
                { label: t("Reference"), value: row.reference ?? "—" },
                {
                  label: t("Debit"),
                  value:
                    row.debit > 0 ? (
                      <span className="tabular-nums">
                        {formatCurrency(row.debit, currency)}
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  label: t("Credit"),
                  value:
                    row.credit > 0 ? (
                      <span className="tabular-nums">
                        {formatCurrency(row.credit, currency)}
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  label: t("Balance"),
                  value: (
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(row.balance, currency)}
                    </span>
                  ),
                },
              ]}
              footer={renderRowActions?.(row) ?? undefined}
            />
          ))}
          <MobileEntityCard
            title={t("Closing balance")}
            fields={[
              {
                label: t("Balance"),
                value: (
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(closingBalance, currency)}
                  </span>
                ),
              },
            ]}
          />
        </>
      }
      desktop={
        <div className="overflow-x-auto rounded-[var(--mds-radius-md)] border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Date")}</TableHead>
                <TableHead>{t("Type")}</TableHead>
                <TableHead>{t("Reference")}</TableHead>
                <TableHead className="text-end">{t("Debit")}</TableHead>
                <TableHead className="text-end">{t("Credit")}</TableHead>
                <TableHead className="text-end">{t("Balance")}</TableHead>
                {hasActions ? <TableHead className="w-24" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40 font-medium">
                <TableCell colSpan={5}>{t("Opening balance")}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatCurrency(openingBalance, currency)}
                </TableCell>
                {hasActions ? <TableCell /> : null}
              </TableRow>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDateTime(row.date)}</TableCell>
                  <TableCell>{t(row.type)}</TableCell>
                  <TableCell>{row.reference ?? "—"}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {row.debit > 0 ? formatCurrency(row.debit, currency) : "—"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {row.credit > 0 ? formatCurrency(row.credit, currency) : "—"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCurrency(row.balance, currency)}
                  </TableCell>
                  {hasActions ? (
                    <TableCell className="text-end">{renderRowActions?.(row)}</TableCell>
                  ) : null}
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell colSpan={5}>{t("Closing balance")}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatCurrency(closingBalance, currency)}
                </TableCell>
                {hasActions ? <TableCell /> : null}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      }
    />
  );
}
