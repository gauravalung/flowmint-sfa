import { useEffect, useState } from "react";
import type { RetailerCategory, RetailerSubcategory, RetailerSummary } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../auth/AuthContext";

const PAGE_SIZE = 20;

export default function RetailersPage() {
  const [retailers, setRetailers] = useState<RetailerSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<RetailerCategory | "">("");
  const [subcategories, setSubcategories] = useState<RetailerSubcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set("search", search.trim());
      if (categoryFilter) params.set("category", categoryFilter);
      const result = await authedRequest<{ retailers: RetailerSummary[]; total: number }>(
        "get",
        `/admin/retailers?${params.toString()}`
      );
      setRetailers(result.retailers);
      setTotal(result.total);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not load retailers.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, categoryFilter]);

  useEffect(() => {
    authedRequest<{ subcategories: RetailerSubcategory[] }>("get", "/retailer-subcategories?activeOnly=true")
      .then((r) => setSubcategories(r.subcategories))
      .catch(() => {});
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const toggleStatus = async (retailer: RetailerSummary) => {
    const nextActive = !retailer.isActive;
    const reason = window.prompt(`${nextActive ? "Reactivate" : "Deactivate"} "${retailer.name}". Optional reason:`, "");
    if (reason === null) return;
    try {
      await authedRequest("patch", `/admin/retailers/${retailer.id}/status`, {
        isActive: nextActive,
        reason: reason || undefined,
      });
      await load();
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not update status.");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="page-header">
        <h1>Retailers</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New Retailer"}
        </button>
      </div>

      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}

      {showForm ? (
        <CreateRetailerForm
          subcategories={subcategories}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setErrorMessage}
        />
      ) : null}

      <form className="toolbar" onSubmit={handleSearchSubmit}>
        <input placeholder="Search name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as RetailerCategory | "")}>
          <option value="">All categories</option>
          <option value="RETAIL">Retail</option>
          <option value="WHOLESALE">Wholesale</option>
        </select>
        <button type="submit" className="btn btn-sm">
          Search
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
                <th>Category</th>
                <th>Subcategory</th>
                <th>City</th>
                <th>Phone</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {retailers.map((r) => (
                <tr key={r.id}>
                  <td>{r.code}</td>
                  <td>{r.name}</td>
                  <td>{r.category}</td>
                  <td>{r.subcategoryName ?? "—"}</td>
                  <td>{r.city ?? "—"}</td>
                  <td>{r.phone ?? "—"}</td>
                  <td>
                    <span className={`badge ${r.isActive ? "badge-active" : "badge-inactive"}`}>
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => toggleStatus(r)}>
                      {r.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
              {retailers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted" style={{ padding: 16 }}>
                    No retailers found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {total > PAGE_SIZE ? (
        <div className="toolbar">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="muted">
            Page {page} of {totalPages} ({total} total)
          </span>
          <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CreateRetailerForm({
  subcategories,
  onCreated,
  onError,
}: {
  subcategories: RetailerSubcategory[];
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [category, setCategory] = useState<RetailerCategory>("RETAIL");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await authedRequest("post", "/admin/retailers", {
        code: code.trim() || undefined,
        name: name.trim(),
        ownerName: ownerName.trim() || undefined,
        category,
        subcategoryId: subcategoryId || undefined,
        addressLine: addressLine.trim() || undefined,
        city: city.trim() || undefined,
        pincode: pincode.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiRequestError ? err.message : "Could not create retailer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-field">
          <label>Code (leave blank to auto-generate)</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="RETnnnnn" />
        </div>
        <div className="form-field">
          <label>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>Owner name</label>
          <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Category *</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as RetailerCategory)}>
            <option value="RETAIL">Retail</option>
            <option value="WHOLESALE">Wholesale</option>
          </select>
        </div>
        <div className="form-field">
          <label>Subcategory</label>
          <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
            <option value="">—</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={10} />
        </div>
        <div className="form-field">
          <label>Address</label>
          <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
        </div>
        <div className="form-field">
          <label>City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Pincode</label>
          <input value={pincode} onChange={(e) => setPincode(e.target.value)} maxLength={6} />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create"}
        </button>
      </div>
    </form>
  );
}
