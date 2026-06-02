"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { exportAndDownload } from "@/lib/services/export.service";
import { ImportProductsDialog } from "@/modules/imports-exports/components/import-products-dialog";
import { exportProductsDataAction } from "@/modules/imports-exports/actions/import-export.actions";
import type { Product, Customer } from "@/lib/types";

function downloadBase64(base64: string, filename: string) {
  const link = document.createElement("a");
  link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
  link.download = filename;
  link.click();
}

interface ImportsExportsPageProps {
  products: Product[];
  customers: Customer[];
}

export function ImportsExportsPage({
  products,
  customers,
}: ImportsExportsPageProps) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const exportProducts = () => {
    startTransition(async () => {
      try {
        const { base64, filename } = await exportProductsDataAction();
        downloadBase64(base64, filename);
        toast.success("Products exported");
      } catch {
        toast.error("Export failed");
      }
    });
  };

  const exportCustomers = () => {
    exportAndDownload(
      customers,
      [
        { header: "Name", accessor: (c) => c.name },
        { header: "Phone", accessor: (c) => c.phone },
        { header: "Email", accessor: (c) => c.email ?? "" },
        { header: "Total Spent", accessor: (c) => c.total_spent },
        { header: "Visits", accessor: (c) => c.visit_count },
      ],
      { fileName: "SweetFlow-customers", sheetName: "Customers" }
    );
    toast.success("Customers exported");
  };

  return (
    <>
      <PageHeader
        title="Imports & Exports"
        description="Bulk data operations via XLSX"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <OperationalCard
          title="Export"
          description="Download current data as spreadsheets"
        >
          <div className="flex flex-col gap-3">
            <Button variant="outline" onClick={exportProducts} disabled={pending}>
              <Download className="size-4" /> Export Products ({products.length})
            </Button>
            <Button variant="outline" onClick={exportCustomers}>
              <Download className="size-4" /> Export Customers ({customers.length})
            </Button>
          </div>
        </OperationalCard>

        <OperationalCard
          title="Import"
          description="Upload XLSX to bulk update catalog"
        >
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Import Products
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Supported: products (use the SweetFlow template columns)
          </p>
        </OperationalCard>
      </div>

      <OperationalCard title="Templates" className="mt-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <FileSpreadsheet className="size-8" />
          <p className="text-sm">
            Export products first to get the correct column format, then re-import
            with updates.
          </p>
        </div>
      </OperationalCard>

      <ImportProductsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => router.refresh()}
      />
    </>
  );
}
