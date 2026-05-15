import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ImpersonationProvider } from "./auth/ImpersonationContext";
import { AppFilterProvider } from "./context/AppFilterContext";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute }   from "./router/ProtectedRoute";
import { PermissionRoute }  from "./router/PermissionRoute";
import { BacklogPage } from "./screens/backlog/BacklogPage";
import { KanbanPageWithBoundary as KanbanPage } from "./screens/kanban/KanbanPage";
import { AccessDenied } from "./screens/AccessDenied";
import { DashboardPage } from "./screens/dashboard/DashboardPage";
import { ProjectsPage } from "./screens/projects/ProjectsPage";
import { RoadmapPage } from "./screens/roadmap/RoadmapPage";
import { GanttPage } from "./screens/gantt/GanttPage";
import { AdminSettingsPage } from "./screens/admin/AdminSettingsPage";
import { AdminPermissionsPage } from "./screens/admin/AdminPermissionsPage";
import { StateMachinePage } from "./screens/admin/StateMachinePage";
import { UsersPage } from "./screens/admin/users/UsersPage";
import { ProvidersPage } from "./screens/admin/providers/ProvidersPage";
import { AdminTeamsPage } from "./screens/admin/teams/AdminTeamsPage";
import { ActivityPage }  from "./screens/activity/ActivityPage";
import { EvidencesPage } from "./screens/evidences/EvidencesPage";
import { ReportsPage }   from "./screens/reports/ReportsPage";
import { RisksPage }     from "./screens/risks/RisksPage";
import { AuditPage }     from "./screens/audit/AuditPage";
import { RequestsPage }  from "./screens/requests/RequestsPage";

const Stub: React.FC<{ title: string; optional?: boolean }> = ({ title, optional }) => (
  <div style={{ padding: "28px 32px", fontFamily: "'Segoe UI', sans-serif" }}>
    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#201F1E", margin: "0 0 6px" }}>{title}</h2>
    <p style={{ fontSize: 13, color: "#605E5C" }}>
      {optional ? "Pantalla opcional — en roadmap." : "En desarrollo."}
    </p>
  </div>
);

// Bridge: lee el usuario real de AuthContext y envuelve con ImpersonationProvider.
const AppWithImpersonation: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appUser } = useAuth();
  return (
    <ImpersonationProvider realUser={appUser}>
      {children}
    </ImpersonationProvider>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <AppWithImpersonation>
    <AppFilterProvider>
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* ── PLANIFICACIÓN ── */}
          <Route path="/dashboard" element={
            <PermissionRoute permissionKey="VIEW_DASHBOARD"><DashboardPage /></PermissionRoute>
          } />
          <Route path="/projects" element={
            <PermissionRoute permissionKey="VIEW_PROJECTS"><ProjectsPage /></PermissionRoute>
          } />
          <Route path="/projects/:id" element={<Stub title="Detalle del proyecto" />} />
          <Route path="/roadmap" element={
            <PermissionRoute permissionKey="VIEW_ROADMAP"><RoadmapPage /></PermissionRoute>
          } />
          <Route path="/gantt" element={
            <PermissionRoute permissionKey="VIEW_GANTT"><GanttPage /></PermissionRoute>
          } />

          {/* ── EJECUCIÓN ── */}
          <Route path="/requests" element={
            <PermissionRoute permissionKey="VIEW_REQUESTS"><RequestsPage /></PermissionRoute>
          } />
          <Route path="/backlog" element={
            <PermissionRoute permissionKey="VIEW_BACKLOG"><BacklogPage /></PermissionRoute>
          } />
          <Route path="/kanban" element={
            <PermissionRoute permissionKey="VIEW_KANBAN"><KanbanPage /></PermissionRoute>
          } />
          <Route path="/activity" element={
            <PermissionRoute permissionKey="VIEW_ACTIVITY"><ActivityPage /></PermissionRoute>
          } />
          <Route path="/evidences" element={
            <PermissionRoute permissionKey="VIEW_EVIDENCES"><EvidencesPage /></PermissionRoute>
          } />

          {/* ── GOBIERNO ── */}
          <Route path="/reports" element={
            <PermissionRoute permissionKey="VIEW_REPORTS"><ReportsPage /></PermissionRoute>
          } />
          <Route path="/risks" element={
            <PermissionRoute permissionKey="VIEW_RISKS"><RisksPage /></PermissionRoute>
          } />
          <Route path="/audit" element={
            <PermissionRoute permissionKey="VIEW_AUDIT"><AuditPage /></PermissionRoute>
          } />

          {/* ── ADMINISTRACIÓN: Admin only ── */}
          <Route path="/admin"             element={<ProtectedRoute requiredRoles={["Admin"]}><Stub title="Administración" /></ProtectedRoute>} />
          <Route path="/admin/users"       element={<ProtectedRoute requiredRoles={["Admin"]}><UsersPage /></ProtectedRoute>} />
          <Route path="/admin/providers"   element={<ProtectedRoute requiredRoles={["Admin"]}><ProvidersPage /></ProtectedRoute>} />
          <Route path="/admin/teams"       element={<ProtectedRoute requiredRoles={["Admin"]}><AdminTeamsPage /></ProtectedRoute>} />
          <Route path="/admin/settings"      element={<ProtectedRoute requiredRoles={["Admin"]}><AdminSettingsPage /></ProtectedRoute>} />
          <Route path="/admin/permissions"   element={<ProtectedRoute requiredRoles={["Admin"]}><AdminPermissionsPage /></ProtectedRoute>} />
          <Route path="/admin/state-machine" element={<ProtectedRoute requiredRoles={["Admin"]}><StateMachinePage /></ProtectedRoute>} />

          <Route path="/access-denied" element={<AccessDenied />} />
          <Route path="*"              element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
    </AppFilterProvider>
    </AppWithImpersonation>
  </AuthProvider>
);

export default App;


