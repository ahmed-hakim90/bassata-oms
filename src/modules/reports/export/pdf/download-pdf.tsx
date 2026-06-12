"use client";

import { pdf, type DocumentProps } from "@react-pdf/renderer";
import { registerPdfFonts } from "@/modules/reports/export/pdf/fonts";
import type { ReactElement } from "react";

export async function downloadPdfDocument(
  pdfDoc: ReactElement<DocumentProps>,
  fileName: string
): Promise<void> {
  registerPdfFonts();
  const blob = await pdf(pdfDoc).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
