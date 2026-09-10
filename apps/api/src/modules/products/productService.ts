import * as productRepo from "./productRepository";
import type { ProductSummary } from "@flowmint/shared";

function toSummary(row: productRepo.ProductWithNamesRow): ProductSummary {
  return {
    id: row.id,
    skuCode: row.sku_code,
    name: row.name,
    brandName: row.brand_name,
    categoryName: row.category_name,
    categoryId: row.category_id,
    packSize: row.pack_size,
    uom: row.uom,
    mrp: row.mrp,
    price: row.price,
    gstRate: row.gst_rate,
  };
}

export async function listProducts(
  search: string,
  categoryId: string | null,
  page: number,
  pageSize: number
): Promise<{ products: ProductSummary[]; total: number; page: number; pageSize: number }> {
  const { rows, total } = await productRepo.searchProducts(search.trim(), categoryId, page, pageSize);
  return { products: rows.map(toSummary), total, page, pageSize };
}

export async function listCategories(): Promise<productRepo.CategoryRow[]> {
  return productRepo.findCategories();
}
