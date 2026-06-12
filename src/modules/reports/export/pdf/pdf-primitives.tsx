import { Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "@/modules/reports/export/pdf/pdf-styles";
import type { ReportBranding } from "@/modules/reports/core/report-context";

export interface PdfColumn {
  key: string;
  header: string;
  width: string;
  align?: "left" | "right";
}

interface PdfHeaderProps {
  branding: ReportBranding;
  title: string;
  subtitle?: string;
  dateRange?: string;
}

export function PdfHeader({ branding, title, subtitle, dateRange }: PdfHeaderProps) {
  return (
    <View style={pdfStyles.header}>
      <Text style={pdfStyles.title}>{branding.orgName}</Text>
      {branding.storeName ? <Text style={pdfStyles.subtitle}>{branding.storeName}</Text> : null}
      <Text style={pdfStyles.title}>{title}</Text>
      {subtitle ? <Text style={pdfStyles.subtitle}>{subtitle}</Text> : null}
      {dateRange ? <Text style={pdfStyles.subtitle}>{dateRange}</Text> : null}
    </View>
  );
}

interface PdfTableProps {
  columns: PdfColumn[];
  rows: Record<string, string | number>[];
}

export function PdfTable({ columns, rows }: PdfTableProps) {
  return (
    <View style={pdfStyles.table}>
      <View style={pdfStyles.tableHeader}>
        {columns.map((col) => (
          <Text key={col.key} style={{ width: col.width, textAlign: col.align ?? "left" }}>
            {col.header}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View key={index} style={pdfStyles.tableRow}>
          {columns.map((col) => (
            <Text key={col.key} style={{ width: col.width, textAlign: col.align ?? "left" }}>
              {String(row[col.key] ?? "")}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

interface PdfFooterProps {
  generatedBy: string;
  generatedAt: string;
  filterSummary?: string;
}

export function PdfFooter({ generatedBy, generatedAt, filterSummary }: PdfFooterProps) {
  return (
    <View style={pdfStyles.footer} fixed>
      <Text>
        {generatedBy} · {generatedAt}
      </Text>
      {filterSummary ? <Text>{filterSummary}</Text> : null}
    </View>
  );
}

interface PdfPageShellProps {
  children: React.ReactNode;
}

export function PdfPageShell({ children }: PdfPageShellProps) {
  return <Page size="A4" style={pdfStyles.page}>{children}</Page>;
}
