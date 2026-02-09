
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import useDashboardData from '../hooks/useDashboardData';
import { DashboardSettingsProvider, useDashboardSettings } from '../context/DashboardSettingsContext';
import CustomizeDashboardModal from '../components/dashboards/CustomizeDashboardModal';

// Import role-specific dashboards
import AdminDashboard from '../components/dashboards/AdminDashboard';
import ManagerDashboard from '../components/dashboards/ManagerDashboard';
import SupervisorDashboard from '../components/dashboards/SupervisorDashboard';
import HRDashboard from '../components/dashboards/HRDashboard';
import MaintenanceDashboard from '../components/dashboards/MaintenanceDashboard';
import GenericDashboard from '../components/dashboards/GenericDashboard';
import { User } from '../types';

const DashboardPage: React.FC = () => {
    return (
      <DashboardSettingsProvider>
        <DashboardContent />
      </DashboardSettingsProvider>
    );
};

const ROLE_HIERARCHY: User['roles'][number][] = ['super_admin', 'admin', 'manager', 'supervisor', 'hr', 'maintenance', 'viewer'];

const getPrimaryRole = (roles: User['roles']): User['roles'][number] => {
    if (!roles || roles.length === 0) return 'viewer';
    for (const role of ROLE_HIERARCHY) {
        if (roles.includes(role)) {
            return role;
        }
    }
    return roles[0];
};

const DashboardContent: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { data, loading } = useDashboardData();
    const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
    const { settings } = useDashboardSettings();

    const renderDashboard = () => {
        if (!data || !user) return null;

        const primaryRole = getPrimaryRole(user.roles);

        switch (primaryRole) {
            case 'super_admin':
            case 'admin':
                return <AdminDashboard data={data} />;
            case 'manager':
                return <ManagerDashboard data={data} />;
            case 'supervisor':
                return <SupervisorDashboard data={data} />;
            case 'hr':
                return <HRDashboard data={data} />;
            case 'maintenance':
                return <MaintenanceDashboard data={data} />;
            default:
                return <GenericDashboard data={data} />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-80">
                <div className="w-10 h-10 border-4 border-hotel-navy border-t-hotel-gold rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4 dark:border-slate-700">
                 <div>
                    <h1 className="text-2xl font-bold text-hotel-navy dark:text-white leading-tight">{t('dashboard.title')}</h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-xs mt-0.5">{t('dashboard.subtitle', { user: user?.username || '' })}</p>
                 </div>
                 <button onClick={() => setIsCustomizeModalOpen(true)} className="px-4 py-2 bg-white border border-slate-200 text-hotel-navy font-semibold rounded-lg hover:bg-slate-50 transition-colors text-xs shadow-sm flex items-center gap-1.5 dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                    <i className="fas fa-sliders-h text-hotel-gold"></i>
                    {t('dashboard.customize.title')}
                 </button>
            </div>
            
            <div className="animate-fade-in-up">
                {renderDashboard()}
            </div>

            {isCustomizeModalOpen && (
                <CustomizeDashboardModal 
                    isOpen={isCustomizeModalOpen} 
                    onClose={() => setIsCustomizeModalOpen(false)}
                />
            )}
        </div>
    );
};

export default DashboardPage;
