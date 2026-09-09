import { useEffect, useState } from "react";
import type { StatusChangeLogEntry, StatusEntityType } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../auth/AuthContext";

export default function StatusHistoryPage() {
  const [entries, setEntries] = useState<StatusChangeLogEntry[]>([]);
  const [entityType, setEntityType] = useState<StatusEntityType | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const query = entityType ? `?entityType=${entityType}` : "";
      const result = await authedRequest<{ changes: StatusChangeLogEntry[] }>("get", `/admin/status-log${query}`);
      setEntries(result.changes);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not load status history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  return (
    <div>
      <div className="page-header">
        <h1>Status History</h1>
      </div>
      <p className="muted">Every activation/deactivation of a distribution partner or retailer, timestamped (spec §4).</p>

      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}

      <div className="toolbar">
        <select value={entityType} onChange={(e) => setEntityType(e.target.value as StatusEntityType | "")}>
          <option value="">All entity types</option>
          <option value="DISTRIBUTION_PARTNER">Distribution Partner</option>
          <option value="RETAILER">Retailer</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {isLoading ? (
          <p className="muted" style={{ padding: 20 }}>
            Loading…
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Entity type</th>
                <th>Entity ID</th>
                <th>Change</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.changedAt).toLocaleString()}</td>
                  <td>{e.entityType}</td>
                  <td>
                    <code>{e.entityId.slice(0, 8)}…</code>
                  </td>
                  <td>
                    {e.previousStatus ? "Active" : "Inactive"} → {e.newStatus ? "Active" : "Inactive"}
                  </td>
                  <td>{e.reason ?? "—"}</td>
                </tr>
              ))}
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: 16 }}>
                    No status changes recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
