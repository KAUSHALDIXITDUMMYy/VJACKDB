import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import { useAuth } from './contexts/AuthContext';
// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import Agents from './pages/admin/Agents';
import Brokers from './pages/admin/Broker';
import Accounts from './pages/admin/Accounts';
import Players from './pages/admin/Players';
import Assignments from './pages/admin/Assignments';

// Player Pages
import PlayerDashboard from './pages/player/Dashboard';
import AccountEntry from './pages/player/AccountEntry';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RoleBasedRedirect />
              </ProtectedRoute>
            }
          />
          
          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <Layout>
                  <AdminDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/agents"
            element={
              <ProtectedRoute requiredRole="admin">
                <Layout>
                  <Agents />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/brokers"
            element={
              <ProtectedRoute requiredRole="admin">
                <Layout>
                  <Brokers />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/accounts"
            element={
              <ProtectedRoute requiredRole="admin">
                <Layout>
                  <Accounts />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/players"
            element={
              <ProtectedRoute requiredRole="admin">
                <Layout>
                  <Players />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assignments"
            element={
              <ProtectedRoute requiredRole="admin">
                <Layout>
                  <Assignments />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          {/* Player Routes */}
          <Route
            path="/player/dashboard"
            element={
              <ProtectedRoute requiredRole="player">
                <Layout>
                  <PlayerDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/player/account/:id"
            element={
              <ProtectedRoute requiredRole="player">
                <Layout>
                  <AccountEntry />
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

// Component to handle role-based redirection
function RoleBasedRedirect() {
  const { userData } = useAuth();
  
  if (userData?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  } else if (userData?.role === 'player') {
    return <Navigate to="/player/dashboard" replace />;
  }
  
  // Fallback - shouldn't reach here if auth is working properly
  return <Navigate to="/login" replace />;
}

export default App;