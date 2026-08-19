import { ApiError } from "../../lib/errors";
import * as visitRepo from "./visitRepository";
import * as retailerRepo from "../retailers/retailerRepository";
import * as employeeRepo from "../employees/employeeRepository";
import { istDateString } from "../../lib/istDate";

export async function startVisit(
  employeeId: string,
  params: { clientUuid: string; retailerId: string; beatId?: string; isOffBeat?: boolean }
): Promise<visitRepo.VisitRow> {
  const employee = await employeeRepo.findById(employeeId);
  const retailer = await retailerRepo.findById(params.retailerId);
  if (!retailer || !employee || retailer.distributor_id !== employee.distributor_id) {
    throw new ApiError(404, "RETAILER_NOT_FOUND", "Retailer not found.");
  }

  return visitRepo.createVisit({
    employeeId,
    retailerId: params.retailerId,
    beatId: params.beatId ?? null,
    visitDate: istDateString(),
    isOffBeat: params.isOffBeat ?? false,
    clientUuid: params.clientUuid,
  });
}

export async function closeVisit(
  employeeId: string,
  visitId: string,
  params: { outcome: "ORDER_BOOKED" | "NO_ORDER"; noOrderReason?: string }
): Promise<visitRepo.VisitRow> {
  const visit = await visitRepo.findById(visitId);
  if (!visit || visit.employee_id !== employeeId) {
    throw new ApiError(404, "VISIT_NOT_FOUND", "Visit not found.");
  }
  if (visit.outcome !== "IN_PROGRESS") {
    throw new ApiError(409, "VISIT_ALREADY_CLOSED", "This visit has already been closed.");
  }

  const updated = await visitRepo.closeVisit(visitId, params.outcome, params.noOrderReason ?? null);
  if (!updated) {
    // Only reachable on a race between two close calls for the same visit —
    // the IN_PROGRESS guard in the UPDATE's WHERE clause is what actually
    // prevents a double-close; this is just the error path for that race.
    throw new ApiError(409, "VISIT_ALREADY_CLOSED", "This visit has already been closed.");
  }
  return updated;
}
