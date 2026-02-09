
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Layout from './pages/Layout';
import DashboardPage from './pages/DashboardPage';
import BuildingsAndRoomsPage from './pages/BuildingsAndRoomsPage';
import EmployeesPage from './pages/EmployeesPage';
import AssignmentsPage from './pages/AssignmentsPage';
import MaintenancePage from './pages/MaintenancePage';
import UsersPage from './pages/UsersPage';
import ActivityLogPage from './pages/ActivityLogPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import PropertiesPage from './pages/PropertiesPage'; // NEW
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import { initDb } from './services/apiService';
import { ExportSettingsProvider } from './context/ExportSettingsContext';
import { SettingsProvider } from './context/SettingsContext';
import { PropertyProvider } from './context/PropertyContext'; // NEW

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [dbLoading, setDbLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    initDb().then(() => setDbLoading(false));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  if (loading || dbLoading) return <div className="h-screen flex items-center justify-center animate-pulse text-primary-600 font-bold">Initializing System...</div>;

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/" element={user ? <Layout theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} /> : <Navigate to="/login" />}>
          <Route index element={<DashboardPage />} />
          <Route path="housing" element={<BuildingsAndRoomsPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="reservations" element={<AssignmentsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="properties" element={<PropertiesPage />} /> 
          <Route path="activity-log" element={<ActivityLogPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

const App: React.FC = () => (
    <AuthProvider>
      <LanguageProvider>
        <ToastProvider>
          <PropertyProvider> 
            <SettingsProvider>
              <ExportSettingsProvider>
                <AppContent />
              </ExportSettingsProvider>
            </SettingsProvider>
          </PropertyProvider>
        </ToastProvider>
      </LanguageProvider>
    </AuthProvider>
);

export default App;
