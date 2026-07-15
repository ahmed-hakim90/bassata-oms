"use client";

import type { ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableShell } from "@/components/SweetFlow/data-table-shell";
import { MobileEntityCard } from "@/components/SweetFlow/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/SweetFlow/responsive-list-layout";
import { useTranslation } from "@/lib/i18n/use-translation";

interface ReportTableProps<T> {
  title?: string;
  columns: ColumnDef<T, unknown>[];
  data: T[];
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  emptyMessage?: string;
}

function columnLabel<T>(column: Column<T, unknown>): string {
  const header = column.columnDef.header;
  if (typeof header === "string" && header.length > 0) return header;
  return column.id;
}

export function ReportTable<T>({
  title,
  columns,
  data,
  page = 1,
  pageSize = 50,
  total,
  onPageChange,
  emptyMessage = "No data for this period",
}: ReportTableProps<T>) {
  const { t } = useTranslation();
  const normalizedColumns = columns.map((column, index) => {
    if (column.id || ("accessorKey" in column && column.accessorKey)) {
      return column;
    }
    const header = column.header;
    if (typeof header === "string" && header.length > 0) {
      return { ...column, id: header };
    }
    return { ...column, id: `col_${index}` };
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: normalizedColumns,
    getCoreRowModel: getCoreRowModel(),
  });
  const totalPages = total ? Math.ceil(total / pageSize) : 1;
  const rows = table.getRowModel().rows;
  const emptyLabel = t(emptyMessage);

  const pagination =
    onPageChange && total && total > pageSize ? (
      <div className="mt-3 flex flex-col gap-2 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("Page")} {page} / {totalPages} · {total} {t("rows")}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            size="sm"
            variant="outline"
            className="min-h-11 sm:min-h-9"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            {t("Previous")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-11 sm:min-h-9"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {t("Next")}
          </Button>
        </div>
      </div>
    ) : null;

  let mobile: ReactNode;
  if (rows.length === 0) {
    mobile = (
      <p className="rounded-[var(--mds-radius-md)] border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  } else {
    mobile = rows.map((row) => {
      const cells = row.getVisibleCells();
      const [titleCell, ...rest] = cells;
      if (!titleCell) return null;
      const fieldCells = rest.slice(0, 6);
      return (
        <MobileEntityCard
          key={row.id}
          title={flexRender(titleCell.column.columnDef.cell, titleCell.getContext())}
          fields={fieldCells.map((cell) => ({
            label: columnLabel(cell.column),
            value: flexRender(cell.column.columnDef.cell, cell.getContext()),
          }))}
        />
      );
    });
  }

  return (
    <DataTableShell title={title ? t(title) : undefined} scrollable={false}>
      <ResponsiveListLayout
        mobile={mobile}
        desktop={
          <div className="overflow-x-auto rounded-[var(--mds-radius-md)] border border-border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {emptyLabel}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        }
      />
      {pagination}
    </DataTableShell>
  );
}
