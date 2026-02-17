import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../../entities/user/model/store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isLogged, user } = useUserStore();
  const location = useLocation();

  if (!isLogged) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const defaultPath =
      user.role === 'super_admin' ? '/super-admin' :
      user.role === 'admin' ? '/dashboard' : '/user-dashboard';
    return <Navigate to={defaultPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
