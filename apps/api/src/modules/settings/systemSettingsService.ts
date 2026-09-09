import * as repo from "./systemSettingsRepository";
import type { SystemSetting } from "@flowmint/shared";

export const SETTING_KEYS = {
  OTP_MANDATORY_FOR_OUTLET_CREATION: "otp_mandatory_for_outlet_creation",
  DASHBOARD_ORDER_VALUE_BASIS: "dashboard_order_value_basis",
  GPS_VERIFICATION_RADIUS_METERS: "gps_verification_radius_meters",
} as const;

function toSummary(row: repo.SystemSettingRow): SystemSetting {
  return { key: row.key, value: row.value, updatedAt: row.updated_at.toISOString() };
}

export async function getSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const row = await repo.findByKey(key);
  return row ? (row.value as T) : fallback;
}

export async function isOtpMandatoryForOutletCreation(): Promise<boolean> {
  return getSetting<boolean>(SETTING_KEYS.OTP_MANDATORY_FOR_OUTLET_CREATION, true);
}

export async function listSettings(): Promise<SystemSetting[]> {
  const rows = await repo.list();
  return rows.map(toSummary);
}

export async function updateSetting(key: string, value: unknown, updatedByEmployeeId: string): Promise<SystemSetting> {
  const row = await repo.upsert(key, value, updatedByEmployeeId);
  return toSummary(row);
}
