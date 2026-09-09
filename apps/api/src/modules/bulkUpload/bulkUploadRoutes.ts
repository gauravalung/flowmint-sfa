import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { templateHandler, uploadHandler } from "./bulkUploadController";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — generous for a CSV master upload
});

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/:type/template", templateHandler as any);
router.post("/:type", upload.single("file"), uploadHandler as any);

export default router;
