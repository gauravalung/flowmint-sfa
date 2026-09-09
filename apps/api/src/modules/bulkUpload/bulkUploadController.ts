import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { bulkUploadTypeSchema } from "@flowmint/shared";
import { ApiError } from "../../lib/errors";
import * as service from "./bulkUploadService";

export function templateHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const type = bulkUploadTypeSchema.parse(req.params.type);
    const csv = service.getTemplate(type);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${type.toLowerCase()}_template.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

export async function uploadHandler(
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response,
  next: NextFunction
) {
  try {
    const type = bulkUploadTypeSchema.parse(req.params.type);
    if (!req.file) {
      throw new ApiError(400, "FILE_REQUIRED", "Attach a CSV file as multipart field 'file'.");
    }
    const result = await service.processUpload(
      type,
      req.employee.companyId,
      req.employee.id,
      req.file.originalname,
      req.file.buffer
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
