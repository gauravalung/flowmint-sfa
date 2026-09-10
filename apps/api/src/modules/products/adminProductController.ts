import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { createProductAdminSchema, setDistributorInventorySchema } from "@flowmint/shared";
import * as productService from "./productService";
import * as catalogRefRepo from "./catalogRefRepository";

export async function listBrandsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ brands: await catalogRefRepo.listBrands() });
  } catch (err) {
    next(err);
  }
}

export async function listCategoriesHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ categories: await catalogRefRepo.listCategories() });
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const result = await productService.listProducts({ search, categoryId, page, pageSize });
    res.json({ ...result, page, pageSize });
  } catch (err) {
    next(err);
  }
}

export async function createHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = createProductAdminSchema.parse(req.body);
    const result = await productService.createProduct(req.employee.companyId, body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function setInventoryHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = setDistributorInventorySchema.parse(req.body);
    await productService.setInventory({
      distributionPartnerId: req.params.id,
      productId: body.productId,
      availableQty: body.availableQty,
      isFocusProduct: body.isFocusProduct,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
