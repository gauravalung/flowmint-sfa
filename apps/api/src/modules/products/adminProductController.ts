import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { createProductAdminSchema, setDistributorInventorySchema } from "@flowmint/shared";
import * as productService from "./productService";

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
