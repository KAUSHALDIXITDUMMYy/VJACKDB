import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'player';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { currentUser, userData, loading } = useAuth();

  // Show loading while auth state is being determined
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Wait for user data to be loaded
  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading user data...</div>
      </div>
    );
  }

  // Check role-based access
  if (requiredRole && userData.role !== requiredRole) {
    // Redirect based on user's actual role
    const redirectPath = userData.role === 'admin' ? '/admin/dashboard' : '/player/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}