import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/distribution-partners", label: "Distribution Partners" },
  { to: "/retailers", label: "Retailers" },
  { to: "/retailer-subcategories", label: "Retailer Subcategories" },
  { to: "/beats", label: "Beats" },
  { to: "/mappings", label: "Mappings" },
  { to: "/employees", label: "Employees" },
  { to: "/products", label: "Products & Inventory" },
  { to: "/bulk-upload", label: "Bulk Upload" },
  { to: "/status-history", label: "Status History" },
  { to: "/settings", label: "Settings" },
];

export default function AppLayout() {
  const { employee, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Flowmint Admin</div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div>{employee?.name}</div>
          <div className="muted">{employee?.employeeCode}</div>
          <button className="btn btn-sm" style={{ marginTop: 10, width: "100%" }} onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
