import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import AppLayout from "./layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DistributionPartnersPage from "./pages/DistributionPartnersPage";
import RetailersPage from "./pages/RetailersPage";
import RetailerSubcategoriesPage from "./pages/RetailerSubcategoriesPage";
import BeatsPage from "./pages/BeatsPage";
import MappingsPage from "./pages/MappingsPage";
import EmployeesPage from "./pages/EmployeesPage";
import ProductsPage from "./pages/ProductsPage";
import BulkUploadPage from "./pages/BulkUploadPage";
import SettingsPage from "./pages/SettingsPage";
import StatusHistoryPage from "./pages/StatusHistoryPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="distribution-partners" element={<DistributionPartnersPage />} />
            <Route path="retailers" element={<RetailersPage />} />
            <Route path="retailer-subcategories" element={<RetailerSubcategoriesPage />} />
            <Route path="beats" element={<BeatsPage />} />
            <Route path="mappings" element={<MappingsPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="bulk-upload" element={<BulkUploadPage />} />
            <Route path="status-history" element={<StatusHistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
