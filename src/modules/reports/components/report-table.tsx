"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
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
  const table = useReactTable({
    data,
    columns: normalizedColumns,
    getCoreRowModel: getCoreRowModel(),
  });
  const totalPages = total ? Math.ceil(total / pageSize) : 1;

  return (
    <DataTableShell title={title ? t(title) : undefined}>
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
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {t(emptyMessage)}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
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
      {onPageChange && total && total > pageSize ? (
        <div className="mt-4 flex items-center justify-between print:hidden">
          <p className="text-sm text-muted-foreground">
            {t("Page")} {page} / {totalPages} · {total} {t("rows")}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              {t("Previous")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              {t("Next")}
            </Button>
          </div>
        </div>
      ) : null}
    </DataTableShell>
  );
}
