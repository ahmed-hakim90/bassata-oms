import { StyleSheet } from "@react-pdf/renderer";
import { PDF_FONT } from "@/modules/reports/export/pdf/fonts";

export const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    fontSize: 10,
    padding: 32,
    color: "#111",
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 10,
    color: "#555",
    marginTop: 4,
  },
  table: {
    marginTop: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontWeight: 600,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 8,
    color: "#666",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
