import { ApiError } from "../../lib/errors";
import * as beatRepo from "./beatRepository";
import * as visitRepo from "../visits/visitRepository";
import * as distributorService from "../distributors/distributorService";
import { istDayOfWeek, istDateString } from "../../lib/istDate";
import type { TodayBeatResponse, BeatSummary, BeatRetailerListResponse } from "@flowmint/shared";

export async function getTodayBeat(employeeId: string): Promise<TodayBeatResponse> {
  const dayOfWeek = istDayOfWeek();
  const visitDate = istDateString();

  const beat = await beatRepo.findTodayBeatForEmployee(employeeId, dayOfWeek);
  const visitsByRetailer = await visitRepo.findVisitsForEmployeeOnDate(employeeId, visitDate);

  if (!beat) {
    return { beatId: null, beatName: null, distributorId: null, date: visitDate, retailers: [] };
  }

  const beatRetailers = await beatRepo.findBeatRetailers(beat.id);

  return {
    beatId: beat.id,
    beatName: beat.name,
    distributorId: beat.distributor_id,
    date: visitDate,
    retailers: beatRetailers.map((r) => {
      const visit = visitsByRetailer.get(r.id);
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        ownerName: r.owner_name,
        addressLine: r.address_line,
        city: r.city,
        pincode: r.pincode,
        phone: r.phone,
        sequenceNo: r.sequence_no,
        visitStatus: visit ? visit.outcome : "PENDING",
        visitId: visit ? visit.id : null,
      };
    }),
  };
}

// The "browse all beats" list for one distributor — every beat this
// employee is mapped to under it, any day_of_week. Distinct from "today's
// beat" above, which is at most one beat total regardless of distributor.
export async function listBeatsForDistributor(
  employeeId: string,
  distributorId: string
): Promise<BeatSummary[]> {
  await distributorService.requireDistributorAccess(employeeId, distributorId);
  const beats = await beatRepo.findBeatsForDistributor(distributorId);
  return beats.map((b) => ({ id: b.id, name: b.name, code: b.code }));
}

export async function listBeatRetailers(
  employeeId: string,
  beatId: string
): Promise<BeatRetailerListResponse> {
  const beat = await beatRepo.findById(beatId);
  if (!beat) {
    throw new ApiError(404, "BEAT_NOT_FOUND", "Beat not found.");
  }
  // Same-level check as everywhere else: does this employee have access to
  // *this beat's* distributor — not "is the employee specifically
  // day-of-week-scheduled on it" (that's what today's-beat resolution is
  // for, a different, narrower question).
  await distributorService.requireDistributorAccess(employeeId, beat.distributor_id);

  const beatRetailers = await beatRepo.findBeatRetailers(beatId);
  return {
    beatId: beat.id,
    beatName: beat.name,
    distributorId: beat.distributor_id,
    retailers: beatRetailers.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      ownerName: r.owner_name,
      addressLine: r.address_line,
      city: r.city,
      pincode: r.pincode,
      phone: r.phone,
      sequenceNo: r.sequence_no,
    })),
  };
}
