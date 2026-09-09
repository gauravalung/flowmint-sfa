import * as beatRepo from "./beatRepository";
import * as visitRepo from "../visits/visitRepository";
import { ApiError } from "../../lib/errors";
import { istDayOfWeek, istDateString } from "../../lib/istDate";
import type { TodayBeatResponse, BeatSummary, RetailerSummary, DistributionPartnerSummary } from "@flowmint/shared";

function toBeatSummary(row: beatRepo.BeatRow): BeatSummary {
  return { id: row.id, code: row.code, name: row.name, isActive: row.is_active };
}

function toRetailerSummary(r: beatRepo.BeatRetailerRow): RetailerSummary {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    ownerName: r.owner_name,
    category: r.category as RetailerSummary["category"],
    subcategoryId: r.subcategory_id,
    subcategoryName: r.subcategory_name,
    addressLine: r.address_line,
    city: r.city,
    pincode: r.pincode,
    phone: r.phone,
    latitude: r.latitude,
    longitude: r.longitude,
    isActive: r.is_active,
  };
}

// ---------------------------------------------------------------------------
// Mobile: today's beat (MVP-continuity fallback — see beatRepository.ts)
// ---------------------------------------------------------------------------

export async function getTodayBeat(employeeId: string): Promise<TodayBeatResponse> {
  const dayOfWeek = istDayOfWeek();
  const visitDate = istDateString();

  const beat = await beatRepo.findTodayBeatForEmployee(employeeId, dayOfWeek);
  const visitsByRetailer = await visitRepo.findVisitsForEmployeeOnDate(employeeId, visitDate);

  if (!beat) {
    return { beatId: null, beatName: null, date: visitDate, retailers: [] };
  }

  const beatRetailers = await beatRepo.findBeatRetailers(beat.id);

  return {
    beatId: beat.id,
    beatName: beat.name,
    date: visitDate,
    retailers: beatRetailers.map((r) => {
      const visit = visitsByRetailer.get(r.id);
      return {
        ...toRetailerSummary(r),
        sequenceNo: r.sequence_no,
        visitStatus: visit ? visit.outcome : "PENDING",
        visitId: visit ? visit.id : null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Mobile navigation: Distributor list -> Beat list -> Retailer list
// (spec §8.4)
// ---------------------------------------------------------------------------

export async function listMyDistributors(employeeId: string): Promise<DistributionPartnerSummary[]> {
  const rows = await beatRepo.findDistributorsForEmployee(employeeId);
  return rows.map((r) => ({
    id: r.id,
    partnerType: r.partner_type as DistributionPartnerSummary["partnerType"],
    parentPartnerId: null,
    code: r.code,
    name: r.name,
    contactName: null,
    contactPhone: null,
    addressLine: null,
    city: null,
    pincode: null,
    billedBy: "COMPANY",
    isActive: true,
  }));
}

export async function listMyBeatsForDistributor(
  employeeId: string,
  distributionPartnerId: string
): Promise<BeatSummary[]> {
  const rows = await beatRepo.findBeatsForDistributorAndEmployee(distributionPartnerId, employeeId);
  return rows.map(toBeatSummary);
}

export async function listBeatRetailers(beatId: string): Promise<RetailerSummary[]> {
  const rows = await beatRepo.findBeatRetailers(beatId);
  return rows.map(toRetailerSummary);
}

// ---------------------------------------------------------------------------
// Admin: beat master data
// ---------------------------------------------------------------------------

export async function createBeat(companyId: string, name: string, code: string): Promise<BeatSummary> {
  const existing = await beatRepo.findByCode(code);
  if (existing) throw new ApiError(409, "CODE_ALREADY_IN_USE", `Code ${code} is already in use.`);
  const row = await beatRepo.create({ companyId, name, code });
  return toBeatSummary(row);
}

export async function listBeats(isActive?: boolean): Promise<BeatSummary[]> {
  const rows = await beatRepo.list(isActive);
  return rows.map(toBeatSummary);
}

export async function setBeatStatus(id: string, isActive: boolean): Promise<BeatSummary> {
  const row = await beatRepo.setStatus(id, isActive);
  if (!row) throw new ApiError(404, "BEAT_NOT_FOUND", "Beat not found.");
  return toBeatSummary(row);
}
