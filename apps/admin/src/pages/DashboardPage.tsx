import { useAuth } from "../auth/AuthContext";

// Placeholder landing page. The real per-user downline dashboard (spec §10
// — login/logout times, live GPS, outlets visited, orders taken, MTD vs.
// daily toggle) is a later slice; this app is the admin portal shell, not
// that dashboard.
export default function DashboardPage() {
  const { employee } = useAuth();

  return (
    <div>
      <div className="page-header">
        <h1>Welcome{employee ? `, ${employee.name}` : ""}</h1>
      </div>
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          Use the sidebar to manage distribution partners, retailers, beats, mappings, employees, the
          product catalog, bulk uploads, and system settings.
        </p>
      </div>
    </div>
  );
}
