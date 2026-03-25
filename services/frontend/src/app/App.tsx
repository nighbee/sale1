import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import { Toaster } from "sonner";
import { RegisterPage } from "@pages/Register";
import { LoginPage } from "@pages/Login";
import { CompanySetupPage } from "@pages/CompanySetup";
import { TeamCreationPage } from "../pages/TeamCreation";
import { ScriptUploadPage } from "../pages/ScriptUpload";
import { InviteMembersPage } from "../pages/InviteMembers";
import { DirectorDashboardPage } from "../pages/DirectorDashboard";
import { TeamsOverviewPage } from "../pages/TeamsOverview";
import { TeamDetailPage } from "../pages/TeamDetail";
import { UserDashboardPage } from "../pages/UserDashboard";
import { CompanySettingsPage } from "../pages/CompanySettings";
import { IntegrationsPage } from "../pages/Integrations";
import { LeaderboardPage } from "../pages/Leaderboard";
import { CallDetailPage } from "../pages/CallDetail";
import { CallsListPage } from "../pages/CallsList";
import { SuperAdminPage } from "../pages/SuperAdmin";
import { UsersManagementPage } from "../pages/UsersManagement";
import UserProfile from "../pages/UserProfile";
import { LandingPage } from "../pages/LandingPage";
import ProtectedRoute from "./providers/ProtectedRoute";
import "./styles/App.css";

function App() {
  return (
    <Router>
      <Toaster position="top-right" richColors />
      <Routes>
        {/* Public Routes */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route
          path="/company-setup"
          element={
            <ProtectedRoute>
              <CompanySetupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["tenant_admin", "super_admin"]}>
              <UsersManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team-creation"
          element={
            <ProtectedRoute>
              <TeamCreationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/script-upload"
          element={
            <ProtectedRoute>
              <ScriptUploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invite-members"
          element={
            <ProtectedRoute>
              <InviteMembersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <SuperAdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["tenant_admin"]}>
              <DirectorDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-dashboard"
          element={
            <ProtectedRoute allowedRoles={["sales_rep"]}>
              <UserDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams"
          element={
            <ProtectedRoute allowedRoles={["tenant_admin"]}>
              <TeamsOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams/:id"
          element={
            <ProtectedRoute allowedRoles={["tenant_admin"]}>
              <TeamDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={["tenant_admin", "super_admin"]}>
              <CompanySettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/integrations"
          element={
            <ProtectedRoute allowedRoles={["tenant_admin"]}>
              <IntegrationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calls"
          element={
            <ProtectedRoute>
              <CallsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calls/:id"
          element={
            <ProtectedRoute>
              <CallDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<LandingPage />} />
      </Routes>
    </Router>
  );
}

export default App;
