import { useEffect, useState } from "react";
import type { DistributionPartnerSummary, DistributionPartnerType } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../auth/AuthContext";

const PARTNER_TYPES: DistributionPartnerType[] = ["SUPER_DISTRIBUTOR", "DIRECT_DISTRIBUTOR", "SUB_DISTRIBUTOR"];

function partnerTypeLabel(type: DistributionPartnerType): string {
  return { SUPER_DISTRIBUTOR: "Super Distributor", DIRECT_DISTRIBUTOR: "Direct Distributor", SUB_DISTRIBUTOR: "Sub Distributor" }[
    type
  ];
}

export default function DistributionPartnersPage() {
  const [partners, setPartners] = useState<DistributionPartnerSummary[]>([]);
  const [typeFilter, setTypeFilter] = useState<DistributionPartnerType | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const query = typeFilter ? `?partnerType=${typeFilter}` : "";
      const result = await authedRequest<{ partners: DistributionPartnerSummary[] }>(
        "get",
        `/admin/distribution-partners${query}`
      );
      setPartners(result.partners);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not load distribution partners.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const superDistributors = partners.filter((p) => p.partnerType === "SUPER_DISTRIBUTOR" && p.isActive);
  const partnersById = new Map(partners.map((p) => [p.id, p]));

  const toggleStatus = async (partner: DistributionPartnerSummary) => {
    const nextActive = !partner.isActive;
    const reason = window.prompt(
      `${nextActive ? "Reactivate" : "Deactivate"} "${partner.name}". Optional reason:`,
      ""
    );
    if (reason === null) return; // cancelled
    try {
      await authedRequest("patch", `/admin/distribution-partners/${partner.id}/status`, {
        isActive: nextActive,
        reason: reason || undefined,
      });
      await load();
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not update status.");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Distribution Partners</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New Partner"}
        </button>
      </div>

      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}

      {showForm ? (
        <CreatePartnerForm
          superDistributors={superDistributors}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setErrorMessage}
        />
      ) : null}

      <div className="toolbar">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as DistributionPartnerType | "")}>
          <option value="">All types</option>
          {PARTNER_TYPES.map((t) => (
            <option key={t} value={t}>
              {partnerTypeLabel(t)}
            </option>
          ))}
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
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Billed by</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id}>
                  <td>{p.code}</td>
                  <td>{p.name}</td>
                  <td>{partnerTypeLabel(p.partnerType)}</td>
                  <td>{p.billedBy === "COMPANY" ? "Company" : partnersById.get(p.billedBy)?.name ?? "Parent Super Distributor"}</td>
                  <td>
                    <span className={`badge ${p.isActive ? "badge-active" : "badge-inactive"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => toggleStatus(p)}>
                      {p.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 16 }}>
                    No distribution partners yet.
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

function CreatePartnerForm({
  superDistributors,
  onCreated,
  onError,
}: {
  superDistributors: DistributionPartnerSummary[];
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const [partnerType, setPartnerType] = useState<DistributionPartnerType>("DIRECT_DISTRIBUTOR");
  const [code, setCode] = useState("");
  const [parentPartnerId, setParentPartnerId] = useState("");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSub = partnerType === "SUB_DISTRIBUTOR";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await authedRequest("post", "/admin/distribution-partners", {
        partnerType,
        code: isSub ? undefined : code.trim(),
        parentPartnerId: isSub ? parentPartnerId : undefined,
        name: name.trim(),
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        addressLine: addressLine.trim() || undefined,
        city: city.trim() || undefined,
        pincode: pincode.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiRequestError ? err.message : "Could not create distribution partner.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-field">
          <label>Type *</label>
          <select value={partnerType} onChange={(e) => setPartnerType(e.target.value as DistributionPartnerType)}>
            {PARTNER_TYPES.map((t) => (
              <option key={t} value={t}>
                {partnerTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>

        {isSub ? (
          <div className="form-field">
            <label>Parent Super Distributor *</label>
            <select value={parentPartnerId} onChange={(e) => setParentPartnerId(e.target.value)} required>
              <option value="">Select…</option>
              {superDistributors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-field">
            <label>Code *</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="e.g. DIST-02" />
          </div>
        )}

        <div className="form-field">
          <label>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>Contact name</label>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Contact phone</label>
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} maxLength={10} />
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
