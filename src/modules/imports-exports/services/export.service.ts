import * as XLSX from "xlsx";
import * as productService from "@/modules/products/services/product.service";
import { PRODUCT_IMPORT_COLUMNS } from "./import.service";

async function categoryName(categoryId: string): Promise<string> {
  const categories = await productService.listCategories();
  return categories.find((c) => c.id === categoryId)?.name ?? "";
}

export function buildProductsTemplateWorkbook(): ArrayBuffer {
  const header = [...PRODUCT_IMPORT_COLUMNS];
  const sample = [
    {
      name: "Mint Chip Scoop",
      sku: "ICE-010",
      barcode: "100010",
      category: "Ice Cream",
      base_price: 5.25,
      is_active: true,
      is_popular: false,
      track_inventory: true,
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(sample, { header });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Products");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export async function buildProductsExportWorkbook(): Promise<ArrayBuffer> {
  const products = await productService.listProducts();
  const rows = await Promise.all(
    products.map(async (p) => ({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: await categoryName(p.category_id),
      base_price: p.base_price,
      is_active: p.is_active,
      is_popular: p.is_popular,
      track_inventory: p.track_inventory,
    }))
  );
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...PRODUCT_IMPORT_COLUMNS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Products");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function workbookToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}
