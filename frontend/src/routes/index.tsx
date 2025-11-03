// frontend/src/routes/index.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import MainLayout from '@/components/Layout/MainLayout';
import Login from '@/modules/Auth/Login';
import Dashboard from '@/modules/Dashboard';
import PropertiesList from '@/modules/Properties/PropertiesList';
import PropertyForm from '@/modules/Properties/PropertyForm';
import UsersList from '@/modules/Users/UsersList';
import UserForm from '@/modules/Users/UserForm';
import RolesList from '@/modules/Roles/RolesList';
import RoleForm from '@/modules/Roles/RoleForm';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
}

const ProtectedRoute = ({ children, permission }: ProtectedRouteProps) => {
  const { isAuthenticated, hasPermission } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
      {/* Public routes */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />

        {/* Properties */}
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
            path="create"
            element={
              <ProtectedRoute permission="properties.create">
                <PropertyForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="edit/:id"
            element={
              <ProtectedRoute permission="properties.update">
                <PropertyForm />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Users */}
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

        {/* Roles */}
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