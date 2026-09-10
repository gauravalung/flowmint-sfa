import { useEffect, useMemo, useState } from "react";
import type { DistributionPartnerSummary, BeatSummary, RetailerSummary, EmployeePublic } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../auth/AuthContext";

interface Option {
  id: string;
  label: string;
}

interface MappingRow {
  mapping_id: string;
  is_active: boolean;
  id: string;
  code: string;
  name: string;
  sequence_no?: number;
  day_of_week?: number | null;
  partner_type?: string;
}

interface TabConfig {
  key: string;
  label: string;
  leftLabel: string;
  leftQueryParam: string;
  rightLabel: string;
  extraField?: { name: string; label: string; type: "number" | "day"; placeholder?: string };
}

const TABS: TabConfig[] = [
  { key: "distribution-partner-beat", label: "Distributor ↔ Beat", leftLabel: "Distribution Partner", leftQueryParam: "distributionPartnerId", rightLabel: "Beat" },
  { key: "beat-retailer", label: "Beat ↔ Retailer", leftLabel: "Beat", leftQueryParam: "beatId", rightLabel: "Retailer", extraField: { name: "sequenceNo", label: "Sequence #", type: "number" } },
  { key: "retailer-distribution-partner", label: "Retailer ↔ Distributor", leftLabel: "Retailer", leftQueryParam: "retailerId", rightLabel: "Distribution Partner" },
  { key: "employee-distribution-partner", label: "Salesman ↔ Distributor", leftLabel: "Employee", leftQueryParam: "employeeId", rightLabel: "Distribution Partner" },
  { key: "employee-beat", label: "Salesman ↔ Beat", leftLabel: "Employee", leftQueryParam: "employeeId", rightLabel: "Beat", extraField: { name: "dayOfWeek", label: "Default day of week (optional)", type: "day" } },
  { key: "employee-retailer", label: "Salesman ↔ Retailer", leftLabel: "Employee", leftQueryParam: "employeeId", rightLabel: "Retailer" },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Which entity list backs each side of a given tab, and the body field name
// the mapping POST expects for the right-hand id.
function entityKindForTab(tab: TabConfig): { left: EntityKind; right: EntityKind; rightBodyField: string; leftBodyField: string } {
  switch (tab.key) {
    case "distribution-partner-beat":
      return { left: "distributionPartner", right: "beat", leftBodyField: "distributionPartnerId", rightBodyField: "beatId" };
    case "beat-retailer":
      return { left: "beat", right: "retailer", leftBodyField: "beatId", rightBodyField: "retailerId" };
    case "retailer-distribution-partner":
      return { left: "retailer", right: "distributionPartner", leftBodyField: "retailerId", rightBodyField: "distributionPartnerId" };
    case "employee-distribution-partner":
      return { left: "employee", right: "distributionPartner", leftBodyField: "employeeId", rightBodyField: "distributionPartnerId" };
    case "employee-beat":
      return { left: "employee", right: "beat", leftBodyField: "employeeId", rightBodyField: "beatId" };
    case "employee-retailer":
    default:
      return { left: "employee", right: "retailer", leftBodyField: "employeeId", rightBodyField: "retailerId" };
  }
}

type EntityKind = "distributionPartner" | "beat" | "retailer" | "employee";

export default function MappingsPage() {
  const [activeTab, setActiveTab] = useState<TabConfig>(TABS[0]);
  const [distributionPartners, setDistributionPartners] = useState<Option[]>([]);
  const [beats, setBeats] = useState<Option[]>([]);
  const [retailers, setRetailers] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);

  useEffect(() => {
    authedRequest<{ partners: DistributionPartnerSummary[] }>("get", "/admin/distribution-partners?isActive=true")
      .then((r) => setDistributionPartners(r.partners.map((p) => ({ id: p.id, label: `${p.name} (${p.code})` }))))
      .catch(() => {});
    authedRequest<{ beats: BeatSummary[] }>("get", "/admin/beats?isActive=true")
      .then((r) => setBeats(r.beats.map((b) => ({ id: b.id, label: `${b.name} (${b.code})` }))))
      .catch(() => {});
    authedRequest<{ retailers: RetailerSummary[]; total: number }>("get", "/admin/retailers?isActive=true&pageSize=200")
      .then((r) => setRetailers(r.retailers.map((x) => ({ id: x.id, label: `${x.name} (${x.code})` }))))
      .catch(() => {});
    authedRequest<{ employees: EmployeePublic[] }>("get", "/admin/employees?isActive=true")
      .then((r) => setEmployees(r.employees.map((e) => ({ id: e.id, label: `${e.name} (${e.employeeCode})` }))))
      .catch(() => {});
  }, []);

  const optionsFor = (kind: EntityKind): Option[] => {
    switch (kind) {
      case "distributionPartner":
        return distributionPartners;
      case "beat":
        return beats;
      case "retailer":
        return retailers;
      case "employee":
        return employees;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Mappings</h1>
      </div>
      <p className="muted">
        Every relationship below is admin-owned and removed one link at a time — deleting one mapping never
        touches any other mapping for the same entity (spec §6).
      </p>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={t.key === activeTab.key ? "active" : ""} onClick={() => setActiveTab(t)}>
            {t.label}
          </button>
        ))}
      </div>

      <MappingTabPanel key={activeTab.key} tab={activeTab} optionsFor={optionsFor} />
    </div>
  );
}

