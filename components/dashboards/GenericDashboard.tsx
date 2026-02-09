import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../../hooks/useDashboardData';
import StatCard from './StatCard';
import { useLanguage } from '../../context/LanguageContext';
import { useDashboardSettings } from '../../context/DashboardSettingsContext';

interface GenericDashboardProps {
    data: DashboardData;
}

const GenericDashboard: React.FC<GenericDashboardProps> = ({ data }) => {
    const { t } = useLanguage();
    const { settings } = useDashboardSettings();
    const navigate = useNavigate();
    const stats = data.stats;

    return (
        <div className="space-y-6">
            {settings.stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon="fa-users" title={t('dashboard.generic.activeEmployees')} value={stats.activeEmployees} gradient="bg-gradient-to-br from-blue-400 to-blue-600" onClick={() => navigate('/employees')} />
                    <StatCard icon="fa-building" title={t('dashboard.generic.totalRooms')} value={stats.totalRooms} gradient="bg-gradient-to-br from-green-400 to-green-600" onClick={() => navigate('/housing')} />
                    <StatCard icon="fa-person-shelter" title={t('dashboard.generic.occupiedRooms')} value={stats.occupiedRooms} gradient="bg-gradient-to-br from-yellow-400 to-orange-600" onClick={() => navigate('/housing')} />
                    <StatCard icon="fa-wrench" title={t('dashboard.generic.openTickets')} value={stats.openMaintenance} gradient="bg-gradient-to-br from-red-400 to-red-600" onClick={() => navigate('/maintenance')} />
                </div>
            )}
        </div>
    );
};

export default GenericDashboard;
