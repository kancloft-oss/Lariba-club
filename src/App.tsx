/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import ResidentDashboard from './components/ResidentDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

function PrivateRoute({ children, role }: { children: React.ReactNode, role?: 'admin' | 'resident' }) {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Загрузка...</div>;
  if (!currentUser) return <Navigate to="/login" />;
  if (role && userProfile?.role !== role) return <Navigate to="/" />;

  return <>{children}</>;
}

function AppRoutes() {
  const { userProfile, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin/*" element={
        <PrivateRoute role="admin">
          <AdminDashboard />
        </PrivateRoute>
      } />
      <Route path="/resident/*" element={
        <PrivateRoute role="resident">
          <ResidentDashboard />
        </PrivateRoute>
      } />
      <Route path="/" element={
        loading ? <div className="min-h-screen flex items-center justify-center">Загрузка...</div> :
        userProfile?.role === 'admin' ? <Navigate to="/admin" /> : 
        userProfile?.role === 'resident' ? <Navigate to="/resident" /> : 
        <Navigate to="/login" />
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
