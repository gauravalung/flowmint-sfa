import * as beatRepo from "./beatRepository";
import * as visitRepo from "../visits/visitRepository";
import { istDayOfWeek, istDateString } from "../../lib/istDate";
import type { TodayBeatResponse } from "@flowmint/shared";

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
