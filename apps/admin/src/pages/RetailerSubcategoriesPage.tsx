import { useEffect, useState } from "react";
import type { RetailerSubcategory } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../auth/AuthContext";

// Admin-defined, extensible list (spec §5) — the real list is still
// pending from Cuni; this screen is exactly what lets admin add to /
// retire the placeholder seed without a code change.
export default function RetailerSubcategoriesPage() {
  const [subcategories, setSubcategories] = useState<RetailerSubcategory[]>([]);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await authedRequest<{ subcategories: RetailerSubcategory[] }>("get", "/retailer-subcategories");
      setSubcategories(result.subcategories);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not load subcategories.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await authedRequest("post", "/retailer-subcategories", { name: name.trim() });
      setName("");
      await load();
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not create subcategory.");
    }
  };

  const toggleStatus = async (sub: RetailerSubcategory) => {
    try {
      await authedRequest("patch", `/retailer-subcategories/${sub.id}/status`, { isActive: !sub.isActive });
      await load();
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not update status.");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Retailer Subcategories</h1>
      </div>

      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}

      <form className="card" onSubmit={handleCreate} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div className="form-field" style={{ flex: 1 }}>
          <label>New subcategory name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chemist Store" />
        </div>
        <button type="submit" className="btn btn-primary">
          Add
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
                <th>Name</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subcategories.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>
                    <span className={`badge ${s.isActive ? "badge-active" : "badge-inactive"}`}>
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => toggleStatus(s)}>
                      {s.isActive ? "Deactivate" : "Reactivate"}
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
