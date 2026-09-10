import { useEffect, useState } from "react";
import type { SystemSetting } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../auth/AuthContext";

const KNOWN_KEYS = {
  OTP_MANDATORY: "otp_mandatory_for_outlet_creation",
  DASHBOARD_BASIS: "dashboard_order_value_basis",
  GPS_RADIUS: "gps_verification_radius_meters",
} as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await authedRequest<{ settings: SystemSetting[] }>("get", "/admin/settings");
      setSettings(result.settings);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not load settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (key: string, value: unknown) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await authedRequest("put", `/admin/settings/${key}`, { value });
      setSuccessMessage(`Saved ${key}.`);
      await load();
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not save setting.");
    }
  };

  const getValue = (key: string) => settings.find((s) => s.key === key)?.value;

  if (isLoading) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}
      {successMessage ? <div className="alert alert-success">{successMessage}</div> : null}

      <div className="card">
        <div className="form-field" style={{ marginBottom: 18 }}>
          <label>OTP mandatory for new outlet creation (spec §8.4)</label>
          <p className="muted" style={{ margin: "0 0 8px" }}>
            When off, a salesman can create a new outlet without verifying its phone via OTP.
          </p>
          <select
            value={String(getValue(KNOWN_KEYS.OTP_MANDATORY) ?? true)}
            onChange={(e) => save(KNOWN_KEYS.OTP_MANDATORY, e.target.value === "true")}
          >
            <option value="true">Mandatory</option>
            <option value="false">Optional</option>
          </select>
        </div>

        <div className="form-field" style={{ marginBottom: 18 }}>
          <label>Dashboard order value basis (spec §10)</label>
          <p className="muted" style={{ margin: "0 0 8px" }}>
            Whether order values on dashboards show MRP or base (pretax, pre-discount) price. Global for Phase 1.
          </p>
          <select
            value={String(getValue(KNOWN_KEYS.DASHBOARD_BASIS) ?? "MRP")}
            onChange={(e) => save(KNOWN_KEYS.DASHBOARD_BASIS, e.target.value)}
          >
            <option value="MRP">MRP</option>
            <option value="BASE">Base price</option>
          </select>
        </div>

        <div className="form-field">
          <label>GPS verification radius, meters (spec §8.3)</label>
          <p className="muted" style={{ margin: "0 0 8px" }}>
            How close a salesman's GPS must be to a beat outlet to start working hours.
          </p>
          <input
            type="number"
            min={10}
            style={{ width: 140 }}
            defaultValue={Number(getValue(KNOWN_KEYS.GPS_RADIUS) ?? 200)}
            onBlur={(e) => save(KNOWN_KEYS.GPS_RADIUS, Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
