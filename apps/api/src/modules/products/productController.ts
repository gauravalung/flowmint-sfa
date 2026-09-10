import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as productService from "./productService";

function parsePage(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parsePageSize(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(Math.floor(n), 100);
}

export async function listProductsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const categoryId =
      typeof req.query.category_id === "string" && req.query.category_id ? req.query.category_id : null;
    const page = parsePage(req.query.page);
    const pageSize = parsePageSize(req.query.page_size);
    const result = await productService.listProducts(search, categoryId, page, pageSize);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listCategoriesHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const categories = await productService.listCategories();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}
