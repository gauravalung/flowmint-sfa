import { useEffect, useState } from "react";
import type { BeatSummary } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../auth/AuthContext";

export default function BeatsPage() {
  const [beats, setBeats] = useState<BeatSummary[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await authedRequest<{ beats: BeatSummary[] }>("get", "/admin/beats");
      setBeats(result.beats);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not load beats.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await authedRequest("post", "/admin/beats", { code: code.trim(), name: name.trim() });
      setCode("");
      setName("");
      await load();
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not create beat.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (beat: BeatSummary) => {
    try {
      await authedRequest("patch", `/admin/beats/${beat.id}/status`, { isActive: !beat.isActive });
      await load();
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not update status.");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Beats</h1>
      </div>

      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}

      <p className="muted">
        A beat can have at most 40 active retailers (spec §7) — mapped from the Mappings screen. Note: a beat's
        code is admin-assigned like a distributor's, not a sequential system-generated code.
      </p>

      <form className="card" onSubmit={handleCreate} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div className="form-field" style={{ flex: 1 }}>
          <label>Code *</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. BEAT-B" required />
        </div>
        <div className="form-field" style={{ flex: 2 }}>
          <label>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Beat B - Station Road" required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create"}
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
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {beats.map((b) => (
                <tr key={b.id}>
                  <td>{b.code}</td>
                  <td>{b.name}</td>
                  <td>
                    <span className={`badge ${b.isActive ? "badge-active" : "badge-inactive"}`}>
                      {b.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => toggleStatus(b)}>
                      {b.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
