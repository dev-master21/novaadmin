import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import MainLayout from '@/components/Layout/MainLayout';
import Login from '@/modules/Auth/Login';
import Dashboard from '@/modules/Dashboard';
import PropertiesList from '@/modules/Properties/PropertiesList';
import PropertyForm from '@/modules/Properties/PropertyForm';
import PropertySearch from '@/modules/Properties/PropertySearch';
import UsersList from '@/modules/Users/UsersList';
import UserForm from '@/modules/Users/UserForm';
import RolesList from '@/modules/Roles/RolesList';
import RoleForm from '@/modules/Roles/RoleForm';
import FileManager from '@/modules/FileManager/FileManager';
import Profile from '../pages/Profile/Profile';
import OwnerLogin from '@/modules/OwnerPortal/OwnerLogin';
import OwnerDashboard from '@/modules/OwnerPortal/OwnerDashboard';
import OwnerPricingPage from '@/modules/OwnerPortal/OwnerPricingPage';
import OwnerCalendarPage from '@/modules/OwnerPortal/OwnerCalendarPage';

import Agreements from '@/modules/Agreements';
import AgreementDetail from '@/modules/Agreements/AgreementDetail';
import AgreementTemplates from '@/modules/Agreements/Templates';
import CreateTemplate from '@/modules/Agreements/Templates/CreateTemplate';
import TemplateDetail from '@/modules/Agreements/Templates/TemplateDetail';
import PublicAgreement from '@/modules/Agreements/Public/PublicAgreement';
import SignAgreement from '@/modules/Agreements/Public/SignAgreement';
import AgreementVerify from '@/modules/Agreements/Public/AgreementVerify';
import AgreementPrint from '@/modules/Agreements/AgreementPrint';

import FinancialDocuments from '@/modules/FinancialDocuments';
import InvoiceDetail from '@/modules/FinancialDocuments/InvoiceDetail';
import ReceiptDetail from '@/modules/FinancialDocuments/ReceiptDetail';
import InvoiceVerify from '@/modules/FinancialDocuments/Public/InvoiceVerify';
import ReceiptVerify from '@/modules/FinancialDocuments/Public/ReceiptVerify';
import ReservationConfirmationDetail from '@/modules/FinancialDocuments/ReservationConfirmationDetail';
import ConfirmationTemplates from '@/modules/FinancialDocuments/ConfirmationTemplates';

import { RequestsList } from '@/modules/Requests';
import ChatHistory from '@/modules/Requests/Public/ChatHistory';
import ClientRequest from '@/modules/Requests/Public/ClientRequest';

import BotSettings from '@/modules/BotSettings/BotSettings';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  requireSuperAdmin?: boolean;
}

