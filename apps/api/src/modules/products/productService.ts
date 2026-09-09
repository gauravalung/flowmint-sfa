import { ApiError } from "../../lib/errors";
import * as productRepo from "./productRepository";
import * as catalogRefRepo from "./catalogRefRepository";
import type { ProductSummary } from "@flowmint/shared";

function toSummary(row: productRepo.DistributorProductRow): ProductSummary {
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
    availableQty: row.available_qty,
    isFocusProduct: row.is_focus_product,
  };
}

export async function getDistributorCatalog(
  distributionPartnerId: string,
  filter: { search?: string; focusOnly?: boolean; inStockOnly?: boolean; sort?: "name" | "mrp"; page: number; pageSize: number }
): Promise<{ products: ProductSummary[]; total: number }> {
  const { rows, total } = await productRepo.findInventoryForDistributor(distributionPartnerId, {
    ...filter,
    sort: filter.sort ?? "name",
  });
  return { products: rows.map(toSummary), total };
}

export async function createProduct(
  companyId: string,
  params: {
    skuCode: string;
    name: string;
    brandName: string;
    categoryName: string;
    packSize: string;
    uom?: string;
    mrp: number;
    price: number;
    gstRate: number;
  }
) {
  const existing = await productRepo.findBySkuCode(params.skuCode);
  if (existing) throw new ApiError(409, "SKU_ALREADY_IN_USE", `SKU ${params.skuCode} is already in use.`);

  const brand = await catalogRefRepo.findOrCreateBrandByName(params.brandName);
  const category = await catalogRefRepo.findOrCreateCategoryByName(params.categoryName);

  return productRepo.create({
    companyId,
    brandId: brand.id,
    categoryId: category.id,
    skuCode: params.skuCode,
    name: params.name,
    packSize: params.packSize,
    uom: params.uom ?? "PCS",
    mrp: params.mrp,
    price: params.price,
    gstRate: params.gstRate,
  });
}

export async function setInventory(params: {
  distributionPartnerId: string;
  productId: string;
  availableQty: number;
  isFocusProduct: boolean;
}): Promise<void> {
  const product = await productRepo.findById(params.productId);
  if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  await productRepo.upsertInventory(params);
}
