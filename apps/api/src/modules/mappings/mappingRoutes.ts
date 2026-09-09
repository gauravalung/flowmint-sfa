import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import * as controller from "./mappingController";

const router = Router();

// Admin owns all mapping creation/removal — spec §6/§11. Each pair of
// routes below is one of the six relationship tables; removal only ever
// deactivates the single mapping row named by :id, never any sibling
// mapping for the same entity.
router.use(requireAuth, requireRole("ADMIN"));

router.post("/distribution-partner-beat", controller.mapDistributionPartnerBeatHandler as any);
router.delete("/distribution-partner-beat/:id", controller.unmapDistributionPartnerBeatHandler as any);

router.post("/beat-retailer", controller.mapBeatRetailerHandler as any);
router.delete("/beat-retailer/:id", controller.unmapBeatRetailerHandler as any);

router.post("/retailer-distribution-partner", controller.mapRetailerDistributionPartnerHandler as any);
router.delete("/retailer-distribution-partner/:id", controller.unmapRetailerDistributionPartnerHandler as any);

router.post("/employee-distribution-partner", controller.mapEmployeeDistributionPartnerHandler as any);
router.delete("/employee-distribution-partner/:id", controller.unmapEmployeeDistributionPartnerHandler as any);

router.post("/employee-beat", controller.mapEmployeeBeatHandler as any);
router.delete("/employee-beat/:id", controller.unmapEmployeeBeatHandler as any);

router.post("/employee-retailer", controller.mapEmployeeRetailerHandler as any);
router.delete("/employee-retailer/:id", controller.unmapEmployeeRetailerHandler as any);

export default router;
