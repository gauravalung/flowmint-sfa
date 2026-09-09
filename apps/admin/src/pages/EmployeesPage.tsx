import { useEffect, useState } from "react";
import type { EmployeePublic, EmployeeRole } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../auth/AuthContext";

const ROLES: EmployeeRole[] = ["SALES_OFFICER", "ISR", "ASE", "ASM", "RSM", "COUNTRY_HEAD", "ADMIN"];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeePublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [lastTempPassword, setLastTempPassword] = useState<{ employeeCode: string; password: string } | null>(null);

  const load = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await authedRequest<{ employees: EmployeePublic[] }>("get", "/admin/employees");
      setEmployees(result.employees);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not load employees.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const employeeById = new Map(employees.map((e) => [e.id, e]));

  return (
    <div>
      <div className="page-header">
        <h1>Employees</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm((v) => !v);
            setLastTempPassword(null);
          }}
        >
          {showForm ? "Cancel" : "+ New Employee"}
        </button>
      </div>

      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}

      {lastTempPassword ? (
        <div className="alert alert-success">
          Created <strong>{lastTempPassword.employeeCode}</strong>. Temporary password (shown once, not
          recoverable — hand it to the employee directly):{" "}
          <code style={{ userSelect: "all" }}>{lastTempPassword.password}</code>
        </div>
      ) : null}

      {showForm ? (
        <CreateEmployeeForm
          employees={employees}
          onCreated={(employeeCode, password) => {
            setShowForm(false);
            setLastTempPassword({ employeeCode, password });
            load();
          }}
          onError={setErrorMessage}
        />
      ) : null}

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
                <th>Phone</th>
                <th>Role</th>
                <th>Reports to</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>{e.employeeCode}</td>
                  <td>{e.name}</td>
                  <td>{e.phone}</td>
                  <td>{e.role}</td>
                  <td>{e.reportingManagerId ? employeeById.get(e.reportingManagerId)?.name ?? "—" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CreateEmployeeForm({
  employees,
  onCreated,
  onError,
}: {
  employees: EmployeePublic[];
  onCreated: (employeeCode: string, password: string) => void;
  onError: (message: string) => void;
}) {
  const [employeeCode, setEmployeeCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<EmployeeRole>("SALES_OFFICER");
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await authedRequest<EmployeePublic & { temporaryPassword: string }>("post", "/admin/employees", {
        employeeCode: employeeCode.trim(),
        name: name.trim(),
        phone: phone.trim(),
        role,
        reportingManagerId: reportingManagerId || undefined,
      });
      onCreated(result.employeeCode, result.temporaryPassword);
    } catch (err) {
      onError(err instanceof ApiRequestError ? err.message : "Could not create employee.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-field">
          <label>Employee code *</label>
          <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} required placeholder="e.g. ASM002" />
        </div>
        <div className="form-field">
          <label>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>Phone *</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={10} />
        </div>
        <div className="form-field">
          <label>Role *</label>
          <select value={role} onChange={(e) => setRole(e.target.value as EmployeeRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Reporting manager</label>
          <select value={reportingManagerId} onChange={(e) => setReportingManagerId(e.target.value)}>
            <option value="">—</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.employeeCode}, {e.role})
              </option>
            ))}
          </select>
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