function MappingTabPanel({ tab, optionsFor }: { tab: TabConfig; optionsFor: (kind: EntityKind) => Option[] }) {
  const kinds = useMemo(() => entityKindForTab(tab), [tab]);
  const leftOptions = optionsFor(kinds.left);
  const rightOptions = optionsFor(kinds.right);

  const [leftId, setLeftId] = useState("");
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [rightId, setRightId] = useState("");
  const [extraValue, setExtraValue] = useState("");

  const load = async (id: string) => {
    if (!id) {
      setRows([]);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await authedRequest<{ mappings: MappingRow[] }>(
        "get",
        `/admin/mappings/${tab.key}?${tab.leftQueryParam}=${id}`
      );
      setRows(result.mappings);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not load mappings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setLeftId("");
    setRows([]);
    setRightId("");
    setExtraValue("");
    setErrorMessage(null);
  }, [tab.key]);

  useEffect(() => {
    load(leftId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leftId || !rightId) return;
    const body: Record<string, unknown> = {
      [kinds.leftBodyField]: leftId,
      [kinds.rightBodyField]: rightId,
    };
    if (tab.extraField && extraValue !== "") {
      body[tab.extraField.name] = Number(extraValue);
    }
    try {
      await authedRequest("post", `/admin/mappings/${tab.key}`, body);
      setRightId("");
      setExtraValue("");
      await load(leftId);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not create mapping.");
    }
  };

  const handleRemove = async (mappingId: string) => {
    if (!window.confirm("Remove this mapping? Other mappings for this entity are unaffected.")) return;
    try {
      await authedRequest("delete", `/admin/mappings/${tab.key}/${mappingId}`);
      await load(leftId);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not remove mapping.");
    }
  };

  const alreadyMappedIds = new Set(rows.map((r) => r.id));
  const availableRightOptions = rightOptions.filter((o) => !alreadyMappedIds.has(o.id));

  return (
    <div>
      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}

      <div className="toolbar">
        <div className="form-field" style={{ minWidth: 260 }}>
          <label>{tab.leftLabel}</label>
          <select value={leftId} onChange={(e) => setLeftId(e.target.value)}>
            <option value="">Select {tab.leftLabel.toLowerCase()}…</option>
            {leftOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {leftId ? (
        <>
          <form className="card" onSubmit={handleAdd} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="form-field" style={{ minWidth: 260 }}>
              <label>Add {tab.rightLabel}</label>
              <select value={rightId} onChange={(e) => setRightId(e.target.value)}>
                <option value="">Select {tab.rightLabel.toLowerCase()}…</option>
                {availableRightOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {tab.extraField ? (
              <div className="form-field">
                <label>{tab.extraField.label}</label>
                {tab.extraField.type === "day" ? (
                  <select value={extraValue} onChange={(e) => setExtraValue(e.target.value)}>
                    <option value="">—</option>
                    {DAY_NAMES.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={1}
                    value={extraValue}
                    onChange={(e) => setExtraValue(e.target.value)}
                    placeholder={tab.extraField.placeholder}
                  />
                )}
              </div>
            ) : null}
            <button type="submit" className="btn btn-primary" disabled={!rightId}>
              Add mapping
            </button>
          </form>

          <div className="card" style={{ padding: 0 }}>
            {isLoading ? (
              <p className="muted" style={{ padding: 20 }}>
                Loading…
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{tab.rightLabel}</th>
                    {tab.key === "beat-retailer" ? <th>Sequence</th> : null}
                    {tab.key === "employee-beat" ? <th>Default day</th> : null}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.mapping_id}>
                      <td>
                        {r.name} ({r.code}
                        {r.partner_type ? `, ${r.partner_type}` : ""})
                      </td>
                      {tab.key === "beat-retailer" ? <td>{r.sequence_no}</td> : null}
                      {tab.key === "employee-beat" ? (
                        <td>{r.day_of_week !== undefined && r.day_of_week !== null ? DAY_NAMES[r.day_of_week] : "—"}</td>
                      ) : null}
                      <td>
                        <button className="btn btn-sm btn-danger" onClick={() => handleRemove(r.mapping_id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="muted" style={{ padding: 16 }}>
                        No mappings yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <p className="muted">Select a {tab.leftLabel.toLowerCase()} above to view and manage its mappings.</p>
      )}
    </div>
  );
}