const ProtectedRoute = ({ children, permission, requireSuperAdmin }: ProtectedRouteProps) => {
  const { isAuthenticated, hasPermission, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && !user?.is_super_admin) {
    return <Navigate to="/" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      {/* Публичные роуты */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      
      {/* Публичные страницы договоров */}
      <Route path="/agreement/:link" element={<PublicAgreement />} />
      <Route path="/sign/:link" element={<SignAgreement />} />
      <Route path="/agreement-print/:id" element={<AgreementPrint />} />
      <Route path="/agreement-verify/:verifyLink" element={<AgreementVerify />} />
      <Route path="/invoice-verify/:uuid" element={<InvoiceVerify />} />
      <Route path="/receipt-verify/:uuid" element={<ReceiptVerify />} />
      
      {/* Публичные роуты владельцев */}
      <Route path="/owner/:token" element={<OwnerLogin />} />
      <Route path="/owner/dashboard" element={<OwnerDashboard />} />
      <Route path="/owner/property/:propertyId/pricing" element={<OwnerPricingPage />} />
      <Route path="/owner/property/:propertyId/calendar" element={<OwnerCalendarPage />} />
      
      {/* Публичные страницы заявок */}
      <Route path="/request/chat/:chatUuid" element={<ChatHistory />} />
      <Route path="/request/client/:uuid" element={<ClientRequest />} />

      {/* Защищенные роуты */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />

        {/* Объекты */}
        <Route path="properties">
          <Route
            index
            element={
              <ProtectedRoute permission="properties.read">
                <PropertiesList />
              </ProtectedRoute>
            }
          />
          <Route
            path="search"
            element={
              <ProtectedRoute permission="properties.read">
                <PropertySearch />
              </ProtectedRoute>
            }
          />
          <Route
            path="create"
            element={
              <ProtectedRoute permission="properties.create">
                <PropertyForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="view/:id"
            element={
              <ProtectedRoute permission="properties.read">
                <PropertyForm viewMode={true} />
              </ProtectedRoute>
            }
          />
          <Route
            path="edit/:id"
            element={
              <ProtectedRoute permission="properties.read">
                <PropertyForm />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Договоры */}
        <Route path="agreements">
          <Route
            index
            element={
              <ProtectedRoute permission="agreements.view">
                <Agreements />
              </ProtectedRoute>
            }
          />
          
          <Route
            path=":id"
            element={
              <ProtectedRoute permission="agreements.view">
                <AgreementDetail />
              </ProtectedRoute>
            }
          />

          <Route path="templates">
            <Route
              index
              element={
                <ProtectedRoute permission="agreements.manage_templates">
                  <AgreementTemplates />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="create"
              element={
                <ProtectedRoute permission="agreements.manage_templates">
                  <CreateTemplate />
                </ProtectedRoute>
              }
            />
            
            <Route
              path=":id/edit"
              element={
                <ProtectedRoute permission="agreements.manage_templates">
                  <CreateTemplate />
                </ProtectedRoute>
              }
            />
            
            <Route
              path=":id/view"
              element={
                <ProtectedRoute permission="agreements.manage_templates">
                  <TemplateDetail />
                </ProtectedRoute>
              }
            />
          </Route>
        </Route>

        {/* Заявки */}
        <Route path="requests">
          <Route
            index
            element={
              <ProtectedRoute permission="requests.view">
                <RequestsList />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="bot-settings"
            element={
              <ProtectedRoute requireSuperAdmin={true}>
                <BotSettings />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Финансовые документы */}
        <Route path="financial-documents">
          <Route
            index
            element={
              <ProtectedRoute permission="agreements.view">
                <FinancialDocuments />
              </ProtectedRoute>
            }
          />
          <Route
            path="invoices/:id"
            element={
              <ProtectedRoute permission="agreements.view">
                <InvoiceDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="receipts/:id"
            element={
              <ProtectedRoute permission="agreements.view">
                <ReceiptDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="confirmations/:id"
            element={
              <ProtectedRoute permission="agreements.view">
                <ReservationConfirmationDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="confirmation-templates"
            element={
              <ProtectedRoute permission="agreements.view">
                <ConfirmationTemplates />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Файловый менеджер */}
        <Route path="file-manager">
          <Route
            index
            element={
              <ProtectedRoute permission="file_manager.view">
                <FileManager />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Пользователи */}
        <Route path="users">
          <Route
            index
            element={
              <ProtectedRoute permission="users.read">
                <UsersList />
              </ProtectedRoute>
            }
          />
          <Route
            path="create"
            element={
              <ProtectedRoute permission="users.create">
                <UserForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="edit/:id"
            element={
              <ProtectedRoute permission="users.update">
                <UserForm />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Роли */}
        <Route path="roles">
          <Route
            index
            element={
              <ProtectedRoute permission="roles.read">
                <RolesList />
              </ProtectedRoute>
            }
          />
          <Route
            path="create"
            element={
              <ProtectedRoute permission="roles.create">
                <RoleForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="edit/:id"
            element={
              <ProtectedRoute permission="roles.update">
                <RoleForm />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;