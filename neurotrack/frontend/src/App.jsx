import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Patients     from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Analytics    from './pages/Analytics';
import Research     from './pages/Research';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

          <Route path="/dashboard"         element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/patients"          element={<PrivateRoute><Patients /></PrivateRoute>} />
          <Route path="/patients/:id"      element={<PrivateRoute><PatientDetail /></PrivateRoute>} />
          <Route path="/analytics"         element={<PrivateRoute><Analytics /></PrivateRoute>} />
          <Route path="/research"          element={<PrivateRoute><Research /></PrivateRoute>} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
