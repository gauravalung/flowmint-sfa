import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as productService from "./productService";

// GET /api/v1/distributors/:id/products — spec §8.6 catalog filters.
export async function distributorCatalogHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const focusOnly = req.query.focus === "true";
    const inStockOnly = req.query.inStockOnly === "true";
    const sort = req.query.sort === "mrp" ? "mrp" : "name";
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const result = await productService.getDistributorCatalog(req.params.id, {
      search,
      focusOnly,
      inStockOnly,
      sort,
      page,
      pageSize,
    });
    res.json({ ...result, page, pageSize });
  } catch (err) {
    next(err);
  }
}
