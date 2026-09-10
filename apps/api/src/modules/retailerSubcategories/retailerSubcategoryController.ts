import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { retailerSubcategorySchema } from "@flowmint/shared";
import { ApiError } from "../../lib/errors";
import * as repo from "./retailerSubcategoryRepository";

function toSummary(row: repo.RetailerSubcategoryRow) {
  return { id: row.id, name: row.name, isActive: row.is_active };
}

export async function listHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query.activeOnly === "true";
    const rows = await repo.list(activeOnly);
    res.json({ subcategories: rows.map(toSummary) });
  } catch (err) {
    next(err);
  }
}

export async function createHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = retailerSubcategorySchema.parse(req.body);
    const existing = await repo.findByName(body.name);
    if (existing) {
      throw new ApiError(409, "SUBCATEGORY_NAME_TAKEN", `Subcategory "${body.name}" already exists.`);
    }
    const row = await repo.create(body.name);
    res.status(201).json(toSummary(row));
  } catch (err) {
    next(err);
  }
}

export async function setStatusHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const isActive = Boolean(req.body?.isActive);
    const row = await repo.setActive(req.params.id, isActive);
    if (!row) throw new ApiError(404, "SUBCATEGORY_NOT_FOUND", "Retailer subcategory not found.");
    res.json(toSummary(row));
  } catch (err) {
    next(err);
  }
}
