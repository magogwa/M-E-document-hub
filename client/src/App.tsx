import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { RequireAuth, RequireRole } from './lib/guards';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AdminDashboardPage } from './pages/admin/DashboardPage';
import { AdminDocumentsPage } from './pages/admin/DocumentsPage';
import { UploadDocumentPage } from './pages/admin/UploadDocumentPage';
import { AdminDocumentDetailPage } from './pages/admin/DocumentDetailPage';
import { AdminCategoriesPage } from './pages/admin/CategoriesPage';
import { AdminClientsPage } from './pages/admin/ClientsPage';
import { AdminAccessManagementPage } from './pages/admin/AccessManagementPage';
import { AdminActivityLogsPage } from './pages/admin/ActivityLogsPage';
import { AdminSettingsPage } from './pages/admin/SettingsPage';
import { ClientDashboardPage } from './pages/client/DashboardPage';
import { ClientMyDocumentsPage } from './pages/client/MyDocumentsPage';
import { ClientCategoriesPage } from './pages/client/CategoriesPage';
import { ClientRecentDocumentsPage } from './pages/client/RecentDocumentsPage';
import { ClientUploadPage } from './pages/client/UploadDocumentPage';
import { ChatPage } from './pages/ChatPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';

function RedirectHome() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to={user.role === 'admin' ? '/admin' : '/client'} replace /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectHome />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireAuth />}>
            <Route element={<RequireRole role="admin" />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/documents" element={<AdminDocumentsPage />} />
              <Route path="/admin/documents/:id" element={<AdminDocumentDetailPage />} />
              <Route path="/admin/upload" element={<UploadDocumentPage />} />
              <Route path="/admin/categories" element={<AdminCategoriesPage />} />
              <Route path="/admin/clients" element={<AdminClientsPage />} />
              <Route path="/admin/access" element={<AdminAccessManagementPage />} />
              <Route path="/admin/activity" element={<AdminActivityLogsPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
              <Route path="/admin/chat" element={<ChatPage role="admin" />} />
              <Route path="/notifications" element={<NotificationsPage role="admin" />} />
            </Route>

            <Route element={<RequireRole role="client" />}>
              <Route path="/client" element={<ClientDashboardPage />} />
              <Route path="/client/documents" element={<ClientMyDocumentsPage />} />
              <Route path="/client/upload" element={<ClientUploadPage />} />
              <Route path="/client/recent" element={<ClientRecentDocumentsPage />} />
              <Route path="/client/categories" element={<ClientCategoriesPage />} />
              <Route path="/client/chat" element={<ChatPage role="client" />} />
              <Route path="/notifications" element={<NotificationsPage role="client" />} />
            </Route>

            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<RedirectHome />} />
      </Routes>
  );
}